# AI OS — Kế hoạch triển khai tổng thể (bản production)

> **Phiên bản:** v1.0 (03/11/2026).
> **Căn cứ:**
> - `docs/ADMIN_PORTAL_DESIGN.md` v2.2. Thứ tự ưu tiên khi đọc: §25 → §24 → các chương trước.
> - `docs/USER_WORKSPACE_DESIGN.md` v2.1.
> - Bản thiết kế giao diện «AI OS Portal — Thiết kế giao diện» (148 board, bản cập nhật 03/11).
>
> **Mục đích:** chia toàn bộ việc xây bản production thành các giai đoạn. Mỗi giai đoạn có hạng mục, màn hình thiết kế, tiêu chí nghiệm thu và việc cần chuẩn bị ngoài code. Mỗi giai đoạn sẽ có kế hoạch chi tiết riêng (`docs/plan/GD-xx.md`), viết ngay trước khi bắt đầu giai đoạn đó.
>
> **Quy ước khi tài liệu lệch nhau:** tài liệu thiết kế quyết định **hành vi**; bản thiết kế giao diện quyết định **bố cục và hình thức**. Chỗ hai bên còn lệch được liệt kê ở §6 và phải chốt trước giai đoạn có màn đó.

---

## 0. Tóm tắt

| GĐ | Tên | Đầu ra chính | Số màn thiết kế | Ước lượng* |
|---|---|---|:-:|:-:|
| **0a** | Nền móng | Repo mới, Docker Compose, PostgreSQL + RLS, khung server, khung frontend theo thiết kế, CI | 0 | 2–3 tuần |
| **0b** | Console tối thiểu & đăng nhập | SuperAdmin tạo, vô hiệu hoá tenant; tenant đăng nhập theo subdomain; khung Admin và Workspace | 16 | 3 tuần |
| **1a** | Tổ chức, người dùng, Rule | Sơ đồ 2 trục, người dùng nhiều phạm vi, Kho KWSR tối thiểu, Rule kế thừa + Global Rule, Cài đặt trạng thái | 18 | 4–5 tuần |
| **1b** | Worker, động cơ, công việc, Orchestrator, Telegram | Worker chạy thật, hội thoại, công việc / dự án / phiếu, chuỗi tự chạy, Orchestrator, Telegram Bot | 72 | 8–10 tuần |
| **2** | Tri thức, phê duyệt, Chat Social | Knowledge + Qdrant, tài liệu Mật, Quy tắc duyệt, Yêu cầu liên phòng, Chat Social | 30 | 7–8 tuần |
| **3** | Thanh toán, sử dụng, chat nội bộ | Ví theo lô, PayOS + chứng từ, đổi gói, tự đăng ký, chat nội bộ | 11 | 5–6 tuần |
| **4** | Email & vận hành nâng cao | Hộp thư tenant, hành động gửi ra ngoài, xuất/nhập, MFA Admin, tên miền riêng | 1 | 5–6 tuần |

\* Ước lượng thô cho **2 lập trình viên toàn thời gian**, chưa gồm thời gian chờ bên thứ ba (duyệt ứng dụng Zalo, Meta, Google; merchant PayOS). Tổng khoảng **34–41 tuần**. Kế hoạch chi tiết của từng giai đoạn sẽ ước lượng lại.

**Cổng giữa các giai đoạn.** Một giai đoạn chỉ kết thúc khi đạt đủ bốn điều sau:
1. Đạt hết tiêu chí nghiệm thu của giai đoạn.
2. CI xanh.
3. Đã chạy trên staging.
4. Bạn đã bấm thử các màn của giai đoạn đó.

Không bắt đầu giai đoạn sau khi giai đoạn trước chưa qua cổng. Có một ngoại lệ: việc chuẩn bị ngoài code ở §5 được làm song song.

**Lộ trình go-live.**

| Mốc | Sau giai đoạn | Mô tả |
|---|---|---|
| Nội bộ | 1b | Dùng thử với 1–2 tenant thật, chưa thu tiền |
| Beta | 2 | Đủ tri thức và phê duyệt để khách làm việc thật |
| Thương mại | 3 | Có PL1 (pháp lý khi thu tiền); bản production thay bản demo ở `workers.ai-os.vn` rồi tắt bản demo |

---

## 1. Nguyên tắc chung

### 1.1 Tiêu chuẩn hoàn thành (áp cho mọi hạng mục)

- **API viết trước giao diện.** Schema yêu cầu và phản hồi nằm trong `docs/api/openapi.yaml`. PR nào đổi API thì sửa luôn file này.
- **Migration:** SQL thuần, đánh số, chạy được từ CSDL rỗng và chạy lại không lỗi. Bảng mới có `tenant_id` + RLS ngay từ migration đầu.
- **Test đi kèm:**
  - Route mới tự động vào bài quét cách ly tenant.
  - Logic quyền và tính toán có test dạng bảng: `relation()`, `taskPolicy.create`, `rules-engine`, Action Gate, `hardCheck`.
  - Mọi thao tác ghi đều ghi `audit_log`.
- **Giao diện:**
  - Đúng bố cục và trạng thái của board thiết kế.
  - Không có số liệu giả: khối nào chưa có dữ liệu thì hiện trạng thái rỗng.
  - Kiểm ở 1440px và 390px.
  - Qua lint: không `innerHTML` với dữ liệu người dùng, không thuộc tính sự kiện inline.
- **Bảo mật:**
  - Không lộ bí mật ra log hay phản hồi.
  - Hạn mức và quyền kiểm ở server; giao diện chỉ làm mờ nút.

### 1.2 Cách làm việc

- Mỗi giai đoạn chia thành các **gói việc (WP)** cỡ 1–4 ngày. Mỗi WP là một PR, review xong mới gộp vào nhánh chính.
- Nhánh chính luôn chạy được. Staging tự triển khai từ nhánh chính.
- Cuối mỗi giai đoạn có buổi nghiệm thu: bấm thử theo danh sách board, đánh dấu ✔ / ✖ trong `docs/plan/GD-xx.md`.

### 1.3 Từ bản thiết kế giao diện sang mã

Bản thiết kế là HTML tĩnh: style viết inline, font Google, dữ liệu minh hoạ, link nối thẳng giữa các board. Khi chuyển sang mã:

| Thiết kế | Mã production |
|---|---|
| Style inline | Class CSS trong `website/css/` (`tokens.css` → `base.css` → `components.css` → CSS riêng từng khu vực). CSP cấm `style` inline |
| Màu, cỡ chữ, bo góc lặp lại | Token. Màu: Lime `#84CC16` / `#65A30D` / `#4D7C0F` / `#3F6212`, Mực `#0F172B`, Slate `#475569` / `#64748B` / `#94A3B8` / `#CBD5E1` / `#E2E8F0` / `#F1F5F9` / `#F8FAFC`. Bốn cặp trạng thái B5 (Hoạt động · Chờ / sắp hết · Lỗi · Nháp / tạm dừng). Console tím `#2E1065` / `#7C3AED`. Thang chữ 10–36px (chủ đạo 11.5 / 12.5 / 13.5). Bo góc 9 / 11 / 13 / 18 / pill |
| Font Outfit + Inter từ Google | Tải `.woff2` về và phục vụ từ chính server. Chỉ các độ đậm đang dùng: Outfit 500/600/700, Inter 400/500/600 |
| SVG icon lặp ở từng màn | Bộ icon `website/assets/icons.svg` (sprite), gọi qua `<svg><use href>` |
| Khối lặp giữa các màn | Thành phần dùng chung trong `website/js/ui/`: khung 3 khu vực, thẻ chỉ số, bảng có lọc và phân trang, nhãn trạng thái, hộp thoại, tab, trường form, công tắc, stepper, dải chuỗi công việc, trạng thái rỗng, banner |
| Link giữa các board | Route thật (cột «Route đề xuất» ở §4). Board dạng cửa sổ là modal trên trang cha, có URL riêng khi cần mở bằng link |
| Dữ liệu minh hoạ | Gọi API. Chỗ thiết kế ghi `[GIÁ]`, `[SỐ TIỀN]`, `[%]` lấy từ bảng Gói & Giá trên Console |

**Ba khung giao diện** (làm ở 0b, các màn sau gắn vào):

| Khung | Host | Đặc điểm |
|---|---|---|
| Admin | `{slug}.ai-os.vn/admin` | Thanh bên tối, 4 nhóm menu, Ví credit |
| Workspace | `{slug}.ai-os.vn/` | Thanh bên trắng; menu tài khoản «NM ▾» chứa nút chuyển sang Quản trị |
| Console | `console.ai-os.vn` | Băng tím ở đỉnh, accent tím, không bao giờ trùng màu với Portal của khách |

---

## 2. Cấu trúc mã đích

Theo tài liệu Admin §18. Bản demo **không** được dùng lại (R1). Ở đầu GĐ 0a: gắn thẻ `demo-final` cho nhánh hiện tại, rồi xoá khỏi nhánh chính các thư mục `website/`, `server/`, `hr/`, `marketing/`, `sales/`, `Ref_EcomAIOS/` và cấu hình Firebase (`firebase.json`, `firestore.*`, `storage.rules`, `FIREBASE_SETUP.md`). Các tài liệu tham khảo cũ ở thư mục gốc (`HERMES_INTEGRATION.md`, `TaiLieu_ThietKe_AI_OS.md`, `XayDungAIAgentTRenAntigrvity.md`, `AI opt system.docx`) chuyển vào `docs/archive/`, trừ khi bạn muốn xoá hẳn.

```
docker-compose.yml · Caddyfile · .env.example
server/   server.js · router.js
          core/ (pg, auth, tenancy, vault, audit, mailer, jobs, object-store)
          org/ · library/ · workers/ · tasks/ · billing/ · integrations/ · mail/ · social/ · telegram/
          api/{console,tenant,public}/
          db/migrations/*.sql · db/migrate.js
scripts/  create-superadmin.js · seed-platform-defaults.js · backup.sh
website/  css/ · fonts/ · assets/ · js/ui/
          public/ (ai-os.vn) · console/ · admin/ · app/ (Workspace)
test/     unit/ · integration/ · isolation/ · e2e/ (Playwright)
docs/     ADMIN_PORTAL_DESIGN.md · USER_WORKSPACE_DESIGN.md · IMPLEMENTATION_PLAN.md · plan/ · api/openapi.yaml · DEPENDENCIES.md
```

Thư mục `tasks/`, `social/` và `telegram/` được tách riêng (tài liệu Admin §18 chưa có) vì ba mảng này đủ lớn để đứng một mình.

---

## 3. Chi tiết từng giai đoạn

### GĐ 0a — Nền móng (không có màn nghiệp vụ)

| WP | Hạng mục |
|---|---|
| 0a.1 | Dọn repo theo R1 (§2): thẻ `demo-final`, xoá mã demo, `.gitignore`, `README` |
| 0a.2 | Docker Compose: `caddy` (wildcard, `tls internal` ở máy dev), `aios-server`, `postgres:16`, `qdrant`, `embeddings` (bản giả ở máy dev). `BASE_DOMAIN` qua biến môi trường |
| 0a.3 | `db/migrate.js` và `schema_migrations`. Ba role `aios_app` / `aios_console` / `aios_system`. Migration `0001_core.sql`: `tenants`, `users`, `sessions`, `audit_log`, `jobs`, `vault_secrets`, có RLS |
| 0a.4 | `router.js` (middleware, không framework), `tenancy.js` (Host → tenant, `Repository(tenantId)`, đặt `app.tenant_id`, `app.user_id`, `app.is_tenant_admin`), `auth.js` (phiên, cookie `__Host-sid`, CSRF), `vault.js` (AES-256-GCM), `audit.js`, `jobs.js` (`SKIP LOCKED`) |
| 0a.5 | Nền frontend: `tokens.css`, `base.css`, `components.css`, font tự phục vụ, sprite icon, `js/ui/` (escape bằng helper `h`, API client, modal, bảng, form), trang mẫu thành phần `/_ui` để đối chiếu với thiết kế. Đặt CSP |
| 0a.6 | CI (GitHub Actions): lint, unit, migration từ rỗng, test RLS bằng ba role thật, bài quét cách ly tenant tự lấy danh sách route. Khung `openapi.yaml`, `DEPENDENCIES.md` |
| 0a.7 | Kiểm cookie `__Host-sid` trên `*.aios.localhost` ở Chrome và Firefox. Nếu không chạy, dùng phương án `aios.test` + mkcert |

**Nghiệm thu:**
- Không đăng nhập thì mọi API trả `401`.
- Phiên của tenant A gọi sang tenant B bị chặn, kể cả khi truy vấn cố tình bỏ điều kiện `tenant_id` (RLS chặn).
- `aios_console` đọc bảng nội dung riêng tư nhận `permission denied`.
- Migration chạy được từ CSDL rỗng trong CI.
- Trang `/_ui` hiển thị đủ thành phần, khớp màu và chữ của thiết kế.

### GĐ 0b — Console tối thiểu & đăng nhập

**Màn:** 1, 28, 30, 31, 32, 34, 35, 42, 43, 51, 87, 88, 89. Thêm khung (chưa đủ số liệu) của 5 · Dashboard Admin, 23 · Người dùng và 80 · Tài khoản.

| WP | Hạng mục |
|---|---|
| 0b.1 | `scripts/create-superadmin.js`. Console: đăng nhập + MFA TOTP bắt buộc; phiên 4 giờ, tự thoát sau 30 phút không hoạt động; email báo mỗi lần đăng nhập (board 28) |
| 0b.2 | Console › Tenant: danh sách (30), tạo tenant (31, §4.3a), chi tiết · Tổng quan (32), chi tiết · Người dùng (34) |
| 0b.3 | Vô hiệu hoá / kích hoạt lại tenant (35) theo hai trục trạng thái; màn tenant bị vô hiệu hoá (51) |
| 0b.4 | Console › Nhân viên hệ thống (42), Nhật ký hệ thống (43) |
| 0b.5 | `seed-platform-defaults.js` (§7.6): gói, ngành dọc mặc định, trạng thái hệ thống, loại bước Workflow, Orchestrator. Mỗi tenant mới nhận đủ dữ liệu khởi tạo |
| 0b.6 | Đăng nhập tenant theo subdomain (1), khoá tạm sau nhiều lần sai, quên mật khẩu (87, link 30 phút), đổi mật khẩu lần đầu (88), nhận lời mời (89, link 72 giờ), Resend/SMTP |
| 0b.7 | Ba khung giao diện. Chuyển Workspace ⇄ Quản trị qua menu tài khoản; `member` không thấy Quản trị |
| 0b.8 | Sao lưu hằng ngày ra máy khác (B11) và diễn tập khôi phục |

**Nghiệm thu:**
- Tạo tenant `tenantabc` xong, đăng nhập được ở `tenantabc.<domain>` và tenant có đủ dữ liệu khởi tạo.
- `member` gọi `/api/v1/admin/*` nhận `403`.
- Tenant bị vô hiệu hoá không đăng nhập được; kỳ gia hạn không mở khoá tenant đó.
- Khôi phục bản sao lưu lên máy khác thành công.

### GĐ 1a — Tổ chức, người dùng, Rule, cấu hình nền

**Màn:** 6, 7, 16, 17, 23, 24, 25, 38, 45, 46, 47, 78, 120, 127, 128, 129, 130, 134, 149.

| WP | Hạng mục |
|---|---|
| 1a.1 | Gói & hạn mức: `effectiveLimits`, `enforce` an toàn khi tạo song song. Console › Gói & Giá (38), phần hạn mức |
| 1a.2 | Đơn vị, ngành dọc, bộ phận; sơ đồ theo đơn vị (6) và theo ngành dọc (7); tạo bộ phận (47); đổi đơn vị cha có xem trước khác biệt (129) |
| 1a.3 | Người dùng: danh sách (23), thêm theo sơ đồ (45), chi tiết (46). Nhiều phạm vi (`user_manage_scopes`); vai trò tự suy từ phạm vi |
| 1a.4 | Kho KWSR tối thiểu: Rule, Workflow, Skill dạng văn bản; phiên bản; Danh mục thẻ; Loại bước Workflow (134). Màn 16, 17, 130 (chưa có Knowledge) |
| 1a.5 | `rules-engine.js`: Rule kế thừa trên cây 3 cấp. Trình dựng `hardCheck` (149); Rule `hard` thiếu `hardCheck` không phát hành được; Rule «AI kiểm tra» không chọn được mức `block` |
| 1a.6 | Global Rule ở Cấu hình Orchestrator (127, 128): thời gian áp dụng, ba cách thực thi, có hiệu lực từ lượt chạy kế tiếp (M3, không có bước «đồng bộ») |
| 1a.7 | Cài đặt (25): Tổ chức, thương hiệu; Cài đặt trạng thái (nhóm, trạng thái, bảng chuyển, `status_event_map`, Dashboard settings); thêm/sửa trạng thái (120) |
| 1a.8 | Nhật ký kiểm toán (24); Workspace › Sơ đồ chỉ xem (78) |

**Nghiệm thu:**
- Rule Kế toán đặt ở Tổng công ty hiện trong Rule hiệu lực của Kế toán chi nhánh và không gỡ được ở cấp dưới.
- Người dùng thứ 26 ở gói 25 người bị chặn, kể cả khi gửi song song.
- Người có hai phạm vi thấy đúng hợp của hai phạm vi.
- Hai ràng buộc ở WP 1a.5 có test.
- Bảng chuyển trạng thái chặn được bước chuyển không cho phép.

### GĐ 1b — Worker, động cơ, công việc, Orchestrator, Telegram

GĐ lớn nhất (72 màn), chia ba mốc nội bộ. Cuối mỗi mốc đều demo được.

**Mốc 1b-1 · Worker & động cơ.** Màn 8, 9, 10–15, 20, 121, 122, 123, 125, 126, 135, 144, 82; thêm 29, 36, 37, 40, 44 (Console).

| WP | Hạng mục |
|---|---|
| 1b.1 | Mô hình AI (121): danh mục, model mặc định, model dự phòng. Kết nối Platform tối thiểu (20, 144), `model_pricing`. Console › Kết nối hệ thống (40) |
| 1b.2 | Worker: danh sách lưới / danh sách (9, 135, Orchestrator ghim đầu), trình tạo 4 bước (10–13), chi tiết (14), Rule hiệu lực (15), Sửa Worker một trang (123) + thêm Workflow / Skill (125, 126), đổi model (122) |
| 1b.3 | `worker_config_versions`: mỗi run ghi `config_version` (M12). Chính sách nhận việc + U13 (82). Ngân sách ngày mặc định bật, 50.000 credit (M5) |
| 1b.4 | **Động cơ chạy** (§9.5.9): vòng lặp, Action Gate bước 1, 2, 3, 4, 6; `worker_runs`, `run_steps`; hàng đợi, giới hạn đồng thời, thử lại, huỷ, nhặt lại sau sập; trần chi phí cứng |
| 1b.5 | Console: phiên hỗ trợ (36, 37), Sức khoẻ hệ thống (44), Dashboard khối đầu (29). Sơ đồ Người dùng ↔ Worker (8) |

**Mốc 1b-2 · Hội thoại & Công việc.** Màn 48, 49, 54, 55, 56, 58, 59, 60, 83, 84, 85, 86, 91, 92, 93, 95, 61–69, 72, 77, 79, 97, 98, 100–104, 106–108, 115, 117–119, 142, 143, 145, 81, 26.

| WP | Hạng mục |
|---|---|
| 1b.6 | `relation()` và danh bạ Worker (54, 142); hồ sơ theo ba mức (55, 56, 58, 84) |
| 1b.7 | Hội thoại: danh sách, lưu trữ / xoá / khôi phục (95), gõ lệnh (60), hiện dần + Dừng (92), Worker tạm dừng (93), chat dạng modal (83), hội thoại mới (86, ẩn «Nhân sự nội bộ»). Quyền riêng tư: chủ + Admin có nhật ký (81) |
| 1b.8 | Công việc / Dự án / Phiếu theo trạng thái cấu hình được (61–68, 97, 98, 100, 101). `taskPolicy.create`; `run_mode` và `confidential_allowed` ghi cứng trên việc. Nghiệm thu, làm lại, huỷ, báo cáo tiến độ (102–104) |
| 1b.9 | **Chuỗi công việc** (§9.5.11, Workspace §8.7): `start_rule`, điều kiện `done` / `accepted`, chuyển giao kết quả, «Chờ việc trước», dải chuỗi. Điều phối (69, 106–108) |
| 1b.10 | Hôm nay (48), màn chào (49), Kết quả (77, 115), Thông báo (79), Báo cáo cơ bản (72), vai trò viewer (91), Sơ đồ quan hệ (143, 145), bản di động (117–119, 26) |

**Mốc 1b-3 · Orchestrator & Telegram.** Màn 52, 53, 96; mục Telegram trong 25 và 80.

| WP | Hạng mục |
|---|---|
| 1b.11 | Orchestrator: ngữ cảnh, kế hoạch luôn trình trước khi giao, sửa kế hoạch (96), duyệt từng việc, theo dõi + báo cáo tổng hợp (53). Quyền ra lệnh cấp cho từng người |
| 1b.12 | Cấu hình Orchestrator: model, ngân sách (phần còn lại của 127) |
| 1b.13 | **Telegram Bot** (§25.2): token lưu trong két, webhook có `secret_token`, liên kết bằng mã một lần, ra lệnh chỉ trong chat riêng, nút Duyệt / Huỷ, báo cáo và nhóm chat nhận báo cáo |

**Nghiệm thu 1b:**
- Worker thứ 11 ở gói 10 Worker bị chặn.
- Việc từ Orchestrator chạy ngay ở Worker «Hạn chế» nhưng Rule `hard` vẫn chặn; Worker U13 không nhận việc từ Orchestrator.
- Chuỗi 3 bước chạy liền, không chờ nghiệm thu từng bước. Bước giữa vướng thì bước sau hiện «Chờ việc trước» kèm lý do; xử lý xong chuỗi tự chạy tiếp.
- Bot Telegram từ chối người chưa liên kết hoặc không có quyền ra lệnh; kế hoạch chỉ chạy sau khi đúng người bấm Duyệt.
- Lưu cấu hình Worker giữa chừng không làm đổi run đang chạy.
- Quản lý đọc hội thoại của nhân viên nhận `403`.

### GĐ 2 — Tri thức, phê duyệt, Chat Social

**Màn:** 22, 27, 39, 57, 70, 73–76, 94, 99, 105, 109–114, 116, 124, 131, 132, 133, 136, 137, 140, 141, 146, 147, 148. Thêm phần Knowledge của 16, 17, 130.

| WP | Hạng mục |
|---|---|
| 2.1 | Qdrant + pipeline Knowledge (trích PDF/OCR, cắt đoạn, BGE-M3). `knowledgeStore.search()` là cửa duy nhất vào Qdrant, lọc tài liệu Mật bằng tập `item_id` |
| 2.2 | Kho đầy đủ: Knowledge, Loại tài liệu (132, 133), trạng thái Đang dùng / Lưu trữ, cờ Mật. Nhập từ Kho hệ thống (131), Console › Kho hệ thống (39), phân phối theo ngành dọc. Thêm Knowledge vào Worker (124) |
| 2.3 | BYOK + két; mẫu Worker (B4); nút «Thử»; `knowledge.search`, `file.generate`, `image.generate`; trích dẫn trong hội thoại |
| 2.4 | Quy tắc duyệt (136, 137): chuỗi cấp, uỷ quyền, `on_overdue`. Hộp Chờ duyệt (22, 27) và Phê duyệt (76, 105, 111, 112). Một hành động sinh **một** yêu cầu duyệt (M8). Duyệt qua Telegram |
| 2.5 | Tài liệu Mật trong công việc: chạy lại với quyền bộ phận, duyệt chuyển (70, 109, 110) |
| 2.6 | Yêu cầu liên phòng (57, 73, 74, 75, 113); Worker tham gia dự án (99, 116); góp ý 👎 (94); đề xuất kết quả vào Kho (114) |
| 2.7 | **Chat Social** (§9.5.12): quản trị kênh (146–148), Workspace (140, 141). Webchat, Zalo OA, Facebook; WhatsApp khi Meta duyệt. Chỉ Worker gắn cờ; chỉ trả lời từ Knowledge được gán |

**Nghiệm thu:**
- Nạp một PDF, gắn cho 2 Worker: cả hai trả lời đúng; Worker thứ 3 không biết nội dung.
- Bật / tắt cờ Mật có hiệu lực ngay.
- Worker Chat Social không có đoạn Knowledge liên quan thì chuyển người; không bao giờ trích tài liệu Mật.
- Bước Workflow «Chờ người duyệt» và quy tắc duyệt cùng khớp chỉ sinh một yêu cầu duyệt.
- Yêu cầu từ phòng khác không nhận được số liệu Mật cho tới khi người phụ trách duyệt chuyển.

### GĐ 3 — Thanh toán, sử dụng, chat nội bộ

**Màn:** 2, 3, 4, 18, 19, 33, 41, 50, 90, 138, 139. Thêm phần chi phí của 5, 29, 72 và 80.

| WP | Hạng mục |
|---|---|
| 3.1 | Đo token đầy đủ, Ví theo lô (`credit_lots`) + ledger chỉ thêm, nạp token, ngân sách tháng và tự dừng. Mức sử dụng (18), số dư nhà cung cấp |
| 3.2 | PayOS VietQR + chuyển khoản kèm chứng từ, xác nhận thủ công (139, Console 41). Mua, gia hạn, đổi gói có tính phần còn lại (19, 138), phiếu thu PDF |
| 3.3 | Vòng đời thanh toán: nhắc gia hạn, ân hạn, `past_due` (90), tạm ngưng chỉ đọc (50). Console › Ví & sử dụng (33), Doanh thu |
| 3.4 | Tự đăng ký (2, 3, 4): giữ slug 30 phút, OTP email, thanh toán, tự dựng tenant |
| 3.5 | Thông báo qua email (B10), Sức khoẻ (B5), chi phí theo bộ phận và xuất CSV |
| 3.6 | Chat nội bộ giữa nhân sự (§25.4). Cần chốt quyền riêng tư trước khi làm |

**Điều kiện go-live thu tiền:** có PL1 (hoá đơn, bảo vệ dữ liệu cá nhân, điều khoản dịch vụ).

**Nghiệm thu:**
- Webhook lặp lại không cộng tiền hai lần.
- Chứng từ lệch số tiền không xác nhận được.
- Hết credit thì Worker dùng Platform dừng, Worker BYOK vẫn chạy.
- Một lần trừ đi qua nhiều lô sinh nhiều dòng ledger.

### GĐ 4 — Email & vận hành nâng cao

**Màn:** 21 · Hộp thư.

| WP | Hạng mục |
|---|---|
| 4.1 | Hộp thư tenant (Gmail, Microsoft 365, IMAP) + chốt chặn gửi; hộp thư cá nhân |
| 4.2 | Hành động `email.*`, `publish.post`, `http.call`, đi qua Phê duyệt |
| 4.3 | Xuất / nhập Worker (B7); xuất và xoá dữ liệu tenant (B8), huỷ tenant; khôi phục theo tenant (B11) |
| 4.4 | MFA cho Admin tenant và người dùng; tên miền riêng; OAuth quảng cáo |

**Nghiệm thu:**
- Worker soạn nháp vào Gmail thật.
- Gửi tới domain ngoài danh sách cho phép bị chặn bằng mã và có audit.
- Gửi trực tiếp phải qua duyệt.

---

## 4. Ma trận màn hình thiết kế → giai đoạn

148 board của bản thiết kế. «GĐ» là giai đoạn màn được làm. Dạng «1a → 2» nghĩa là làm ở 1a, bổ sung phần còn lại ở 2. Route là **đề xuất**, chốt trong bảng route ở GĐ 0b. Board 71 không có trong bản thiết kế.

Số màn theo giai đoạn bắt đầu: **0b**: 16 · **1a**: 18 · **1b**: 72 · **2**: 30 · **3**: 11 · **4**: 1.

| # | Board | Màn | Khu vực | Route đề xuất | GĐ | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | `Main` | Đăng nhập tenant — {slug}.ai-os.vn | Xác thực | `/login` | **0b** |  |
| 2 | `DangKy` | Đăng ký & chọn gói — ai-os.vn/dang-ky | Công khai | `ai-os.vn/dang-ky` | **3** | Tự đăng ký §4.3b |
| 3 | `XacThuc` | Xác thực email (OTP 6 số) | Công khai | `ai-os.vn/dang-ky/xac-thuc` | **3** | OTP email |
| 4 | `ThanhToanDangKy` | Thanh toán PayOS / VietQR | Công khai | `ai-os.vn/dang-ky/thanh-toan` | **3** | PayOS VietQR |
| 5 | `Dashboard` | Tổng quan Admin Portal | Admin | `/admin` | **0b → 1b → 3** | 0b khung + hạn mức; 1b khối Worker/việc; 3 chi phí |
| 6 | `OrgDonVi` | Sơ đồ tổ chức — theo đơn vị | Admin | `/admin/so-do?xem=don-vi` | **1a** |  |
| 7 | `OrgNganhDoc` | Sơ đồ tổ chức — theo ngành dọc | Admin | `/admin/so-do?xem=nganh-doc` | **1a** |  |
| 8 | `OrgMaTran` | Người dùng ↔ Worker | Admin | `/admin/so-do?xem=nguoi-worker` | **1b** | Cần có Worker |
| 9 | `DanhSachWorker` | Danh sách AI Worker | Admin | `/admin/worker` | **1b** |  |
| 10 | `Wizard1` | Trình tạo Worker B1 — Vị trí & danh tính | Admin | `/admin/worker/moi?b=1` | **1b** |  |
| 11 | `Wizard2` | Trình tạo Worker B2 — Bộ não | Admin | `/admin/worker/moi?b=2` | **1b** | BYOK ở GĐ 2 |
| 12 | `Wizard3` | Trình tạo Worker B3 — Chọn từ Kho KWSR | Admin | `/admin/worker/moi?b=3` | **1b** | Knowledge ở GĐ 2 |
| 13 | `Wizard4` | Trình tạo Worker B4 — Xem lại & thử | Admin | `/admin/worker/moi?b=4` | **1b** | Nút «Thử» ở GĐ 2 |
| 14 | `WorkerChiTiet` | Chi tiết Worker — Thông tin | Admin | `/admin/worker/:id` | **1b** |  |
| 15 | `WorkerRule` | Chi tiết Worker — Rule hiệu lực | Admin | `/admin/worker/:id/rule` | **1b** | Dùng rules-engine của 1a |
| 16 | `KhoKWSR` | Kho KWSR | Admin | `/admin/kho` | **1a → 2** | 1a Rule/Workflow/Skill; 2 Knowledge |
| 17 | `KhoChiTiet` | Kho KWSR — chi tiết mục & phiên bản | Admin | `/admin/kho/:id` | **1a → 2** |  |
| 18 | `MucSuDung` | Mức sử dụng | Admin | `/admin/muc-su-dung` | **3** | 1b chỉ có chi phí theo run |
| 19 | `GoiThanhToan` | Gói, gia hạn & nạp token | Admin | `/admin/goi` | **3** |  |
| 20 | `KetNoiAPI` | Kết nối API | Admin | `/admin/ket-noi` | **1b → 2** | 1b Platform; 2 BYOK |
| 21 | `HopThu` | Hộp thư email của tenant | Admin | `/admin/hop-thu` | **4** |  |
| 22 | `ChoDuyet` | Chờ duyệt (Decision Gate) | Admin | `/admin/cho-duyet` | **2** |  |
| 23 | `NguoiDung` | Người dùng & vai trò | Admin | `/admin/nguoi-dung` | **0b → 1a** | 0b mời tối thiểu; 1a đầy đủ |
| 24 | `NhatKyKiemToan` | Nhật ký kiểm toán | Admin | `/admin/nhat-ky` | **1a** | Ghi nhật ký từ 0a |
| 25 | `CaiDat` | Cài đặt tổ chức & thương hiệu · tab Tổ chức / Cài đặt trạng thái | Admin | `/admin/cai-dat?tab=to-chuc\|trang-thai` | **1a** | Mục Telegram: 1b |
| 26 | `MobileHome` | Mobile — Tổng quan | Admin mobile | `/admin (≤ 480px)` | **1b** |  |
| 27 | `MobileDuyet` | Mobile — Chờ duyệt | Admin mobile | `/admin/cho-duyet (≤ 480px)` | **2** |  |
| 28 | `ConsoleLogin` | Console — Đăng nhập & MFA bắt buộc | Console | `console…/login` | **0b** |  |
| 29 | `ConsoleDashboard` | Console — Dashboard | Console | `console…/` | **1b → 3** | Doanh thu ở 3 |
| 30 | `ConsoleTenant` | Console — Danh sách tenant | Console | `console…/tenant` | **0b** |  |
| 31 | `ConsoleTaoTenant` | Console — Tạo tenant | Console | `console…/tenant/moi` | **0b** |  |
| 32 | `ConsoleTenantTongQuan` | Console — Chi tiết tenant · Tổng quan | Console | `console…/tenant/:id` | **0b** |  |
| 33 | `ConsoleTenantVi` | Console — Chi tiết tenant · Ví & sử dụng | Console | `console…/tenant/:id/vi` | **3** |  |
| 34 | `ConsoleTenantNguoiDung` | Console — Chi tiết tenant · Người dùng | Console | `console…/tenant/:id/nguoi-dung` | **0b** |  |
| 35 | `ConsoleVoHieuHoa` | Console — Vô hiệu hoá tenant | Console | `modal trên chi tiết tenant` | **0b** |  |
| 36 | `ConsolePhienHoTro` | Console — Mở phiên hỗ trợ | Console | `modal trên chi tiết tenant` | **1b** |  |
| 37 | `PortalPhienHoTro` | Portal tenant trong phiên hỗ trợ (chỉ xem) | Admin | `/admin (phiên hỗ trợ)` | **1b** |  |
| 38 | `ConsoleGoiGia` | Console — Gói & Giá model | Console | `console…/goi-gia` | **1a → 3** | 1a gói & hạn mức; 3 giá & chiết khấu |
| 39 | `ConsoleKhoHeThong` | Console — Kho hệ thống | Console | `console…/kho-he-thong` | **2** | Dữ liệu khởi tạo bằng script từ 0b |
| 40 | `ConsoleKetNoiHeThong` | Console — Kết nối hệ thống | Console | `console…/ket-noi` | **1b** |  |
| 41 | `ConsoleThanhToan` | Console — Thanh toán & xác nhận thủ công | Console | `console…/thanh-toan` | **3** |  |
| 42 | `ConsoleNhanVien` | Console — Nhân viên hệ thống | Console | `console…/nhan-vien` | **0b** |  |
| 43 | `ConsoleNhatKy` | Console — Nhật ký hệ thống | Console | `console…/nhat-ky` | **0b** |  |
| 44 | `ConsoleSucKhoe` | Console — Sức khoẻ hệ thống | Console | `console…/suc-khoe` | **1b** |  |
| 45 | `NguoiDungThem` | Thêm người dùng (cửa sổ mở từ nút ＋) | Admin | `modal trên /admin/nguoi-dung` | **1a** |  |
| 46 | `NguoiDungChiTiet` | Chi tiết & sửa người dùng | Admin | `/admin/nguoi-dung/:id` | **1a → 1b** | Tab Quyền bổ sung, Hội thoại: 1b |
| 47 | `OrgTaoBoPhan` | Tạo bộ phận (đơn vị × ngành dọc) | Admin | `modal trên /admin/so-do` | **1a** |  |
| 48 | `WsHomNay` | Workspace — Hôm nay (trang chủ) | Workspace | `/` | **1b** |  |
| 49 | `WsChaoMung` | Workspace — Màn chào lần đầu (3 bước) | Workspace | `modal lần đầu trên /` | **1b** |  |
| 50 | `WsTamNgung` | Workspace — Workspace khi tenant tạm ngưng (chỉ đọc) | Workspace | `/ (tenant suspended)` | **3** |  |
| 51 | `WsVoHieu` | Workspace — Tổ chức bị vô hiệu hoá | Workspace | `/ (tenant bị vô hiệu)` | **0b** |  |
| 52 | `WsOrchestrator` | Workspace — Orchestrator — trình kế hoạch | Workspace | `/orchestrator` | **1b** |  |
| 53 | `WsOrchTheoDoi` | Workspace — Orchestrator — theo dõi & báo cáo tổng hợp | Workspace | `/orchestrator/:planId` | **1b** |  |
| 54 | `WsDanhBa` | Workspace — Danh bạ Worker | Workspace | `/worker` | **1b** |  |
| 55 | `WsHoSoWorker` | Workspace — Hồ sơ Worker — mức Trực tiếp | Workspace | `/worker/:id` | **1b** |  |
| 56 | `WsHoSoQuaYeuCau` | Workspace — Hồ sơ Worker — mức Qua yêu cầu | Workspace | `/worker/:id` | **1b** |  |
| 57 | `WsGuiYeuCau` | Workspace — Gửi yêu cầu tới Worker phòng khác | Workspace | `modal trên /worker/:id` | **2** | Yêu cầu liên phòng |
| 58 | `WsHoSoChiXem` | Workspace — Hồ sơ Worker — mức Chỉ xem | Workspace | `/worker/:id` | **1b** |  |
| 59 | `WsHoiThoai` | Workspace — Hội thoại với Worker | Workspace | `/hoi-thoai/:id` | **1b** | Trích dẫn Knowledge: 2 |
| 60 | `WsHoiThoaiLenh` | Workspace — Hội thoại — gõ / chọn lệnh | Workspace | `/hoi-thoai/:id` | **1b** |  |
| 61 | `WsCongViec` | Workspace — Công việc — Dashboard | Workspace | `/cong-viec` | **1b** |  |
| 62 | `WsDuAn` | Workspace — Công việc — Dự án | Workspace | `/cong-viec/du-an` | **1b** |  |
| 63 | `WsTaoDuAn` | Workspace — Tạo dự án | Workspace | `modal trên /cong-viec/du-an` | **1b** |  |
| 64 | `WsChiTietDuAn` | Workspace — Chi tiết dự án (thành viên, Worker tham gia) | Workspace | `/cong-viec/du-an/:id` | **1b** | Worker tham gia dự án: 2 |
| 65 | `WsPhieu` | Workspace — Công việc — Phiếu yêu cầu | Workspace | `/cong-viec/phieu` | **1b** |  |
| 66 | `WsViecCuaToi` | Workspace — Công việc — danh sách | Workspace | `/cong-viec/viec` | **1b** |  |
| 67 | `WsTaoViec` | Workspace — Tạo công việc (giao cho người hoặc Worker) | Workspace | `/cong-viec/viec/moi` | **1b** |  |
| 68 | `WsChiTietViec` | Workspace — Chi tiết công việc & nghiệm thu | Workspace | `/cong-viec/viec/:id` | **1b** |  |
| 69 | `WsDieuPhoi` | Workspace — Công việc — Điều phối (việc vướng) | Workspace | `/cong-viec/dieu-phoi` | **1b** |  |
| 70 | `WsDuyetChuyen` | Workspace — Duyệt chuyển kết quả có tài liệu Mật | Workspace | `/cong-viec/dieu-phoi/:id/duyet-chuyen` | **2** | Tài liệu Mật |
| 72 | `WsBaoCao` | Workspace — Công việc — Báo cáo | Workspace | `/cong-viec/bao-cao` | **1b → 3** | Chi phí theo bộ phận, CSV: 3 |
| 73 | `WsYeuCau` | Workspace — Yêu cầu liên phòng — đã gửi | Workspace | `/yeu-cau` | **2** |  |
| 74 | `WsYeuCauToi` | Workspace — Yêu cầu liên phòng — tới Worker tôi phụ trách | Workspace | `/yeu-cau?tab=toi-worker` | **2** |  |
| 75 | `WsTraLaiYeuCau` | Workspace — Trả lại yêu cầu liên phòng | Workspace | `modal trên /yeu-cau` | **2** |  |
| 76 | `WsPheDuyet` | Workspace — Phê duyệt | Workspace | `/phe-duyet` | **2** |  |
| 77 | `WsKetQua` | Workspace — Kết quả bàn giao | Workspace | `/ket-qua` | **1b** | Đề xuất vào Kho: 2 |
| 78 | `WsSoDo` | Workspace — Sơ đồ tổ chức (chỉ xem) | Workspace | `/so-do` | **1a** |  |
| 79 | `WsThongBao` | Workspace — Trung tâm thông báo | Workspace | `/thong-bao` | **1b** |  |
| 80 | `WsTaiKhoan` | Workspace — Tài khoản cá nhân | Workspace | `/tai-khoan` | **0b → 1b → 3** | 0b mật khẩu, phiên; 1b Telegram; 3 mức sử dụng |
| 81 | `AdQuyenNguoiDung` | Quản trị — quyền bổ sung & hội thoại của người dùng | Admin | `/admin/nguoi-dung/:id?tab=quyen` | **1b** |  |
| 82 | `AdChinhSachWorker` | Quản trị — chính sách nhận việc & tài liệu Mật | Admin | `/admin/worker/:id?tab=chinh-sach` | **1b** | Phần tài liệu Mật: 2 |
| 83 | `WsChatModal` | Workspace — Chat với Worker (cửa sổ mở từ danh bạ) | Workspace | `modal trên /worker` | **1b** |  |
| 84 | `WsHoSoModal` | Workspace — Hồ sơ Worker (cửa sổ mở từ hội thoại) | Workspace | `modal trên /hoi-thoai/:id` | **1b** |  |
| 85 | `WsTaoViecModal` | Workspace — Tạo công việc (cửa sổ mở từ hội thoại) | Workspace | `modal trên /hoi-thoai/:id` | **1b** |  |
| 86 | `WsHoiThoaiMoi` | Workspace — Hội thoại mới (chọn Worker / nhân sự) | Workspace | `modal trên /hoi-thoai` | **1b** | Mục «Nhân sự nội bộ» ẩn tới GĐ 3 |
| 87 | `WsQuenMatKhau` | Xác thực — Quên mật khẩu (/quen-mat-khau) | Xác thực | `/quen-mat-khau` | **0b** |  |
| 88 | `WsDoiMatKhau` | Xác thực — Đổi mật khẩu lần đầu (/doi-mat-khau) | Xác thực | `/doi-mat-khau` | **0b** |  |
| 89 | `WsNhanLoiMoi` | Xác thực — Nhận lời mời (/moi/:token) | Xác thực | `/moi/:token` | **0b** |  |
| 90 | `WsQuaHan` | Workspace — banner quá hạn thanh toán (past_due) | Workspace | `banner (past_due)` | **3** |  |
| 91 | `WsViewer` | Workspace — người dùng vai trò Người xem (chỉ đọc) | Workspace | `/ (vai trò viewer)` | **1b** |  |
| 92 | `WsHoiThoaiDangViet` | Workspace — Hội thoại: Worker đang trả lời (hiện dần, nút Dừng) | Workspace | `/hoi-thoai/:id` | **1b** |  |
| 93 | `WsHoiThoaiTamDung` | Workspace — Hội thoại khi Worker tạm dừng (ô nhập khoá, nêu lý do) | Workspace | `/hoi-thoai/:id` | **1b** |  |
| 94 | `WsGopY` | Workspace — 👎 Góp ý câu trả lời (chia sẻ cho người phụ trách) | Workspace | `modal trên /hoi-thoai/:id` | **2** |  |
| 95 | `WsHoiThoaiLuuTru` | Workspace — Đổi tên, lưu trữ, xoá & khôi phục hội thoại | Workspace | `/hoi-thoai` | **1b** |  |
| 96 | `WsOrchSuaKeHoach` | Workspace — Orchestrator: sửa kế hoạch trước khi giao | Workspace | `/orchestrator/:planId/sua` | **1b** |  |
| 97 | `WsTaoPhieu` | Workspace — Tạo phiếu yêu cầu trong dự án | Workspace | `modal trên dự án` | **1b** |  |
| 98 | `WsThemThanhVien` | Workspace — Thêm người vào dự án | Workspace | `modal trên dự án` | **1b** |  |
| 99 | `WsMoiWorker` | Workspace — PM mời Worker vào dự án | Workspace | `modal trên dự án` | **2** |  |
| 100 | `WsSuaDuAn` | Workspace — Sửa thông tin dự án | Workspace | `modal trên dự án` | **1b** |  |
| 101 | `WsChiTietPhieu` | Workspace — Chi tiết phiếu yêu cầu | Workspace | `/cong-viec/phieu/:id` | **1b** |  |
| 102 | `WsBaoCaoTienDo` | Workspace — Nhập báo cáo tiến độ | Workspace | `modal trên chi tiết việc` | **1b** |  |
| 103 | `WsLamLai` | Workspace — Nghiệm thu: trả về làm lại kèm góp ý | Workspace | `modal trên chi tiết việc` | **1b** |  |
| 104 | `WsHuyViec` | Workspace — Tạm dừng hoặc huỷ việc (lý do bắt buộc) | Workspace | `modal trên chi tiết việc` | **1b** |  |
| 105 | `WsViecChoDuyet` | Workspace — Công việc đang chờ duyệt (ai đang giữ) | Workspace | `/cong-viec/viec?trang-thai=cho-duyet` | **2** |  |
| 106 | `WsDoiNguoi` | Workspace — Đổi người thực hiện (Điều phối, Yêu cầu liên phòng) | Workspace | `modal trên Điều phối` | **1b** | Từ Yêu cầu liên phòng: 2 |
| 107 | `WsSuaDauBai` | Workspace — Sửa đầu bài rồi chạy lại | Workspace | `modal trên Điều phối` | **1b** |  |
| 108 | `WsDongViec` | Workspace — Đóng việc vướng kèm lý do | Workspace | `modal trên Điều phối` | **1b** |  |
| 109 | `WsCheSoLieu` | Workspace — Duyệt chuyển: sửa / che số liệu Mật | Workspace | `modal trên Duyệt chuyển` | **2** |  |
| 110 | `WsKhongCungCap` | Workspace — Duyệt chuyển: trả lời không cung cấp được | Workspace | `modal trên Duyệt chuyển` | **2** |  |
| 111 | `WsTuChoiDuyet` | Workspace — Phê duyệt: từ chối kèm góp ý | Workspace | `modal trên /phe-duyet` | **2** |  |
| 112 | `WsSuaRoiDuyet` | Workspace — Phê duyệt: sửa rồi duyệt | Workspace | `modal trên /phe-duyet` | **2** |  |
| 113 | `WsTamDungYeuCau` | Workspace — Tạm dừng yêu cầu liên phòng tới Worker tôi phụ trách | Workspace | `modal trên /yeu-cau` | **2** |  |
| 114 | `WsDeXuatKho` | Workspace — Đề xuất đưa kết quả vào Kho KWSR | Workspace | `modal trên /ket-qua` | **2** |  |
| 115 | `WsXemKetQua` | Workspace — Xem kết quả, lịch sử & so sánh phiên bản | Workspace | `/ket-qua/:id` | **1b** |  |
| 116 | `WsRutWorker` | Workspace — Người phụ trách: giữ / rút Worker khỏi dự án, bật tài liệu Mật | Workspace | `modal trên dự án` | **2** |  |
| 117 | `WsMobileHomNay` | Workspace mobile — Hôm nay | Workspace mobile | `/ (≤ 480px)` | **1b** |  |
| 118 | `WsMobileChat` | Workspace mobile — Hội thoại với Worker | Workspace mobile | `/hoi-thoai/:id (≤ 480px)` | **1b** |  |
| 119 | `WsMobileNghiemThu` | Workspace mobile — Nghiệm thu kết quả | Workspace mobile | `/cong-viec/viec/:id (≤ 480px)` | **1b** |  |
| 120 | `AdThemTrangThai` | Quản trị — Cài đặt trạng thái: thêm / sửa trạng thái (mở từ board 25) | Admin | `modal trên Cài đặt trạng thái` | **1a** |  |
| 121 | `MoHinhAI` | Quản trị — Mô hình AI (danh mục model được phép dùng) | Admin | `/admin/mo-hinh` | **1b** |  |
| 122 | `WkDoiModel` | Chi tiết Worker — Đổi model (chỉ model đã bật) | Admin | `modal trên chi tiết Worker` | **1b** |  |
| 123 | `WkSuaWorker` | Chi tiết Worker — Sửa Worker (một trang: danh tính, bộ não, ngân sách, K·W·S·R, tài liệu) | Admin | `/admin/worker/:id/sua` | **1b** | Mục tài liệu: 2 |
| 124 | `WkThemKN` | Chi tiết Worker — Thêm Knowledge từ Kho | Admin | `modal trên Sửa Worker` | **2** |  |
| 125 | `WkThemWF` | Chi tiết Worker — Thêm Workflow từ Kho | Admin | `modal trên Sửa Worker` | **1b** |  |
| 126 | `WkThemSK` | Chi tiết Worker — Thêm Skill từ Kho | Admin | `modal trên Sửa Worker` | **1b** |  |
| 127 | `OrchCauHinh` | Quản trị — Cấu hình Orchestrator (Model · Rule · Ngân sách) | Admin | `/admin/orchestrator` | **1a → 1b** | 1a Rule toàn công ty; 1b model, ngân sách |
| 128 | `OrchThemRule` | Quản trị — Orchestrator: thêm Rule toàn công ty (có thời gian áp dụng) | Admin | `modal trên /admin/orchestrator` | **1a** |  |
| 129 | `OrgDoiDonViCha` | Sơ đồ tổ chức — Đổi đơn vị cha | Admin | `modal trên /admin/so-do` | **1a** |  |
| 130 | `KhoTaoMuc` | Kho KWSR — Tạo mục (Knowledge · Workflow · Skill · Rule) | Admin | `/admin/kho/moi` | **1a → 2** | Knowledge: 2 |
| 131 | `KhoNhapHeThong` | Kho KWSR — Nhập từ Kho hệ thống | Admin | `/admin/kho/nhap` | **2** |  |
| 132 | `CdThemLoaiTL` | Cài đặt › Kho KWSR — Thêm loại tài liệu | Admin | `modal trên Cài đặt › Kho KWSR` | **2** |  |
| 133 | `CdSuaLoaiTL` | Cài đặt › Kho KWSR — Sửa loại tài liệu | Admin | `modal trên Cài đặt › Kho KWSR` | **2** |  |
| 134 | `CdThemLoaiBuoc` | Cài đặt › Kho KWSR — Thêm / sửa loại bước Workflow | Admin | `modal trên Cài đặt › Kho KWSR` | **1a** |  |
| 135 | `DanhSachWorkerList` | Danh sách AI Worker — dạng danh sách (Orchestrator ghim đầu) | Admin | `/admin/worker?xem=danh-sach` | **1b** |  |
| 136 | `CaiDatQuyTac` | Cài đặt — tab Quy tắc duyệt | Admin | `/admin/cai-dat?tab=quy-tac-duyet` | **2** |  |
| 137 | `CdQuyTacDuyet` | Cài đặt — Thêm / sửa quy tắc duyệt | Admin | `modal trên Quy tắc duyệt` | **2** |  |
| 138 | `GtDoiGoi` | Gói & thanh toán — Đổi gói | Admin | `/admin/goi/doi-goi` | **3** |  |
| 139 | `TtDaChuyenKhoan` | Thanh toán — Gửi chứng từ chuyển khoản | Admin | `modal trên /admin/goi` | **3** |  |
| 140 | `WsChatSocial` | Workspace — Chat Social (Worker tự trả lời) | Workspace | `/chat-social` | **2** |  |
| 141 | `WsChatSocialTay` | Workspace — Chat Social (nhân viên dừng tay, trả lời nhanh) | Workspace | `/chat-social/:id` | **2** |  |
| 142 | `WsDanhBaList` | Workspace — Danh bạ Worker (dạng danh sách) | Workspace | `/worker?xem=danh-sach` | **1b** |  |
| 143 | `WsSoDoQuanHe` | Workspace — Sơ đồ: Người dùng ↔ Worker | Workspace | `/so-do?xem=nguoi-worker` | **1b** |  |
| 144 | `KetNoiAPIList` | Kết nối API (dạng danh sách) | Admin | `/admin/ket-noi?xem=danh-sach` | **1b** |  |
| 145 | `WsSoDoTheoWorker` | Workspace — Sơ đồ: Worker ↔ người phụ trách (theo Worker) | Workspace | `/so-do?xem=theo-worker` | **1b** |  |
| 146 | `AdChatSocial` | Quản trị — Chat Social: kênh kết nối & phân quyền | Admin | `/admin/chat-social` | **2** |  |
| 147 | `AdChatSocialKetNoi` | Quản trị — Chat Social: kết nối / cấu hình kênh | Admin | `/admin/chat-social/:kenh` | **2** |  |
| 148 | `AdChatSocialQuyen` | Quản trị — Chat Social: thêm / sửa quyền | Admin | `modal trên /admin/chat-social` | **2** |  |
| 149 | `KhoTaoMucRule` | Kho KWSR — Tạo mục Rule (điều kiện kiểm bằng mã) | Admin | `/admin/kho/moi?loai=rule` | **1a** | Trình dựng hardCheck |

---

## 5. Việc chuẩn bị ngoài code

| Việc | Cần xong trước | Ai làm |
|---|---|---|
| Server riêng (≥ 4 vCPU / 16 GB / 200 GB SSD), Docker | Cuối 0a (staging) | Vận hành |
| DNS: wildcard `*.ai-os.vn`, `console`, `staging`; API token DNS cho Caddy (DNS-01). Giữ bản ghi `workers.ai-os.vn` cho bản demo | Cuối 0a | Vận hành |
| Chỗ lưu sao lưu ngoài server | 0b | Vận hành |
| Resend hoặc SMTP; SPF, DKIM, DMARC cho domain gửi thư | 0b | Vận hành |
| Khoá OpenRouter của Platform, nạp tiền | 1b | Bạn |
| Tạo Bot Telegram thử bằng @BotFather | 1b | Bạn |
| Đăng ký ứng dụng Zalo OA và Meta (Messenger; WhatsApp cần xác minh doanh nghiệp) | **Bắt đầu từ 1a**, cần cho 2 | Bạn |
| Bộ tài liệu Knowledge mẫu và bộ Kho hệ thống (Rule / Workflow / Skill theo ngành) | 1a (Rule / Workflow / Skill), 2 (Knowledge) | Bạn + nghiệp vụ |
| Merchant PayOS (sandbox → thật) | 3 | Bạn |
| Bảng giá gói, chiết khấu chu kỳ, credit tặng, hệ số giá token | 3 (nhập trên Console) | Bạn |
| Thông tin bên bán cho phiếu thu; **PL1** (hoá đơn điện tử, dữ liệu cá nhân, điều khoản) | Trước khi thu tiền thật | Bạn + pháp lý |
| Ứng dụng OAuth Google (xác minh quyền Gmail) và Microsoft | **Bắt đầu từ 2**, cần cho 4 | Bạn |

---

## 6. Điểm lệch giữa bản thiết kế (03/11) và tài liệu Admin v2.2

Bản thiết kế đã sửa phần lớn các điểm tôi nêu lần trước:
- Số liệu gói đã khớp: Starter / Standard / Business.
- Bỏ gói «Pro».
- Bỏ chế độ «Tự giao».
- Bỏ dòng «trong phạm vi quyền của bạn».
- Thêm trình dựng `hardCheck`.
- Sửa dữ liệu mẫu ở Sơ đồ, bỏ TripX.

Hai điểm L2 và L4 đã chốt trong Admin v2.2. L1 và L3 là chỗ **thiết kế** còn khác quyết định đã chốt (M3, M6): tài liệu giữ nguyên quyết định, khi làm màn đó sẽ code theo tài liệu; bạn sửa thiết kế khi tiện. Không điểm nào chặn GĐ 0a.

| # | Board | Thiết kế đang thể hiện | Tài liệu v2.2 | Đề xuất | Cần chốt trước |
|---|---|---|---|---|---|
| L1 | 127, 128 | «⟳ Đang đồng bộ 5/7», «đồng bộ 7 Worker», «Worker được đồng bộ gỡ Rule» | M3: không có bước đồng bộ; trạng thái Rule là Đang hiệu lực / Lên lịch / Hết hiệu lực | Giữ M3 (tài liệu v2.2 đã viết theo M3). Thiết kế cần sửa: thay cột «đồng bộ» bằng trạng thái hiệu lực + số Worker chịu ảnh hưởng | 1a |
| L2 | 128, 130, 149 | Năm cách xử lý khi `hardCheck` vi phạm | — | **Đã chốt** (M13, §24.18): `onViolation` = `deny` · `approval` · `reschedule` · `ask` · `warn`; §9.5.4 đã cập nhật theo | — |
| L3 | 138 | Dòng **VAT** và phương thức **«Trừ từ Ví credit»** | M6: chưa ghi VAT tới khi có hoá đơn điện tử (PL1); không trả gói bằng Ví | Theo tài liệu: bỏ hai dòng này, hoặc để sau cờ tắt cho tới khi có PL1 | 3 |
| L4 | 38, 138 | Chu kỳ 1 / 6 / 12 tháng có chiết khấu | — | **Đã chốt** (M14): theo thiết kế; tài liệu đã sửa | — |
| L5 | 86 | Modal hội thoại mới có mục «Nhân sự (nội bộ)» | M11: GĐ 3 | Giữ trong thiết kế; mã ẩn mục này tới GĐ 3 | — |

Tệp Admin bạn gửi lại ngày 03/11 được sửa từ bản v2.0, nên đã được gộp 3 chiều vào v2.1 thành **v2.2**, không chép đè.

---

## 7. Bước tiếp theo

1. Viết `docs/plan/GD-0a.md`. Nội dung:
   - Từng WP với đầu vào và đầu ra.
   - Danh sách tệp tạo mới.
   - Migration `0001_core.sql` đầy đủ.
   - Bộ token CSS rút từ thiết kế.
   - Danh sách thành phần `js/ui/` kèm board tham chiếu.
   - Cấu hình CI.
   - Kịch bản kiểm thử nghiệm thu.
2. Bắt đầu viết mã GĐ 0a sau khi bạn duyệt `GD-0a.md`.
