# Kết nối Hermes Agent vào AI OS

Tài liệu này hướng dẫn từng bước kết nối [Hermes Agent](https://hermes-agent.nousresearch.com/) (Nous Research) — "bộ não" thực thi và ghi nhớ — vào AI OS Dashboard, để chủ doanh nghiệp có thể **chat và giao việc trực tiếp trên AI OS**, thay vì chỉ qua Discord.

Tài liệu tham chiếu kỹ thuật gốc: `hermes-agent.nousresearch.com/docs`.

---

## 1. Nguyên lý kiến trúc

Hermes Agent là phần mềm **self-hosted, mã nguồn mở**. Ba khái niệm cốt lõi:

| Khái niệm Hermes | Tương đương trong AI OS |
|---|---|
| **Profile** (`hermes -p <ten>`) — 1 instance Agent cô lập, có `memories/`, `skills/`, `SOUL.md` riêng | 1 **Agent phòng ban** (Sales Agent, Finance Agent…) |
| **Gateway** — kết nối nền tảng chat (Discord…) vào đúng Profile theo `config.yaml` | Kênh Discord hiện tại của từng Agent |
| **API Server** — endpoint HTTP tương thích chuẩn OpenAI (`/v1/chat/completions`) | Cửa để AI OS Dashboard chat trực tiếp, không qua Discord |
| **Mem0 provider** (`hermes memory`) — kho tri thức ngoài, phân vùng theo `agent_id` | Nút "Thêm tài liệu" trong mục Knowledge của Dashboard |

**Nguyên tắc quan trọng:** Discord và AI OS Dashboard là **hai giao diện trỏ vào cùng một Profile** — cùng bộ nhớ, cùng skill, cùng lịch sử. Không tạo agent song song, không phân mảnh tri thức.

```
                         ┌─────────────────────────┐
   AI OS Dashboard  ───▶ │   AI OS Backend Proxy    │
   (chat + upload)       │  (Node.js — giữ API key) │
                         └───────────┬─────────────┘
                                     │  /v1/chat/completions (Bearer key)
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            Hermes Profile    Hermes Profile    Hermes Profile
            "sales-1"         "fin-1"           "legal-1"  …
            :8643             :8647             :8649
                    ▲                ▲                ▲
                    │ Gateway route theo channel        │
            Discord #sales-agent  #finance-agent  #legal-agent
                    │                │                │
                    └────────┬───────┴────────┬───────┘
                              ▼                ▼
                         Mem0 (agent_id = sales-1, fin-1, legal-1…)
```

**Vì sao bắt buộc phải có Backend Proxy** (không gọi thẳng từ trình duyệt):
1. `API_SERVER_KEY` của Hermes cho **toàn quyền chạy lệnh terminal** trên máy host — tuyệt đối không được nhúng vào JavaScript phía client (ai xem "View Source" cũng lấy được).
2. Hermes API Server mặc định bind `127.0.0.1` — trình duyệt của CEO ở xa không gọi thẳng được.
3. Cần một nơi ánh xạ `agentId` (dùng trong AI OS) → đúng cổng + đúng key của từng Profile.

---

## 2. Bước 1 — Xác nhận / tạo Profile cho từng Agent

Vì mỗi Agent trong Discord hiện tại đã tách kênh riêng, hãy xác nhận mỗi kênh **đã** ứng với một Profile riêng (không dùng chung 1 Profile cho nhiều kênh):

```bash
hermes profile list
```

Nếu thiếu, tạo mới cho từng Agent (đặt tên trùng `id` trong AI OS để dễ đối chiếu):

```bash
hermes profile create sales-1
hermes profile create mkt-1
hermes profile create mkt-2
hermes profile create hr-1
hermes profile create fin-1
hermes profile create fin-2
hermes profile create legal-1
hermes profile create cskh-1
hermes profile create cskh-2
```

Với mỗi profile, chỉnh `SOUL.md` (tính cách) và `~/.hermes_<profile>/config.yaml` (model, tool) theo đúng vai trò — dữ liệu tham khảo lấy từ cấu hình đang hiển thị trong Dashboard (model, mode Planning/Fast, Workspace Rule).

---

## 3. Bước 2 — Bật API Server cho từng Profile

Mỗi Profile cần chạy **API Server trên một cổng riêng**. Thêm vào `~/.hermes_<profile>/.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=<sinh-key-ngau-nhien-manh>
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=<xem-bang-duoi>
API_SERVER_CORS_ORIGINS=http://localhost:8787   # chỉ backend proxy được gọi thẳng
```

Sinh key an toàn:

```bash
openssl rand -hex 32
```

### Bảng ánh xạ đề xuất (khớp 9 Agent hiện có trong Dashboard)

| Agent (AI OS) | Phòng ban | Hermes Profile | API Server Port | Discord Channel | Mem0 `agent_id` |
|---|---|---|---|---|---|
| Sales Agent | Kinh doanh | `sales-1` | 8643 | #sales-agent | `sales-1` |
| Content Agent | Marketing | `mkt-1` | 8644 | #content-agent | `mkt-1` |
| Social Agent | Marketing | `mkt-2` | 8645 | #social-agent | `mkt-2` |
| HR Agent | Nhân sự | `hr-1` | 8646 | #hr-agent | `hr-1` |
| Finance Agent | Kế toán – Tài chính | `fin-1` | 8647 | #finance-agent | `fin-1` |
| Audit Agent | Kế toán – Tài chính | `fin-2` | 8648 | #audit-agent | `fin-2` |
| Legal Agent | Pháp lý | `legal-1` | 8649 | #legal-agent | `legal-1` |
| Support Agent | CSKH | `cskh-1` | 8650 | #support-agent | `cskh-1` |
| Care Agent | CSKH | `cskh-2` | 8651 | #care-agent | `cskh-2` |

Chạy từng gateway (nên chạy nền qua `systemd`/`launchd`, không chỉ `run` foreground):

```bash
hermes -p sales-1 gateway start
hermes -p mkt-1   gateway start
hermes -p mkt-2   gateway start
hermes -p hr-1    gateway start
hermes -p fin-1   gateway start
hermes -p fin-2   gateway start
hermes -p legal-1 gateway start
hermes -p cskh-1  gateway start
hermes -p cskh-2  gateway start

# hoặc chạy toàn bộ 1 lệnh
hermes gateway start --all
```

Kiểm tra:

```bash
hermes gateway list
curl http://127.0.0.1:8643/v1/models \
  -H "Authorization: Bearer <API_SERVER_KEY của sales-1>"
```

> ⚠️ Giữ Discord Gateway của từng Profile **vẫn bật song song** — API Server không thay thế Discord, chỉ mở thêm một cửa vào cùng Profile đó.

---

## 4. Bước 3 — Cấu hình Mem0 để đồng bộ Knowledge

Mục "Thêm tài liệu" trên Dashboard (nhập tay / upload file / MCP) sẽ ghi vào **Mem0**, và Hermes đọc lại từ đó khi trả lời — tri thức dùng chung giữa Discord và AI OS.

### 4.1 Tạo tài khoản Mem0 (Platform mode — khuyến nghị cho SME, không cần tự host vector DB)

Lấy `MEM0_API_KEY` từ mem0.ai.

### 4.2 Cấu hình mỗi Profile

Thêm vào `~/.hermes_<profile>/.env`:

```bash
MEM0_API_KEY=<key-chung-cho-toan-cong-ty>
```

Thêm vào `~/.hermes_<profile>/config.yaml` — **`agent_id` phải khớp đúng `id` của Agent trong AI OS** (xem bảng ở Bước 2):

```yaml
plugins:
  hermes-memory:
    mem0:
      mode: platform
      user_id: aios-company        # cố định — đại diện "doanh nghiệp"
      agent_id: sales-1            # đổi theo từng profile — dùng đúng id trong bảng
      rerank: true
```

Việc phân vùng theo `agent_id` đảm bảo tài liệu bạn nạp cho Finance Agent (vd bảng giá) **không lẫn** sang Legal Agent.

### 4.3 Cách ghi memory

- **Từ trong hội thoại**: Hermes tự dùng tool `mem0_add` khi Agent thấy có "fact" đáng nhớ.
- **Từ AI OS (bên ngoài)**: Backend Proxy gọi thẳng **Mem0 API** (không qua Hermes) để ghi memory hộ — xem Bước 4. Đây là đường đi khi CEO bấm "＋ Thêm tài liệu" trên Dashboard.

---

## 5. Bước 4 — Backend Proxy

Đã triển khai tại [project/aios/server/](server/) (xem README trong thư mục đó để chạy). Chức năng:

- `POST /api/agents/:agentId/chat` — nhận `{ message, history }` từ Dashboard, tra `agents.config.json` lấy đúng `port` + `apiKey` của Profile, forward tới `http://127.0.0.1:<port>/v1/chat/completions`, trả lời về cho Dashboard.
- `POST /api/agents/:agentId/knowledge` — nhận `{ text }`, gọi Mem0 API để `add` memory với đúng `agent_id`, đồng thời trả về để Dashboard hiển thị xác nhận.
- Toàn bộ API key (Hermes lẫn Mem0) chỉ nằm trong biến môi trường phía server — **không bao giờ** xuất hiện trong mã nguồn frontend.

---

## 6. Bước 5 — Nối Dashboard vào Proxy

Trong [website/js/app.js](website/js/app.js), có 2 hằng số điều khiển ở đầu file:

```js
const USE_REAL_HERMES = false;              // true = gọi Hermes thật qua proxy
const HERMES_PROXY_BASE = "http://localhost:8787";
```

- **Mặc định `false`**: Dashboard chạy độc lập, dữ liệu mô phỏng trong trình duyệt (như bản demo hiện tại) — không cần proxy, không cần Hermes thật, dùng để giới thiệu/training nội bộ.
- **Bật `true`** khi đã hoàn tất Bước 1–4: khung "💬 Chat" của mỗi Agent gọi thật đến Profile Hermes tương ứng; panel "＋ Thêm tài liệu → Nhập tay / Upload file" gọi thêm sang Mem0 qua proxy để lưu vĩnh viễn.

Không cần sửa gì khác — proxy dùng đúng `agentId` (`sales-1`, `fin-1`…) đã có sẵn trong dữ liệu `AGENTS` của Dashboard.

---

## 7. Bảo mật & vận hành

- **Không commit `.env`** chứa `API_SERVER_KEY` / `MEM0_API_KEY` vào git.
- Đặt `API_SERVER_CORS_ORIGINS` đúng domain thật của AI OS Proxy khi lên production — không để `*`.
- Nếu AI OS Dashboard public trên Internet, đặt **Backend Proxy sau xác thực đăng nhập** (CEO/quản lý) — hiện Dashboard demo chưa có login, cần bổ sung trước khi public.
- `API_SERVER_KEY` cho quyền chạy lệnh terminal → giới hạn theo nguyên tắc "quyền tối thiểu" (đúng tinh thần Rule trong tài liệu KWSR mục 4.1.5): mỗi Profile chỉ nên có quyền truy cập dữ liệu/thư mục cần thiết cho đúng phòng ban đó.
- Theo dõi log Gateway (`hermes gateway status`) và log Proxy song song để đối chiếu khi có sự cố.
- Dùng `docker_orphan_reaper: true` nếu Profile có chạy subagent qua Docker, tránh rác container.

---

## 8. Checklist kiểm thử end-to-end

- [ ] `hermes gateway list` — cả 9 Profile ở trạng thái running, Discord Gateway kết nối OK.
- [ ] `curl .../v1/models` trả về đúng tên model cho từng cổng.
- [ ] Gửi tin trong Discord channel của 1 Agent → Agent trả lời bình thường (không bị ảnh hưởng bởi việc bật API Server).
- [ ] Bật `USE_REAL_HERMES = true`, chạy Backend Proxy, mở Dashboard → chat thử với Sales Agent → nhận phản hồi thật từ Hermes (không phải câu trả lời mô phỏng).
- [ ] Trên Dashboard, "＋ Thêm tài liệu" cho Finance Agent một dòng bảng giá mới → hỏi Finance Agent qua Discord về bảng giá đó → Agent trả lời đúng nội dung vừa nạp (xác nhận Mem0 đồng bộ 2 chiều).
- [ ] Thử hỏi Legal Agent về dữ liệu vừa nạp cho Finance Agent → Agent phải **không biết** (xác nhận phân vùng `agent_id` đúng, không rò rỉ tri thức chéo phòng ban).

---

## 9. Mở rộng (giai đoạn sau)

- **Orches Agent thành Hermes Profile riêng**: hiện Orches trong Dashboard chỉ định tuyến bằng so khớp từ khóa phía trình duyệt. Có thể nâng cấp thành 1 Profile Hermes dùng `delegate_task()` để tự gọi sang các Profile khác — nên làm sau khi 9 Agent chuyên môn đã chạy ổn định qua Proxy.
- **Streaming (SSE)**: API Server hỗ trợ `"stream": true` — Proxy hiện trả về theo dạng chờ trọn phản hồi (đơn giản, dễ triển khai); có thể nâng cấp sang relay SSE để hiệu ứng "đang gõ" mượt hơn.
- **Sync qua Skill thay vì Mem0**: với tài liệu dạng quy trình chuẩn ít đổi (SOP, checklist), cân nhắc đóng gói thành Skill (`hermes skills install`) thay vì Mem0 — bền hơn, không tốn phí truy vấn.
