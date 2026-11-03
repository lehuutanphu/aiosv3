# AI OS Workspace — Tài liệu mô tả & thiết kế Không gian làm việc của người dùng

> **Phiên bản:** v2.1 (03/11/2026) — gộp v2.0 (cập nhật theo thiết kế giao diện, [§21](#21-cập-nhật-theo-thiết-kế-giao-diện-v20--112026)) với v1.1 (U13, RLS cho nội dung riêng tư, `feedback_shares`, lộ trình 0a–1b) và áp quyết định 03/11 (tài liệu Admin §25). Đã chốt U1–U15. Thứ tự ưu tiên khi đọc: **tài liệu Admin §25 → §21 → các chương trước**.
> **Lịch sử:** v1.0 bản đặc tả để thiết kế. v2.0 đưa các điều chỉnh chức năng và logic phát hiện khi thiết kế giao diện vào tài liệu: thêm **Chat Social** (luôn có, quyền theo kênh do Admin cấp), luồng Orchestrator có ngữ cảnh và duyệt từng việc, đổi điều hướng (Dashboard, Yêu cầu liên phòng, gỡ Nhân sự & Worker), sơ đồ Người dùng ↔ Worker, trạng thái cấu hình được, quy tắc duyệt tập trung. Logic dùng chung Console · Admin · Workspace ở tài liệu Admin §24.0. v2.1: chuỗi công việc tự chạy tiếp (§8.7); Chat Social chỉ cho Worker gắn cờ, chỉ trả lời từ Knowledge được gán, GĐ 2; Telegram Bot ra lệnh Orchestrator (GĐ 1b); chat nội bộ giữa nhân sự dời sang GĐ 3; bỏ hẳn mọi tham chiếu tới bản demo.
> **Phạm vi:** thiết kế, chưa viết code. Đây là **tài liệu thứ hai**, đi cặp với [`ADMIN_PORTAL_DESIGN.md`](ADMIN_PORTAL_DESIGN.md) (gọi tắt **tài liệu Admin**). Phần nào tài liệu Admin đã đặc tả thì ở đây chỉ dẫn chiếu, không viết lại.
> **Nguồn giao diện:** bản thiết kế giao diện Admin · Console · Workspace (canvas thiết kế, board 01–148). Mã giao diện viết mới theo thiết kế (tài liệu Admin §3.2, R1).

---

## 0. Tóm tắt

### 0.1 Bức tranh chung

- **Tenant được tạo và cấu hình ở trang quản trị** `tenantabc.ai-os.vn/admin`: tạo Worker, nạp Kho KWSR, kết nối, người dùng (tài liệu Admin).
- **Người dùng cuối đăng nhập cùng địa chỉ** `tenantabc.ai-os.vn` bằng username (hoặc email) và mật khẩu được cấp, hoặc tự đặt qua lời mời. Sau khi đăng nhập, họ vào **Không gian làm việc** (gọi tắt **Workspace**): chat với Worker, giao việc, theo dõi dự án và công việc. Đây là nơi tạo ra giá trị cho doanh nghiệp.
- **Workspace và Quản trị là hai khu vực của cùng một trang**, dùng chung một lần đăng nhập. Người dùng thường không bao giờ thấy khu vực Quản trị.
- **Người dùng thấy toàn bộ Worker đang hoạt động** trong danh bạ, nhưng **giao việc theo mức quyền** (Trực tiếp / Qua yêu cầu / Chỉ xem). Worker chưa được tạo hoặc chưa kích hoạt thì không hiện.
- **Mọi đường giao việc** (Orchestrator, chat, dự án, yêu cầu sang phòng khác) đều tạo ra cùng một đối tượng **Công việc**, và quyền được kiểm ở **một chỗ duy nhất**.

### 0.2 Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| U1 | Cấu trúc | Cùng host `tenantabc.ai-os.vn`: Workspace ở `/`, Quản trị ở `/admin`. Người dùng thường không thấy Quản trị |
| U2 | Quản lý công việc | **Tính năng lõi cho mọi tenant**: Dự án, Phiếu yêu cầu, Công việc, Điều phối, Báo cáo, **Dashboard** (trước gọi là Phòng điều hành) |
| U3 | Bản demo | Hệ thống **xây mới theo kế hoạch**. Mã nguồn, module nghiệp vụ và dữ liệu của bản demo không được dùng lại và không mô tả trong tài liệu này (tài liệu Admin R1). Workspace không có module nghiệp vụ riêng: mọi việc đi qua Công việc và Worker |
| U4 | Portal khách hàng | **Bỏ hẳn** khỏi cả hai tài liệu |
| U5 | Riêng tư hội thoại | Hội thoại của ai người đó xem. **Quản lý không xem được.** Chỉ `tenant_admin` xem được, và mỗi lần xem đều **ghi nhật ký**. **Phiên hỗ trợ của SuperAdmin không đọc được hội thoại** |
| U6 | Thấy Worker | **Phương án C**: thấy tất cả Worker đang hoạt động; giao việc theo 3 mức quan hệ |
| U7 | Chính sách nhận việc | Admin đặt cho từng Worker: **Mở / Theo bộ phận / Hạn chế** (mặc định Theo bộ phận) |
| U8 | Orchestrator | Việc giao qua Orchestrator **luôn chạy ở mức "Mở"**, bỏ qua chính sách nhận việc. Đổi lại, **chỉ người được cấp quyền mới ra lệnh được cho Orchestrator** (thường là CEO, Phó TGĐ). Rule vẫn áp dụng đầy đủ. Ngoại lệ duy nhất là Worker nhạy cảm đặt «không nhận lệnh từ Orchestrator» (U13) |
| U9 | Yêu cầu từ phòng khác | **Tự nhận và báo** cho người phụ trách Worker |
| U10 | Tài liệu Mật | Cờ **"Mật"** chỉ áp cho tài liệu **Knowledge**: chỉ bộ phận sở hữu Worker và Orchestrator được dùng. **Workflow, Skill, Rule luôn áp dụng đầy đủ** cho mọi người, để quy trình không bị hở. Quản lý cấp trên trong phạm vi được dùng trực tiếp |
| U11 | Chat Social | **GĐ 2.** **Luôn có** cho mọi tenant, không tính hạn mức gói; **chỉ Worker gắn cờ Chat Social** tự trả lời, chỉ từ Knowledge gắn cho nó (tài liệu Admin §9.5.12); quyền xem / trả lời theo kênh do Admin cấp (Admin §24.17). Hộp thư chung cho tin nhắn khách hàng từ Zalo OA, Facebook, Webchat, WhatsApp…; Worker tự trả lời, nhân viên **Dừng tay** để tự trả lời từng cuộc chat (§21.2) |
| U12 | Điều hướng | Dashboard thay Phòng điều hành; "Yêu cầu" đổi thành **Yêu cầu liên phòng**; Dự án là tab trong Công việc; **bỏ hẳn Nhân sự & Worker**; trang chi tiết có nút về danh sách (§21.1) |
| U13 | Worker nhạy cảm | Mỗi Worker có tuỳ chọn **«Không nhận lệnh từ Orchestrator»** (`accept_from_orchestrator`, mặc định vẫn nhận). Worker đặt tắt thì Orchestrator **không giao được**, kể cả cho người có quyền ra lệnh; người dùng vẫn giao qua các đường ②③④ theo mức quan hệ bình thường (§6.2) |
| U14 | Chuỗi công việc | Việc kế tiếp **tự bắt đầu** khi việc trước xong phần thực hiện (hoặc tới giờ bắt đầu đã hẹn); không dừng chờ nghiệm thu từng bước trừ khi đặt điểm kiểm tra; bước vướng hiện rõ trên chuỗi và tự chạy tiếp khi xử lý xong (§8.7) |
| U15 | Telegram | Người có quyền ra lệnh Orchestrator ra lệnh qua **Telegram Bot** của tổ chức; kế hoạch gửi về Telegram và **chỉ chạy khi đúng người bấm Duyệt**; Telegram cũng là kênh nhận báo cáo (GĐ 1b; duyệt quy tắc duyệt qua Telegram từ GĐ 2) (tài liệu Admin §25.2) |

---

## 1. Thuật ngữ

Dùng chung thuật ngữ với tài liệu Admin §1. Bổ sung:

| Thuật ngữ | Nghĩa |
|---|---|
| **Workspace** | Không gian làm việc của người dùng tại `tenantabc.ai-os.vn/` |
| **Danh bạ Worker** | Danh sách mọi Worker đang hoạt động trong tenant, ai cũng xem được |
| **Mức quan hệ** | Quan hệ giữa một người dùng và một Worker: **Trực tiếp**, **Qua yêu cầu**, **Chỉ xem** (§5) |
| **Chính sách nhận việc** | Cấu hình của từng Worker do Admin đặt: **Mở**, **Theo bộ phận**, **Hạn chế** |
| **Quyền ra lệnh Orchestrator** | Quyền cấp riêng cho từng người, không gắn với vai trò (§6) |
| **Hội thoại** | Chuỗi tin nhắn giữa một người dùng và một Worker |
| **Công việc** | Đơn vị việc có người yêu cầu, người thực hiện (người hoặc Worker), hạn, báo cáo, kết quả |
| **Người yêu cầu** | Người tạo ra công việc và **nghiệm thu** kết quả |
| **Người phụ trách Worker** | Nhân sự chịu trách nhiệm về Worker (`worker.ownerUserId`); nhận thông báo và xử lý khi việc của Worker bị vướng |
| **Kết quả bàn giao** | Văn bản, tệp, ảnh mà Worker hoặc người tạo ra cho một công việc |
| **Tài liệu Mật** | Mục Knowledge có cờ `confidential` (§11) |
| **Phạm vi quản lý** | Các bộ phận mà một `unit_manager` hoặc `function_head` quản lý (tài liệu Admin §5, §8) |

---

## 2. Ranh giới Workspace và Quản trị

### 2.1 Phân chia

| | **Workspace** `tenantabc.ai-os.vn/` | **Quản trị** `tenantabc.ai-os.vn/admin` |
|---|---|---|
| Mục đích | Làm việc: chat, giao việc, theo dõi, nghiệm thu | Cấu hình: Worker, Kho KWSR, kết nối, người dùng, thanh toán |
| Ai vào được | Mọi người dùng đang hoạt động | `tenant_admin`, `unit_manager`, `function_head` (trong phạm vi) |
| Worker | Xem hồ sơ (chỉ đọc), chat, giao việc | Tạo, sửa, KWSR, chính sách nhận việc, ngân sách |
| Đặc tả | **Tài liệu này** | Tài liệu Admin |

**Chuyển khu vực:** người có quyền Quản trị thấy nút **"⚙ Quản trị"** ở góc trên Workspace và nút **"← Về Workspace"** ở trang Quản trị. Hệ thống nhớ khu vực dùng gần nhất của từng người để mở lại lần sau.

### 2.2 Xây mới, không chuyển đổi từ bản demo

Workspace được **viết mới** theo bản thiết kế giao diện (U3, tài liệu Admin R1). Từ bản demo chỉ giữ lại **ý tưởng**: ra lệnh cho Orchestrator, chat với Worker, mô hình Dự án → Phiếu yêu cầu → Công việc → Báo cáo, Điều phối việc vướng. Mọi số liệu trên màn hình lấy từ dữ liệu thật; không có dữ liệu mẫu hay hoạt động mô phỏng.

---

## 3. Đăng nhập và vào Workspace

Đăng nhập, quên mật khẩu, nhận lời mời, đổi mật khẩu lần đầu: theo tài liệu Admin §4.4 và §6.

**Sau khi đăng nhập:**
- Mọi vai trò đều vào **Workspace** (`/`), trừ khi người đó dùng Quản trị gần nhất.
- `viewer` vào Workspace ở chế độ chỉ đọc (§12).

**Lần đăng nhập đầu tiên:** hiện màn chào ngắn 3 bước, bỏ qua được:
1. Bạn thuộc bộ phận nào, người quản lý là ai.
2. Các Worker bạn dùng **trực tiếp** được.
3. Cách giao việc: chat, gửi yêu cầu sang phòng khác, giao trong dự án.

**Banner theo trạng thái tenant** (tài liệu Admin §22.7):

| Trạng thái | Workspace |
|---|---|
| `past_due` | Banner vàng nhắc gia hạn (chỉ Admin thấy nút Gia hạn) |
| `suspended` | Banner đỏ, **chỉ đọc**: xem được hội thoại, công việc, kết quả; không chat, không giao việc |
| `disabled` | Không đăng nhập được (trang thông báo) |

---

## 4. Sơ đồ màn hình Workspace

### 4.1 Cây màn hình

```
tenantabc.ai-os.vn
├─ /login · /quen-mat-khau · /doi-mat-khau · /moi/:token
├─ /                     Hôm nay (trang chủ)                                   §4.3
├─ /orchestrator         Ra lệnh cho Orchestrator (chỉ người có quyền)          §6
├─ /worker               Danh bạ Worker                                         §5
│   └─ /worker/:id       Hồ sơ Worker (chỉ đọc) · Chat · Gửi yêu cầu
├─ /hoi-thoai            Hội thoại của tôi                                      §7
│   └─ /hoi-thoai/:id
├─ /chat-social         Tin nhắn khách hàng từ các kênh social · Worker tự trả lời · Dừng tay   §21.2
├─ /cong-viec            Quản lý công việc                                      §8
│   ├─ Dashboard         tổng quan trong phạm vi của tôi (trước: Phòng điều hành)
│   ├─ Dự án             danh sách · chi tiết (thành viên, Worker tham gia, phiếu, tiến độ)
│   ├─ Phiếu yêu cầu     bấm mã phiếu sổ danh sách công việc · chi tiết phiếu
│   ├─ Công việc         việc của tôi · việc tôi giao · việc của Worker tôi phụ trách
│   ├─ Điều phối         việc đang vướng cần xử lý
│   └─ Báo cáo
├─ /yeu-cau              Yêu cầu liên phòng: tôi đã gửi · gửi tới Worker tôi phụ trách   §9
├─ /phe-duyet            Hộp chờ duyệt (theo Quy tắc duyệt của Admin)            §13, §21.8
├─ /ket-qua              Kết quả bàn giao và tệp                                §10
├─ /so-do                Sơ đồ tổ chức (chỉ xem) · Người dùng ↔ Worker          §4.2, §21.6
├─ /thong-bao            Trung tâm thông báo                                    §14
└─ /tai-khoan            Hồ sơ · mật khẩu · phiên đăng nhập · hộp thư cá nhân · thông báo   §15
```

Thanh bên trái của Workspace gồm: **Hôm nay · Orchestrator** (nếu có quyền) **· Worker · Hội thoại · Chat Social · Công việc · Yêu cầu liên phòng · Phê duyệt · Kết quả · Sơ đồ**, nhóm dưới **Thông báo · Tài khoản**. Mỗi mục có bộ đếm việc cần xử lý. Màn "Nhân sự & Worker" đã **bỏ hẳn** (§21.1).

### 4.2 Sơ đồ tổ chức (chỉ xem)

Dùng lại 3 chế độ xem của tài liệu Admin §8.5 (theo đơn vị, theo ngành dọc, **Người dùng ↔ Worker**), nhưng **không có thao tác sửa**. Chế độ Người dùng ↔ Worker không còn là ma trận; xem cách hiển thị và 4 mức quan hệ (👑 Phụ trách · ✔ Trực tiếp · ✉ Qua yêu cầu · 👁 Chỉ xem) ở §21.6. Bấm vào một Worker thì mở hồ sơ Worker (§5.4). Mỗi Worker có nhãn mức quan hệ của người đang xem (✔ Trực tiếp / ✉ Qua yêu cầu / 👁 Chỉ xem).

### 4.3 Trang "Hôm nay"

```
Chào buổi sáng, Ngô Thanh Mai · Kinh doanh – CN Hà Nội                       🔔 3   ⚙ Quản trị
┌ Cần tôi xử lý ─────────────────────────────────────────────────────────────────────────────┐
│ ✅ 2 việc chờ tôi nghiệm thu            ⏰ 1 việc trễ hạn                ✋ 1 phê duyệt chờ │
│ 🧭 1 việc của Worker tôi phụ trách đang vướng (Điều phối)                                    │
│ ✉ 3 yêu cầu mới từ phòng khác gửi tới Sales Agent (đã tự nhận)                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Việc của tôi hôm nay ───────────────────────┐ ┌ Worker tôi dùng trực tiếp ───────────────────┐
│ ▸ Soạn email cập nhật tiến độ  🤖 Sales  50%│ │ 💼 Sales Agent        ● sẵn sàng   [Chat]     │
│ ▸ Rà phụ lục HĐ 878            🤖 Legal  ⏳ │ │ 🧲 Lead Agent         ● đang chạy  [Chat]     │
│ ▸ Khảo sát hạ tầng KH          👤 tôi    0% │ │ Xem toàn bộ danh bạ →                          │
└─────────────────────────────────────────────┘ └────────────────────────────────────────────────┘
┌ Hội thoại gần đây ──────────────────────────────────────────────────────────────────────────┐
│ 💼 Sales Agent · "Báo giá cho khách Hưng Thịnh…" · 10 phút trước                             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Mọi khối chỉ lấy dữ liệu **trong phạm vi người đó được thấy** (§12). Không có số liệu mô phỏng.

---

## 5. Danh bạ Worker và mức quan hệ

### 5.1 Worker nào hiện trong danh bạ

| Trạng thái Worker (tài liệu Admin §9.4) | Hiện trong danh bạ |
|---|---|
| `draft` (đang tạo, chưa kích hoạt) | ✖ |
| `active` | ✔ |
| `paused` (tạm dừng, hết ngân sách, hết credit) | ✔ **mờ**, kèm lý do và người phụ trách; không chat, không giao việc được |
| `archived` | ✖ |
| Orchestrator | Không hiện như một Worker để chat. Truy cập qua màn Orchestrator (§6), chỉ với người có quyền |

### 5.2 Ba mức quan hệ

| Mức | Chat | Giao việc | Worker dùng tài liệu **Mật** của nó | Ghi chú |
|---|:-:|:-:|:-:|---|
| **✔ Trực tiếp** | ✔ | ✔ chạy ngay | ✔ nếu người dùng **thuộc bộ phận** của Worker hoặc **quản lý cấp trên trong phạm vi**; ✖ nếu chỉ được cấp riêng (§11.2) | |
| **✉ Qua yêu cầu** | ✖ | ✔ gửi **Yêu cầu** (§9), Worker **tự nhận và báo** người phụ trách | ✖ | |
| **👁 Chỉ xem** | ✖ | ✖ | — | Xem hồ sơ và người phụ trách để liên hệ người đó |

### 5.3 Cách tính mức quan hệ

Admin đặt **chính sách nhận việc** cho từng Worker (tài liệu Admin §9.4, bước 1 của trình tạo Worker):

| Chính sách | Hợp với | Ý nghĩa |
|---|---|---|
| **Mở** | Worker dùng chung toàn công ty: trợ lý soạn thảo, hỏi đáp chính sách | Mọi người đều ở mức Trực tiếp |
| **Theo bộ phận** (mặc định) | Phần lớn Worker chuyên môn | Người trong bộ phận và quản lý cấp trên trong phạm vi: Trực tiếp. Người khác: Qua yêu cầu |
| **Hạn chế** | Worker nhạy cảm: kiểm toán, lương | Chỉ người được cấp: Trực tiếp. Người khác: Chỉ xem |

Hệ thống tính mức quan hệ `relation(U, W)` theo thứ tự, gặp điều kiện đầu tiên đúng thì dừng:

```
relation(U, W):
  0. U là viewer                                                    → CHỈ XEM   (trần mức, áp trước mọi nhánh khác)
  1. U là tenant_admin                                              → TRỰC TIẾP
  2. U nằm trong danh sách được cấp riêng của W (accessUserIds)     → TRỰC TIẾP
  3. W.chínhSách = Mở                                               → TRỰC TIẾP
  4. W.chínhSách = Theo bộ phận và
       (U thuộc bộ phận của W  hoặc  bộ phận của W nằm trong phạm vi quản lý của U)
                                                                    → TRỰC TIẾP
  5. W.chínhSách = Theo bộ phận                                     → QUA YÊU CẦU
  6. W.chínhSách = Hạn chế                                          → CHỈ XEM
```

**"Nằm trong phạm vi quản lý của U"** nghĩa là một trong hai:
- U là `unit_manager` của đơn vị chứa bộ phận đó, hoặc của một đơn vị cấp trên.
- U là `function_head` của đúng ngành của bộ phận đó, tại đơn vị đó hoặc một đơn vị cấp trên.

Với chính sách **Hạn chế**, quản lý cấp trên **không** tự có quyền; phải được cấp riêng.

Thêm hai quy tắc:
- **Thành viên dự án** được giao việc trực tiếp cho Worker **đã tham gia dự án đó**, trong phạm vi dự án (§8.4). Quy tắc này không đổi mức quan hệ ở danh bạ.
- `viewer` được xử lý ở bước 0 nên không nhánh nào phía sau nâng được mức của họ, kể cả khi họ có trong `accessUserIds`.

### 5.4 Hồ sơ Worker (chỉ đọc)

```
💼 Sales Agent    ● Sẵn sàng    Kinh doanh – CN Hà Nội    Người phụ trách: Ngô Thanh Mai
Mức của bạn: ✔ Trực tiếp                                  [💬 Chat]  [＋ Giao việc]
──────────────────────────────────────────────────────────────────────────────────
Làm được gì      Soạn email chăm sóc, đề xuất bán hàng, theo dõi sau bán
Lệnh có sẵn      /email-cham-soc — chuỗi email sau bán 3 chạm
                 /de-xuat-ban-hang — tạo đề xuất từ brief
Quy tắc chính    · Mọi email gửi khách phải qua bước duyệt       (chỉ hiện tên Rule)
Tri thức         12 tài liệu · 9 xem được tên · 3 🔒 Mật       (mở ra: tên + phiên bản + ngày của tài liệu không Mật)
Đang làm         2 việc đang thực hiện · 1 trong hàng chờ       (mở ra: tên, nguồn, trạng thái, tiến độ)
```

- **Không hiện** nội dung Knowledge, nội dung Skill hay model đang dùng. **Tên** tài liệu không Mật thì hiện; tài liệu Mật gộp một dòng, ẩn tên (§21.4).
- "Đang làm" chỉ liệt kê việc người xem có quyền xem; việc khác chỉ hiện số lượng.
- Đầu trang có nút "← Danh bạ Worker". Mở từ hội thoại thì hồ sơ hiện dạng modal chỉ đọc.
- Tên các Rule có hiện, để người dùng hiểu vì sao Worker từ chối một việc.
- Worker đã đặt «Không nhận lệnh từ Orchestrator» (U13) thì hồ sơ hiện dòng **«Việc từ Orchestrator: không nhận»**, để người có quyền ra lệnh biết vì sao không thấy Worker này trong kế hoạch.
- Với mức **Qua yêu cầu**, nút Chat được thay bằng **[✉ Gửi yêu cầu]**. Với mức **Chỉ xem**, chỉ có nút **[Liên hệ người phụ trách]**.

---

## 6. Orchestrator: ra lệnh giao việc cho cả đội

### 6.1 Ai được ra lệnh

- **Quyền ra lệnh Orchestrator** (`canCommandOrchestrator`) được Admin **cấp riêng cho từng người** ở Quản trị › Người dùng. Quyền này không gắn với vai trò. Thông thường chỉ cấp cho **CEO, Phó TGĐ** hoặc người được uỷ quyền điều hành.
- Khi tạo tenant, **Admin đầu tiên được cấp sẵn** để tenant dùng được ngay. Admin có thể chuyển quyền cho CEO rồi tự gỡ của mình.
- Người không có quyền **không thấy** mục Orchestrator trên thanh bên. Gọi API trực tiếp thì nhận lỗi `403`.
- Mọi lần cấp hoặc thu hồi quyền đều ghi nhật ký.

**Ra lệnh qua Telegram (U15).** Người có quyền ra lệnh và đã liên kết tài khoản Telegram (Tài khoản › Telegram) gửi lệnh cho **Telegram Bot** của tổ chức trong chat riêng. Kế hoạch được gửi lại kèm nút **Duyệt chạy toàn bộ / Mở trên web / Huỷ**; chỉ người ra lệnh (hoặc người nghiệm thu đã chỉ định) bấm Duyệt mới chạy. Sửa từng việc làm trên web. Đặc tả: tài liệu Admin §25.2.

### 6.2 Vì sao Orchestrator chạy ở mức "Mở" (U8)

Lệnh từ người điều hành cao nhất phải chạy được xuyên các phòng ban, không bị chặn vì "chưa ai nhận". Vì vậy, với việc giao qua Orchestrator:

| Thứ | Áp dụng? |
|---|---|
| Chính sách nhận việc (Mở / Theo bộ phận / Hạn chế) | ✖ **Bỏ qua**: mọi việc chạy ngay, kể cả Worker "Hạn chế" |
| Tài liệu **Mật** | ✔ **Được dùng** (U10: bộ phận sở hữu và Orchestrator) |
| **Rule** (Global, kế thừa theo ngành dọc, riêng Worker, Rule `hard`) | ✔ **Luôn áp dụng đầy đủ.** Orchestrator không vượt được Rule |
| Phê duyệt (tài liệu Admin B6) | ✔ Vẫn áp dụng: email gửi khách vẫn phải qua người duyệt |
| Ngân sách ngày của Worker, Ví credit | ✔ Vẫn áp dụng |
| Trạng thái Worker | Worker `paused` không nhận việc. Orchestrator báo rõ trong kế hoạch |
| **Worker đặt «Không nhận lệnh từ Orchestrator»** (U13) | ✖ **Không giao được.** Orchestrator loại Worker này khỏi kế hoạch và nói rõ «Worker X không nhận lệnh từ Orchestrator; hãy giao trực tiếp hoặc gửi yêu cầu». Gọi API cố giao thì `taskPolicy.create` từ chối với mã `ORCHESTRATOR_NOT_ACCEPTED`. Trong trình sửa kế hoạch, người ra lệnh không chọn được Worker này |

Do Orchestrator mạnh như vậy, **người phụ trách Worker luôn được báo** khi Worker của mình nhận việc từ Orchestrator.

**Worker nhạy cảm (U13).** Một số Worker không nên bị gọi qua đường tắt này dù người ra lệnh là CEO: Worker lương, kiểm toán, pháp chế nội bộ…

- **Ai đặt:** `tenant_admin`, hoặc `unit_manager`/`function_head` với Worker trong phạm vi của mình. Đặt trong trình tạo Worker (bước 1, tài liệu Admin §9.4) hoặc tab Thông tin của Worker. Mọi lần đổi ghi nhật ký.
- **Gợi ý, không tự bật:** khi Admin chọn chính sách nhận việc «Hạn chế», trình tạo gợi ý bật tuỳ chọn này nhưng để Admin quyết định. Quản trị › Worker có bộ lọc «Không nhận lệnh từ Orchestrator».
- **Phạm vi tác dụng:** chỉ chặn đường ① (Orchestrator). Người dùng vẫn giao cho Worker này qua chat, dự án hoặc yêu cầu theo mức quan hệ của họ (§5), nên việc đó chịu chính sách nhận việc và cờ Mật như bình thường.
- **Đổi tuỳ chọn giữa chừng:** chỉ ảnh hưởng việc tạo sau đó. Với kế hoạch Orchestrator đã xác nhận nhưng chưa tạo hết việc, các việc còn lại giao cho Worker này bị từ chối và vào Điều phối của người ra lệnh.

### 6.3 Luồng ra lệnh

> **Cập nhật v2.0:** luồng chốt ở **§21.3**. Tóm tắt: (1) gõ lệnh và **tuỳ chọn chọn ngữ cảnh** Dự án / Phiếu yêu cầu / Công việc liên quan; (2) bấm Giao việc **luôn** ra màn Kế hoạch (Worker nhận từng việc, hạn, credit, trạng thái); (3) đúng thì **Duyệt chạy toàn bộ**; việc nào chưa đúng thì **Dừng**, sửa ngay tại dòng rồi **Lưu & duyệt việc này** hoặc **Bỏ việc này**; các việc khác vẫn duyệt được; (4) tạo Công việc (nguồn `orchestrator`), gắn vào dự án / phiếu đã chọn; (5) theo dõi và nhận báo cáo tổng hợp.

| Hạng mục | Quy định |
|---|---|
| Sửa kế hoạch | **Sửa tại chỗ từng việc** (Dừng → form ngay dưới dòng): đổi Worker hoặc giao cho người, đối tượng, hạn, chạy sau việc nào, đầu bài; bỏ việc. Trình sửa đầy đủ (board 91) vẫn mở được |
| Người nghiệm thu | Mặc định là người ra lệnh; có thể giao cho người khác (ví dụ trưởng phòng Marketing) ngay trong kế hoạch |
| Ngữ cảnh (dự án / phiếu / công việc liên quan) | Chọn **trước khi** giao việc, tuỳ chọn. Có chọn thì Orchestrator dùng làm căn cứ lập kế hoạch và việc mới tự gắn vào dự án / phiếu; thành viên dự án thấy các việc này |
| Duyệt | **Duyệt chạy toàn bộ** hoặc **Duyệt N việc sẵn sàng** (bỏ qua việc đang dừng); trần ngân sách và chế độ báo cáo tổng hợp chọn ngay trong kế hoạch |
| Không có Worker phù hợp | Orchestrator nói rõ và đề xuất: giao cho **người** (chọn nhân sự), hoặc báo Admin tạo Worker mới. **Không tự bịa ra Worker**. Worker duy nhất phù hợp mà không nhận lệnh từ Orchestrator (U13) cũng tính là không có Worker phù hợp; Orchestrator nêu tên Worker đó và gợi ý giao trực tiếp hoặc gửi yêu cầu |
| Việc bị vướng | Vào Điều phối (§8.6); người xử lý là **người ra lệnh** và người phụ trách Worker |
| Ai thấy các việc này | Người ra lệnh, người nghiệm thu, người phụ trách từng Worker, thành viên dự án (nếu gắn), `tenant_admin` |

---

## 7. Hội thoại với Worker

### 7.1 Ai được chat

Chỉ với Worker ở mức **Trực tiếp** (§5). Worker `paused` hiện lý do, ô nhập bị khoá.

### 7.2 Giao diện

```
┌ Hội thoại ───────────────┐┌ 💼 Sales Agent · "Báo giá Hưng Thịnh"  ✎       [＋ Tạo công việc từ hội thoại] ┐
│ 🔎 Tìm                    ││ 👤 Soạn email báo giá gói bảo trì năm cho Hưng Thịnh Phát                      │
│ ＋ Hội thoại mới           ││ 🤖 Dạ, em soạn như sau… [nội dung]                                              │
│ Hôm nay                   ││    📎 Nguồn: Bảng giá 2026 (v2) · Chính sách chiết khấu 🔒 (v1)                │
│  💼 Báo giá Hưng Thịnh    ││    👍 👎  ⧉ Sao chép  ↻ Tạo lại                                                 │
│  ⚖️ Hỏi điều khoản phạt   ││ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ Tuần này …                ││ │ Nhập tin nhắn… gõ / để xem lệnh có sẵn                    📎   [Gửi ⏎]  │ │
│ 🗄 Đã lưu trữ             ││ └──────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┘└──────────────────────────────────────────────────────────────────────────────┘
```

| Tính năng | Đặc tả |
|---|---|
| Hiện chữ dần | Câu trả lời hiện dần trong lúc Worker viết (SSE); có nút **Dừng** |
| Lệnh `/` | Gõ `/` hiện danh sách Workflow của Worker; chọn lệnh thì Worker chạy đúng quy trình đó |
| Nguồn trích dẫn | Mỗi câu trả lời có dùng Knowledge thì ghi tên tài liệu + phiên bản; tài liệu Mật có biểu tượng 🔒 |
| Đính kèm | Tối đa 20 MB/tệp. Tệp chỉ dùng trong hội thoại đó, **không** tự đưa vào Kho KWSR, và thuộc quyền riêng tư của hội thoại |
| 👍 / 👎 + góp ý | Gửi cho **người phụ trách Worker** dưới dạng "Góp ý cải thiện": đoạn hỏi + đoạn trả lời + góp ý. Đây là nguồn để bổ sung KWSR. Người dùng biết rõ khi bấm 👎 thì đoạn đó được chia sẻ |
| Tạo công việc từ hội thoại | Mở form Công việc điền sẵn đầu bài từ hội thoại; việc tạo ra có theo dõi, báo cáo, nghiệm thu |
| Đặt tên, lưu trữ, xoá | Người dùng tự làm. Xoá thì ẩn ngay và **xoá hẳn sau 30 ngày** (trong 30 ngày khôi phục được) |
| Trí nhớ | Worker nhớ trong phạm vi **một hội thoại**. Không mang nội dung sang hội thoại khác hay sang người khác. Tri thức chung chỉ đến từ Kho KWSR |
| Chi phí | Ghi vào bộ phận của người chat. Hết ngân sách hoặc hết credit thì báo rõ lý do, không lỗi chung chung |

### 7.3 Quyền riêng tư (U5)

| Ai | Xem nội dung hội thoại |
|---|---|
| Chính người tạo hội thoại | ✔ |
| `tenant_admin` | ✔ chỉ đọc, qua **Quản trị › Người dùng › [người] › Hội thoại**. Mỗi lần mở một hội thoại ghi nhật ký `conversation.viewed` (ai xem, của ai, hội thoại nào, lúc nào) |
| `unit_manager`, `function_head`, quản lý trực tiếp | ✖ |
| Người phụ trách Worker | ✖ (chỉ nhận các đoạn người dùng chủ động gửi kèm 👎) |
| SuperAdmin, kể cả trong phiên hỗ trợ | ✖ (đã thêm vào danh sách luôn bị chặn, tài liệu Admin §22.8) |
| Số liệu sử dụng (số lượt, token, chi phí) | Quản lý và Admin xem được dạng tổng hợp, **không có nội dung** |

Khi hội thoại được chuyển thành Công việc thì **đầu bài của công việc** được chia sẻ theo quyền của công việc (§12). Bản thân hội thoại vẫn riêng tư.

---

## 8. Quản lý công việc (lõi, U2)

Mô hình: **Dự án → Phiếu yêu cầu → Công việc → Báo cáo**. Tiến độ cuộn lên từ công việc tới phiếu tới dự án. Có thêm Điều phối và Dashboard (trước gọi là Phòng điều hành). Dữ liệu theo tenant trong PostgreSQL, nhân sự là `users`, Worker lấy từ CSDL, quyền theo §12.

### 8.1 Đối tượng

| Đối tượng | Trường chính | Quy tắc |
|---|---|---|
| **Dự án** | Tên, mô tả, **đơn vị chủ trì**, PM, thành viên (người), **Worker tham gia**, bắt đầu, hạn, trạng thái, tài liệu đính kèm, đối tác/khách hàng (văn bản tự do, tuỳ chọn) | Tạo bởi `tenant_admin`, `unit_manager`, `function_head`, hoặc người có quyền `project.create` |
| **Phiếu yêu cầu** | Thuộc **đúng 1 dự án**; tiêu đề, loại, ưu tiên, hạn, người xử lý, mô tả | Thành viên dự án tạo được |
| **Công việc** | Đầu bài; **người thực hiện** (người hoặc Worker); **người yêu cầu**; **người nghiệm thu** (mặc định = người yêu cầu); **người phụ trách Worker** (tự điền nếu người thực hiện là Worker); **nguồn**; dự án/phiếu (tuỳ chọn); ưu tiên; bắt đầu, hạn; tiến độ | Việc **không gắn dự án** gọi là **việc lẻ** (thường đến từ chat, yêu cầu, Orchestrator) |
| **Báo cáo tiến độ** | Thời điểm, %, ghi chú, phút làm, người hoặc Worker báo | Người tự nhập; Worker tự sinh khi xong mỗi lượt |
| **Kết quả bàn giao** | §10 | |

**Nguồn của Công việc** (`origin`): `orchestrator` · `chat` · `project` · `request` · `manual`.

### 8.2 Trạng thái Công việc

> **Cập nhật v2.0:** sơ đồ dưới là **bộ trạng thái mặc định**. Admin cấu hình được danh sách trạng thái, màu, nhóm (Mở · Đang làm · Chờ · Vướng · Kết thúc đạt / không đạt · nhóm tuỳ chỉnh) và các bước chuyển được phép cho Công việc, Phiếu yêu cầu, Dự án (tài liệu Admin §24.3). Workspace chỉ hiện nút chuyển hợp lệ; trạng thái "bắt buộc lý do" mở ô lý do.

```
Mới ──► Đang thực hiện ──► Chờ nghiệm thu ──► Hoàn tất
             │   ▲                │
             │   └── Làm lại ◄────┘ (người nghiệm thu trả về, kèm góp ý)
             ▼
          Vướng ──► (Điều phối §8.6) ──► Đang thực hiện | Đã huỷ
Bất kỳ lúc nào ──► Tạm dừng | Đã huỷ (kèm lý do bắt buộc)
```

- Việc của **Worker** xong thì chuyển **Chờ nghiệm thu**, **không tự Hoàn tất**. Người nghiệm thu phải xác nhận.
- **Phiếu không tự đóng** khi còn công việc chưa Hoàn tất hoặc chưa Huỷ .
- Đóng một việc chưa đạt kết quả phải nhập lý do, và lý do được ghi vào báo cáo.

### 8.3 Giao việc cho người hoặc cho Worker

Form Công việc có ô **"Người thực hiện"** gồm hai nhóm: 👤 Nhân sự và 🤖 Worker.
- Danh sách Worker **chỉ gồm Worker người tạo việc được giao**: mức Trực tiếp, cộng Worker tham gia dự án (nếu việc thuộc dự án).
- Chọn Worker ở mức Qua yêu cầu thì form tự chuyển sang **Gửi yêu cầu** (§9).

### 8.4 Worker tham gia dự án

- **PM mời Worker vào dự án**, giống thêm một người vào nhóm.
- Lời mời gửi tới người phụ trách Worker. Theo U9 (tự nhận và báo), lời mời được **tự chấp nhận** và người phụ trách được báo; người phụ trách có thể **rút Worker khỏi dự án** kèm lý do.
- Khi Worker đã tham gia, **mọi thành viên dự án** giao việc trực tiếp cho Worker, **trong phạm vi dự án đó**.
- **Tài liệu Mật mặc định không dùng** cho việc trong dự án, trừ khi người phụ trách Worker bật **"Cho phép dùng tài liệu Mật trong dự án này"** (ghi nhật ký).

### 8.5 Dashboard, Báo cáo

| Màn | Nội dung | Phạm vi dữ liệu |
|---|---|---|
| **Dashboard** (trước: Phòng điều hành) | Chỉ số và ngưỡng do Admin cấu hình (tài liệu Admin §24.3). Mặc định: dự án đang chạy, việc trễ hạn, việc thiếu báo cáo, Worker đang chạy, việc chờ nghiệm thu | Theo §12: người dùng thường thấy việc của mình; quản lý thấy phạm vi quản lý; Admin thấy toàn công ty |
| ~~Nhân sự & Worker~~ | **Bỏ hẳn** (v2.0): không có màn, không có số liệu riêng. Quan hệ người ↔ Worker xem ở Sơ đồ (§21.6) | — |
| **Báo cáo** | Dòng thời gian báo cáo tiến độ; lọc theo người, Worker, dự án, khoảng ngày; xuất CSV | Như trên |

### 8.6 Điều phối: việc đang vướng

Nguyên tắc: **không việc nào được nằm im không rõ vì sao.** Mọi công việc lỗi hoặc bế tắc dồn về đây kèm lý do cụ thể.

| Lý do vướng | Ví dụ |
|---|---|
| Lỗi chạy | Nhà cung cấp mô hình lỗi, hết thời gian chờ |
| Hết ngân sách / hết credit | Worker bị tạm dừng tự động |
| Bị Rule chặn | "Bút toán > 50 triệu phải chờ duyệt" |
| **Cần tài liệu Mật** | Việc đến qua yêu cầu nhưng cần tài liệu Mật của bộ phận (§11.3) |
| Thiếu thông tin đầu vào | Worker hỏi lại mà chưa ai trả lời |
| Bị từ chối phê duyệt | Người duyệt từ chối |

**Thao tác:** Chạy lại · Sửa đầu bài rồi chạy lại · Đổi người thực hiện (người khác hoặc Worker khác) · **Chạy lại với quyền bộ phận** (chỉ cho lý do "Cần tài liệu Mật", §11.3) · Đóng kèm lý do.

**Ai xử lý:** người phụ trách Worker; người yêu cầu; người ra lệnh (nếu nguồn là Orchestrator); PM (nếu thuộc dự án); `tenant_admin`.

---

### 8.7 Chuỗi công việc: bắt đầu tự động và chuyển giao giữa các Worker (U14)

**Worker nhận việc từ đâu.** Worker chỉ làm việc khi có: (1) kế hoạch Orchestrator đã được duyệt, hoặc (2) Công việc được tạo (trong dự án / phiếu, việc lẻ, Yêu cầu liên phòng). Hội thoại là trao đổi; muốn thành việc có theo dõi thì bấm «Tạo công việc từ hội thoại». Worker **không tự giao việc** cho Worker khác: một chuỗi nhiều Worker luôn do Orchestrator lập (người duyệt) hoặc do người dựng bằng ô **«Chạy sau việc…»** trong form Công việc / kế hoạch.

**Khi nào một việc bắt đầu.**

| Điều kiện bắt đầu | Ý nghĩa |
|---|---|
| **Sau việc trước** (mặc định khi có «Chạy sau») | Bắt đầu ngay khi mọi việc trước đã **xong phần thực hiện**, và đã tới giờ bắt đầu nếu có hẹn |
| **Đến giờ bắt đầu** | Bắt đầu đúng thời điểm đã hẹn. **Hạn chót không phải giờ bắt đầu**: hạn chót chỉ để cảnh báo trễ |
| **Ngay** (mặc định khi không có «Chạy sau») | Bắt đầu ngay khi tạo hoặc khi kế hoạch được duyệt |
| **Thủ công** | Người bấm «Bắt đầu» |

**«Xong phần thực hiện»** nghĩa là: việc của Worker đã sang **Chờ nghiệm thu**; việc của người đã **Hoàn tất**. Chuỗi vì vậy **chạy liền mạch, không dừng chờ nghiệm thu ở từng bước**; người nghiệm thu chuỗi nghiệm thu khi tiện (thường ở cuối). Muốn dừng chờ nghiệm thu ở một bước quan trọng thì tick **«Chờ nghiệm thu bước này rồi mới chạy tiếp»** trên cạnh nối đó.

**Chuyển giao.** Việc kế tiếp tự nhận **kết quả bàn giao mới nhất** của việc trước làm đầu vào (hiện trong chi tiết việc ở mục «Đầu vào từ việc trước»). Kết quả có dùng tài liệu Mật chỉ chuyển thẳng khi việc kế tiếp cũng được phép dùng tài liệu Mật; nếu không thì đi qua duyệt chuyển (§11.3).

**Nhìn thấy chuỗi.** Màn theo dõi kế hoạch Orchestrator (board 53) và chi tiết dự án có **dải chuỗi**: mỗi bước một ô (Worker hoặc người, trạng thái, tiến độ), bước đang chạy được tô nổi, mũi tên nối các bước. Bước đang chờ hiện lý do: «Chờ việc #2», «Xếp hàng sau việc X của Worker Y», «Chờ đến 08:00 05/12».

**Khi một bước bị vướng** (lỗi, bị Rule chặn, thiếu thông tin, cần tài liệu Mật, bị từ chối duyệt):
1. Bước đó vào **Điều phối** với lý do cụ thể; các bước sau chuyển **«Chờ việc trước»** và dải chuỗi tô đỏ đúng bước vướng.
2. **Người phụ trách chuỗi** (người ra lệnh Orchestrator, PM của dự án, hoặc người yêu cầu) và **người phụ trách Worker** của bước vướng nhận thông báo ngay (trong Workspace, email nếu bật, Telegram nếu đã liên kết), kèm link mở thẳng bước đó.
3. Xử lý ở Điều phối (chạy lại, sửa đầu bài, đổi người thực hiện) → chuỗi **tự chạy tiếp**, không cần bấm thêm.
4. Nếu đóng bước vướng là **«Kết thúc · không đạt»** thì các bước sau tạm dừng và hỏi người phụ trách chuỗi: chạy tiếp không có đầu vào đó · giao lại bước này · huỷ phần còn lại của chuỗi.

**Nghiệm thu trả về «Làm lại» khi các bước sau đã chạy.** Các bước sau được đánh dấu **«Đầu vào đã đổi»** và có nút **«Chạy lại từ bước này»**; hệ thống không tự chạy lại để tránh tốn chi phí ngoài ý muốn.

**Cảnh báo sớm.** Bước có nguy cơ trễ hạn (Worker đang bận, thời gian chờ ước tính vượt hạn chót) được báo cho người phụ trách chuỗi trước khi trễ.

**Ràng buộc.** Không tạo được phụ thuộc vòng tròn. Bước giao cho Worker «không nhận lệnh từ Orchestrator» (U13) chỉ dựng được bởi người, không qua Orchestrator. Đặc tả phía động cơ: tài liệu Admin §9.5.11.

## 9. Bốn đường giao việc và Yêu cầu liên phòng

### 9.1 Bốn đường, một quy tắc

| Đường | Ai dùng được | Mức áp dụng | Tài liệu Mật |
|---|---|---|---|
| **① Orchestrator** | Người có quyền ra lệnh (§6.1) | Luôn **Mở** (bỏ qua chính sách nhận việc), **trừ Worker «không nhận lệnh từ Orchestrator»** (U13) | ✔ |
| **② Chat → Tạo công việc** | Người ở mức Trực tiếp | Trực tiếp | Theo §11.2 |
| **③ Trong dự án** | Thành viên dự án, với Worker đã tham gia dự án | Trực tiếp trong phạm vi dự án | ✖ trừ khi người phụ trách bật cho dự án |
| **④ Gửi yêu cầu** | Người ở mức Qua yêu cầu | Tự nhận và báo (U9) | ✖ |

**Kiểm quyền ở một chỗ.** Mọi đường đều gọi cùng một hàm `taskPolicy.create(requester, worker, origin, project?)`. Hàm này trả về: được tạo hay không, chạy ngay hay qua yêu cầu, và có được dùng tài liệu Mật hay không. Khi không được tạo, hàm trả mã từ chối (ví dụ `ORCHESTRATOR_NOT_ACCEPTED`, `RELATION_VIEW_ONLY`). Kết quả được **ghi cứng vào công việc lúc tạo** (`run_mode`, `confidential_allowed`); runtime đọc từ công việc, không tự suy lại. Nhờ vậy không đường nào lách được đường khác, và Admin đổi chính sách sau đó thì chỉ ảnh hưởng việc mới.

### 9.2 Gửi yêu cầu tới Worker phòng khác (đường ④)

```
Danh bạ › ⚖️ Legal Agent (Pháp lý – TCT) · Mức của bạn: ✉ Qua yêu cầu        [✉ Gửi yêu cầu]
┌ Gửi yêu cầu tới Legal Agent ──────────────────────────────────────────────────┐
│ Nội dung     [Rà điều khoản phạt trong hợp đồng nhà cung cấp X, đính kèm]      │
│ Đính kèm     📎 HĐ_NCC_X.pdf                                                    │
│ Hạn          [05/12/2026]     Ưu tiên [Trung bình ▾]                            │
│ Gắn dự án    [— Không — ▾]                                                      │
│                                                               [Huỷ]  [Gửi]     │
└────────────────────────────────────────────────────────────────────────────────┘
```

1. Gửi xong thì tạo **Công việc** với `origin = request`. Worker **tự nhận ngay** (U9).
2. **Người phụ trách Worker được báo** (thông báo + mục «Yêu cầu liên phòng › Tới Worker tôi phụ trách» ở `/yeu-cau`). Người phụ trách có thể:
   - Để Worker làm tiếp (mặc định, không cần thao tác).
   - **Tạm dừng** hoặc **Trả lại** kèm lý do. Người yêu cầu được báo.
   - **Đổi người thực hiện** (giao cho nhân sự của phòng mình).
3. Worker làm xong thì kết quả về **người yêu cầu** để nghiệm thu.
4. Chi phí tính cho **bộ phận của người yêu cầu**.

Màn **Yêu cầu liên phòng** (`/yeu-cau`) có hai tab: **Tôi đã gửi** (trạng thái từng yêu cầu) và **Gửi tới Worker tôi phụ trách** (chỉ hiện với người phụ trách Worker).

---

## 10. Kết quả bàn giao và tệp

| Hạng mục | Đặc tả |
|---|---|
| Nguồn | Worker tạo ra khi làm việc (văn bản, `.docx`, `.xlsx`, `.pdf`, ảnh), hoặc người tải lên khi báo cáo |
| Lưu trữ | Kho file theo tenant (tài liệu Admin §3.1, `objects/tenants/{id}/outputs/…`); gắn với công việc |
| Ai xem, ai tải | Theo quyền xem của công việc (§12) |
| Phiên bản | Mỗi lần "Làm lại" sinh phiên bản mới; giữ phiên bản cũ để so sánh |
| Đưa vào Kho KWSR | Nút **"Đề xuất đưa vào Kho"**: tạo bản nháp mục Knowledge trong Kho, chờ người quản lý mục đó duyệt (tài liệu Admin §9.3). Đây là cách tri thức của công ty lớn dần từ công việc thật |
| Màn `/ket-qua` | Mọi kết quả người dùng được xem; lọc theo dự án, Worker, loại tệp, ngày; tìm theo tên |

---

## 11. Tài liệu Mật (U10)

### 11.1 Cờ Mật áp cho gì

| Loại mục Kho | Có cờ Mật không | Lý do |
|---|:-:|---|
| **Knowledge** | ✔ | Dữ liệu nhạy cảm: bảng lương, giá vốn, hợp đồng, công nợ |
| Workflow | ✖ | Quy trình phải chạy được với mọi người được giao việc; giấu bước nào là quy trình hở bước đó |
| Skill | ✖ | Như trên |
| **Rule** | ✖ | **Rule luôn áp dụng cho mọi người, mọi đường giao việc.** Giấu Rule là mở lỗ hổng |

Admin hoặc người quản lý mục Kho đặt cờ Mật trong Quản trị › Kho KWSR (tài liệu Admin §9.2).

### 11.2 Ai được dùng tài liệu Mật

Khi Worker W làm việc, tài liệu Mật của W **chỉ được đưa vào tìm kiếm** khi một trong các điều kiện sau đúng:

| Điều kiện | Ví dụ |
|---|---|
| Người yêu cầu **thuộc bộ phận của W** | Kế toán HN chat với Worker Kế toán HN |
| W thuộc **phạm vi quản lý** của người yêu cầu | Kế toán trưởng Tổng công ty dùng Worker Kế toán HN |
| Việc đến từ **Orchestrator** | CEO giao việc qua Orchestrator |
| Người phụ trách W **chạy lại với quyền bộ phận** (§11.3) | |
| Việc thuộc dự án mà người phụ trách W đã bật "cho phép dùng tài liệu Mật" (§8.4) | |
| Người yêu cầu là `tenant_admin` | |

Không thuộc trường hợp nào ở trên thì **không dùng**. Riêng người **được cấp riêng** (`accessUserIds`) ngoài bộ phận vẫn chat trực tiếp được, nhưng **không** dùng được tài liệu Mật.

**Thực thi ở tầng truy vấn:** tập `item_id` đưa vào truy vấn Qdrant (tài liệu Admin §15) được tính từ PostgreSQL và **loại các mục `confidential = true`** khi việc không được phép dùng tài liệu Mật. Cờ chỉ có một nguồn là `library_items.confidential`, không sao chép vào Qdrant, nên bật hay tắt cờ có hiệu lực ngay ở lượt truy vấn kế tiếp. Prompt không bao giờ chứa nội dung bị loại, nên Worker không thể "lỡ lời".

### 11.3 Khi quy trình cần tài liệu Mật mà người yêu cầu không có quyền

Tình huống: phòng Kinh doanh gửi yêu cầu tới Worker Kế toán "Kiểm tra công nợ khách X", mà dữ liệu công nợ là tài liệu Mật.

1. Worker chạy với dữ liệu được phép. Khi thiếu dữ liệu cần thiết, Worker **nói rõ** "cần tài liệu Mật của bộ phận Kế toán". Worker **không đoán, không bịa**.
2. Công việc chuyển **Vướng** với lý do **"Cần tài liệu Mật"** và vào Điều phối của **người phụ trách Worker**.
3. Người phụ trách bấm **"Chạy lại với quyền bộ phận"**. Worker chạy lại có tài liệu Mật, kết quả về **người phụ trách xem trước**.
4. Người phụ trách **duyệt chuyển** kết quả (có thể sửa, rút gọn, che bớt số liệu) cho người yêu cầu, hoặc trả lời "không cung cấp được" kèm lý do.
5. Mọi bước ghi nhật ký.

Như vậy quy trình **không bị đứt**, còn dữ liệu Mật chỉ ra khỏi bộ phận khi có người của bộ phận đó quyết định.

---

## 12. Phân quyền người dùng

### 12.1 Bốn lớp quyền

| Lớp | Trả lời câu hỏi | Nguồn |
|---|---|---|
| **1. Vai trò** | Người này vào được khu vực nào, quản lý phạm vi nào | Tài liệu Admin §5: `tenant_admin`, `unit_manager`, `function_head`, `member`, `viewer` |
| **2. Quyền bổ sung** (cấp riêng từng người) | Có được làm việc đặc biệt không | `canCommandOrchestrator` (§6.1), `project.create` (§8.1) |
| **3. Quan hệ với Worker** | Được chat, giao việc, dùng tài liệu Mật của Worker nào | §5.3, §11.2 |
| **4. Phạm vi dữ liệu** | Thấy dự án, công việc, kết quả, báo cáo của ai | §12.2 |

### 12.2 Phạm vi dữ liệu

| Dữ liệu | Ai thấy |
|---|---|
| **Hội thoại** | Chính người tạo; `tenant_admin` (có ghi nhật ký). Không ai khác (§7.3) |
| **Dự án** | PM, thành viên; quản lý có **đơn vị chủ trì** của dự án nằm trong phạm vi quản lý; `tenant_admin` |
| **Phiếu và Công việc trong dự án** | Ai thấy dự án thì thấy |
| **Việc lẻ** (không gắn dự án) | Người yêu cầu; người thực hiện; người nghiệm thu; người phụ trách Worker; người ra lệnh (nếu từ Orchestrator); quản lý có bộ phận của **người yêu cầu** nằm trong phạm vi; `tenant_admin` |
| **Việc của Worker tôi phụ trách** | Người phụ trách Worker thấy **đầu bài, trạng thái, kết quả** của mọi việc Worker đó làm, kể cả việc từ phòng khác, vì phải chịu trách nhiệm chất lượng |
| **Báo cáo tiến độ, Kết quả bàn giao** | Theo công việc chứa nó |
| **Yêu cầu liên phòng** | Người gửi; người phụ trách Worker; `tenant_admin` |
| **Phê duyệt** | Người duyệt; người yêu cầu của công việc; `tenant_admin` |
| **Số liệu sử dụng và chi phí** | Người dùng: của mình. Quản lý: trong phạm vi. Admin: toàn công ty. **Không có nội dung**, chỉ số liệu |
| **Danh bạ Worker, Sơ đồ tổ chức** | Mọi người dùng |

### 12.3 Ma trận thao tác

✔ được · ◐ trong phạm vi hoặc theo điều kiện · ✖ không

| Thao tác | tenant_admin | unit_manager | function_head | member | viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| Vào Workspace | ✔ | ✔ | ✔ | ✔ | ✔ chỉ đọc |
| Vào Quản trị (`/admin`) | ✔ | ◐ | ◐ | ✖ | ✖ |
| **Ra lệnh Orchestrator** | ◐ khi được cấp quyền | ◐ khi được cấp quyền | ◐ khi được cấp quyền | ◐ khi được cấp quyền | ✖ |
| Chat với Worker | ✔ mọi Worker | ◐ mức Trực tiếp | ◐ mức Trực tiếp | ◐ mức Trực tiếp | ✖ |
| Giao việc trực tiếp cho Worker | ✔ | ◐ | ◐ | ◐ | ✖ |
| Gửi yêu cầu tới Worker phòng khác | ✔ | ✔ | ✔ | ✔ | ✖ |
| Tạm dừng, trả lại yêu cầu tới Worker mình phụ trách | ✔ | ◐ người phụ trách | ◐ người phụ trách | ◐ người phụ trách | ✖ |
| Tạo dự án | ✔ | ✔ | ✔ | ◐ khi có `project.create` | ✖ |
| Thêm người, mời Worker vào dự án | ✔ | ◐ PM của dự án | ◐ PM | ◐ PM | ✖ |
| Tạo phiếu, công việc trong dự án | ✔ | ◐ thành viên | ◐ thành viên | ◐ thành viên | ✖ |
| Tạo việc lẻ | ✔ | ✔ | ✔ | ✔ | ✖ |
| Nghiệm thu | ◐ khi là người nghiệm thu | ◐ | ◐ | ◐ | ✖ |
| Xử lý Điều phối | ✔ | ◐ §8.6 | ◐ §8.6 | ◐ §8.6 | ✖ |
| Chạy lại với quyền bộ phận (tài liệu Mật) | ✔ | ◐ người phụ trách Worker | ◐ người phụ trách Worker | ◐ người phụ trách Worker | ✖ |
| Duyệt trong hộp Phê duyệt | ◐ khi được chỉ định | ◐ | ◐ | ◐ | ✖ |
| Xem hội thoại của người khác | ✔ có ghi nhật ký | ✖ | ✖ | ✖ | ✖ |
| Xem báo cáo, số liệu | ✔ toàn công ty | ◐ phạm vi | ◐ phạm vi | ◐ của mình | ◐ của mình |
| Đề xuất đưa kết quả vào Kho KWSR | ✔ | ✔ | ✔ | ✔ | ✖ |
| Kết nối hộp thư cá nhân và cấp cho Worker | ✔ | ✔ | ✔ | ✔ | ✖ |

---

## 13. Phê duyệt (phía người dùng)

Cấu hình **cái gì cần duyệt** và **ai duyệt** nằm ở Quản trị (tài liệu Admin B6). Ở Workspace:

- Màn **`/phe-duyet`** liệt kê việc chờ người đang xem duyệt: hành động (gửi email, đăng bài, chi phí vượt mức…), Worker, công việc gốc, nội dung xem trước, hạn duyệt.
- Thao tác: **Duyệt** · **Từ chối kèm góp ý** (công việc vào Điều phối với lý do "Bị từ chối phê duyệt") · **Sửa rồi duyệt**.
- Quá hạn duyệt thì làm theo **«Quá hạn thì»** của quy tắc duyệt (tài liệu Admin §24.5): huỷ hành động · nhắc lại và báo Điều phối · chuyển lên cấp duyệt kế tiếp · dừng tác vụ. Huỷ hoặc dừng thì công việc vào Điều phối «Bị từ chối phê duyệt».
- Người yêu cầu thấy công việc đang "Chờ duyệt" và ai đang giữ.

---

## 14. Thông báo

| Sự kiện | Ai nhận |
|---|---|
| Việc của tôi xong, chờ tôi nghiệm thu | Người nghiệm thu |
| Việc của tôi bị trả lại, tạm dừng, đổi người thực hiện | Người yêu cầu |
| Có yêu cầu từ phòng khác tới Worker tôi phụ trách (đã tự nhận) | Người phụ trách Worker |
| Worker tôi phụ trách nhận việc từ Orchestrator; bị mời vào dự án | Người phụ trách Worker |
| Việc vướng cần xử lý | Những người xử lý ở §8.6 |
| Có việc chờ tôi duyệt; việc của tôi được duyệt hay bị từ chối | Người duyệt; người yêu cầu |
| Trễ hạn, sắp tới hạn (1 ngày) | Người thực hiện, người yêu cầu |
| Có góp ý 👎 về Worker tôi phụ trách | Người phụ trách Worker |
| Worker tôi dùng bị tạm dừng (hết ngân sách, hết credit) | Người đang có việc với Worker đó; người phụ trách |

**Kênh:** chuông trong Workspace (luôn có) và email (tuỳ chọn). Mỗi người tự bật/tắt từng loại ở `/tai-khoan`. Thông báo cùng loại trong 15 phút được gộp lại để tránh dồn dập.

---

## 15. Tài khoản cá nhân (`/tai-khoan`)

| Mục | Đặc tả |
|---|---|
| Hồ sơ | Tên, chức danh, ảnh; xem (không sửa) bộ phận, vai trò, người quản lý |
| Mật khẩu | Đổi mật khẩu (tài liệu Admin §6.2) |
| Phiên đăng nhập | Danh sách thiết bị đang đăng nhập; đăng xuất từng thiết bị hoặc tất cả |
| MFA | Bật TOTP (Giai đoạn 4, tài liệu Admin §6.2) |
| Hộp thư cá nhân | Kết nối, ngắt kết nối; cấp quyền đọc/soạn nháp/gửi cho Worker mình dùng trực tiếp (tài liệu Admin §14) |
| Thông báo | Bật/tắt từng loại, từng kênh (§14) |
| Giao diện | Sáng/tối (dùng lại `theme.js`), ngôn ngữ |
| Mức sử dụng (trước: "Mức sử dụng" (cá nhân)) | Số lượt chat, việc, chi phí tháng này của chính mình |

---

## 16. Mô hình dữ liệu bổ sung (PostgreSQL)

Theo quy ước của tài liệu Admin §7.7: mọi bảng có `tenant_id` (khoá ngoại tới `tenants`), bật Row-Level Security, SQL thuần. Các cột dưới đây **đã nằm sẵn** trong lệnh `CREATE TABLE` của tài liệu Admin §7.7; nêu lại ở đây để thấy Workspace cần gì, **không** làm thành migration riêng:

```sql
ALTER TABLE users     ADD COLUMN can_command_orchestrator boolean NOT NULL DEFAULT false,
                      ADD COLUMN can_create_project boolean NOT NULL DEFAULT false;
ALTER TABLE workers   ADD COLUMN intake_policy text NOT NULL DEFAULT 'department'
                        CHECK (intake_policy IN ('open','department','restricted')),
                      ADD COLUMN accept_from_orchestrator boolean NOT NULL DEFAULT true;   -- U13
ALTER TABLE library_items ADD COLUMN confidential boolean NOT NULL DEFAULT false;  -- chỉ có nghĩa với type='knowledge'
```

Bảng mới:

```sql
-- ===== Hội thoại =====
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id), worker_id uuid NOT NULL REFERENCES workers(id),
  title text, archived_at timestamptz, deleted_at timestamptz,          -- xoá hẳn sau 30 ngày
  created_at timestamptz NOT NULL DEFAULT now(), last_message_at timestamptz);
CREATE TABLE messages (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),     -- chủ hội thoại, chép từ conversations để RLS không cần join
  role text NOT NULL CHECK (role IN ('user','worker')), content text NOT NULL,
  attachments jsonb, sources jsonb,            -- [{itemId, version, title, confidential}]
  workflow_command text, tokens_in int, tokens_out int, credit bigint,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE message_feedback (message_id bigint PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id),     -- người bấm = chủ hội thoại
  rating smallint NOT NULL CHECK (rating IN (-1, 1)), comment text,
  created_at timestamptz NOT NULL DEFAULT now());
-- Góp ý 👎 gửi người phụ trách là một bản SAO đoạn hỏi + trả lời mà người dùng chủ động chia sẻ.
-- Tách bảng riêng để người phụ trách đọc được đúng đoạn đó mà không cần quyền đọc hội thoại.
CREATE TABLE feedback_shares (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  from_user_id uuid NOT NULL REFERENCES users(id), worker_id uuid NOT NULL REFERENCES workers(id),
  to_user_id uuid NOT NULL REFERENCES users(id),     -- người phụ trách Worker, chụp lại lúc gửi
  excerpt jsonb NOT NULL, comment text, status text NOT NULL DEFAULT 'new',     -- new | handled
  created_at timestamptz NOT NULL DEFAULT now());    -- sống độc lập với hội thoại gốc; xoá sau khi xử lý hoặc tối đa 180 ngày

-- ===== RLS cho nội dung riêng tư (quy tắc chung: tài liệu Admin §7.7) =====
-- Nhóm: conversations, messages, message_feedback, feedback_shares.
-- KHÔNG tạo console_all, và REVOKE ALL FROM aios_console. tenant_admin chỉ ĐỌC (policy SELECT), không ghi.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['conversations','messages','message_feedback'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY priv_read ON %I FOR SELECT TO aios_app
      USING (tenant_id = current_setting('app.tenant_id')::uuid
         AND (user_id = current_setting('app.user_id')::uuid OR current_setting('app.is_tenant_admin') = 'true'))$p$, t);
    EXECUTE format($p$CREATE POLICY priv_write ON %I FOR ALL TO aios_app
      USING      (tenant_id = current_setting('app.tenant_id')::uuid AND user_id = current_setting('app.user_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid AND user_id = current_setting('app.user_id')::uuid)$p$, t);
  END LOOP;
END $$;
ALTER TABLE feedback_shares ENABLE ROW LEVEL SECURITY;  ALTER TABLE feedback_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY share_read ON feedback_shares FOR SELECT TO aios_app
  USING (tenant_id = current_setting('app.tenant_id')::uuid
     AND (to_user_id = current_setting('app.user_id')::uuid OR from_user_id = current_setting('app.user_id')::uuid));
CREATE POLICY share_insert ON feedback_shares FOR INSERT TO aios_app
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid AND from_user_id = current_setting('app.user_id')::uuid);
CREATE POLICY share_handle ON feedback_shares FOR UPDATE TO aios_app          -- người phụ trách đổi status
  USING      (tenant_id = current_setting('app.tenant_id')::uuid AND to_user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid AND to_user_id = current_setting('app.user_id')::uuid);
REVOKE ALL ON conversations, messages, message_feedback, feedback_shares FROM aios_console;

-- ===== Quản lý công việc =====
CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL, description text, unit_id uuid NOT NULL REFERENCES units(id),
  pm_user_id uuid NOT NULL REFERENCES users(id), partner text,
  start_date date, deadline date, status text NOT NULL, created_by uuid);
CREATE TABLE project_members (project_id uuid REFERENCES projects(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id), PRIMARY KEY (project_id, user_id));
CREATE TABLE project_workers (project_id uuid REFERENCES projects(id) ON DELETE CASCADE, worker_id uuid REFERENCES workers(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id), status text NOT NULL DEFAULT 'joined',        -- joined | withdrawn
  allow_confidential boolean NOT NULL DEFAULT false, invited_by uuid, withdrawn_reason text,
  PRIMARY KEY (project_id, worker_id));
CREATE TABLE tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  code bigint NOT NULL, project_id uuid NOT NULL REFERENCES projects(id), title text NOT NULL, type text,
  status text NOT NULL, priority text, deadline date, description text, UNIQUE (tenant_id, code));
CREATE TABLE ticket_assignees (ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (ticket_id, user_id));
CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  title text NOT NULL, brief text,
  project_id uuid REFERENCES projects(id), ticket_id uuid REFERENCES tickets(id),   -- cả hai NULL = việc lẻ
  executor_user_id uuid REFERENCES users(id), executor_worker_id uuid REFERENCES workers(id),
  CHECK ((executor_user_id IS NULL) <> (executor_worker_id IS NULL)),    -- đúng một trong hai
  requester_id uuid NOT NULL REFERENCES users(id), acceptor_id uuid NOT NULL REFERENCES users(id),   -- người yêu cầu, người nghiệm thu
  worker_owner_id uuid REFERENCES users(id),                      -- chụp lại lúc tạo nếu người thực hiện là Worker
  origin text NOT NULL CHECK (origin IN ('orchestrator','chat','project','request','manual')),
  orchestrator_plan_id uuid, source_conversation_id uuid,
  run_mode text NOT NULL,                     -- direct | request | orchestrator | project | dept_override
  confidential_allowed boolean NOT NULL,      -- ghi cứng lúc tạo (§9.1)
  status_id uuid NOT NULL REFERENCES status_defs(id),            -- trạng thái cấu hình được (tài liệu Admin §25.3)
  stuck_reason text, priority text,
  start_rule text NOT NULL DEFAULT 'immediate' CHECK (start_rule IN ('immediate','after_deps','at_time','manual')),
  start_at timestamptz, deadline timestamptz,                    -- start_at = giờ bắt đầu đã hẹn; deadline chỉ để cảnh báo (§8.7)
  chain_owner_id uuid REFERENCES users(id),                      -- người phụ trách chuỗi: người ra lệnh / PM / người yêu cầu
  inputs_stale boolean NOT NULL DEFAULT false,                   -- «Đầu vào đã đổi» khi bước trước bị làm lại
  progress int NOT NULL DEFAULT 0, cost_credit bigint NOT NULL DEFAULT 0,
  cost_dept_id uuid NOT NULL,                 -- bộ phận chịu chi phí = bộ phận người yêu cầu
  created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, close_reason text);
CREATE TABLE task_dependencies (task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on uuid REFERENCES tasks(id) ON DELETE CASCADE, tenant_id uuid NOT NULL REFERENCES tenants(id),
  condition text NOT NULL DEFAULT 'done' CHECK (condition IN ('done','accepted')),   -- done = xong phần thực hiện; accepted = điểm kiểm tra (§8.7)
  PRIMARY KEY (task_id, depends_on), CHECK (task_id <> depends_on));               -- chống vòng dài hơn: kiểm ở taskPolicy khi tạo
CREATE TABLE task_reports (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(), progress int, note text, minutes int,
  by_type text NOT NULL, by_user uuid, by_worker uuid);
CREATE TABLE task_outputs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, version int NOT NULL, kind text NOT NULL,
  title text, content text, object_path text, mime text, size_bytes bigint,
  held_for_review boolean NOT NULL DEFAULT false,   -- kết quả "chạy lại với quyền bộ phận" chờ người phụ trách duyệt chuyển
  created_at timestamptz NOT NULL DEFAULT now());

-- ===== Orchestrator =====
CREATE TABLE orchestrator_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  commander_id uuid NOT NULL REFERENCES users(id), command text NOT NULL, plan jsonb NOT NULL,
  status text NOT NULL,                       -- proposed | confirmed | cancelled | done
  project_id uuid, acceptor_id uuid, summary_report text,
  created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz);

-- ===== Nối với động cơ chạy (tài liệu Admin §9.5, §7.7) =====
ALTER TABLE worker_runs ADD CONSTRAINT worker_runs_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id),
                        ADD CONSTRAINT worker_runs_conv_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id);

-- ===== Thông báo =====
CREATE TABLE notifications (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL,
  kind text NOT NULL, title text NOT NULL, link text, ref jsonb, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notification_prefs (user_id uuid, kind text, tenant_id uuid NOT NULL REFERENCES tenants(id),
  in_app boolean NOT NULL DEFAULT true, email boolean NOT NULL DEFAULT false, PRIMARY KEY (user_id, kind));
```

Mỗi request của tenant đặt `app.user_id` và `app.is_tenant_admin` cùng lúc với `app.tenant_id` (tài liệu Admin §7.7).

- **`app.is_tenant_admin` mặc định `'false'` ở mọi route, kể cả khi người gọi là `tenant_admin`.** Chỉ hai handler được đặt `'true'`: `GET /users/:id/conversations` và `GET /users/:id/conversations/:cid`, và hai handler này ghi nhật ký `conversation.viewed`. Nhờ vậy một route khác lỡ truy vấn sai cũng không để Admin thấy hội thoại của người khác.
- **Phiên hỗ trợ của SuperAdmin** luôn `'false'` và bị middleware chặn ở mọi route hội thoại (`supportBlocked`, tài liệu Admin §22.8).
- **Tác vụ nền** (xoá hẳn hội thoại sau 30 ngày, xoá dữ liệu tenant khi hết hợp đồng) chạy qua hàm `SECURITY DEFINER` hẹp (tài liệu Admin §7.7), không dùng role có quyền đọc bảng.
- **Xuất dữ liệu tenant** (B8) chỉ đưa hội thoại vào khi Admin tick chọn; dùng đúng handler có đặt `'true'` và ghi `conversation.exported`.

---

## 17. API Workspace

Nằm dưới `tenantabc.{BASE_DOMAIN}/api/v1/`, theo quy ước tài liệu Admin §17: phiên cookie, CSRF, lỗi thống nhất, không có API token.

| Nhóm | Endpoint |
|---|---|
| **Trang chủ** | `GET /me/today` |
| **Danh bạ Worker** | `GET /directory/workers?dept&unit&function&relation&q` (kèm `relation` của người xem) · `GET /directory/workers/:id` (hồ sơ chỉ đọc) |
| **Hội thoại** | `GET/POST /conversations` · `GET/PATCH/DELETE /conversations/:id` · `POST /conversations/:id/restore` · `GET /conversations/:id/messages` · `POST /conversations/:id/messages` (trả về luồng SSE) · `POST /conversations/:id/stop` · `POST /messages/:id/feedback` · `POST /conversations/:id/to-task` |
| **Orchestrator** | `POST /orchestrator/plans` (lệnh → kế hoạch) · `PATCH /orchestrator/plans/:id` (sửa) · `POST /orchestrator/plans/:id/{confirm,cancel}` · `GET /orchestrator/plans?status` · `GET /orchestrator/plans/:id` |
| **Dự án & phiếu** | `projects` CRUD · `PUT /projects/:id/members` · `POST /projects/:id/workers` (mời) · `DELETE /projects/:id/workers/:wid` (rút, người phụ trách) · `PATCH /projects/:id/workers/:wid` (bật tài liệu Mật) · `tickets` CRUD |
| **Công việc** | `GET /tasks?view=mine\|requested\|my-workers\|scope&status&project&q` · `POST /tasks` (qua `taskPolicy.create`) · `GET/PATCH /tasks/:id` · `POST /tasks/:id/{start,submit,accept,rework,pause,cancel,reassign,rerun,rerun-with-dept-authority,release-held-output}` · `GET/POST /tasks/:id/reports` · `GET /tasks/:id/outputs` · `POST /tasks/:id/outputs/:oid/propose-to-library` |
| **Điều phối** | `GET /coordination?reason` |
| **Yêu cầu liên phòng** | `GET /requests?box=sent\|incoming` · `POST /requests` (tạo công việc `origin=request`) |
| **Phê duyệt** | `GET /approvals?box=mine` · `POST /approvals/:id/{approve,reject,edit-approve}` |
| **Kết quả** | `GET /outputs?project&worker&type&q` · `GET /outputs/:id/download` |
| **Báo cáo** | `GET /reports?user&worker&project&from&to` · `GET /reports/export.csv` · `GET /control-room` · `GET /workload` |
| **Thông báo & tài khoản** | `GET /notifications` · `POST /notifications/read` · `GET/PUT /me/notification-prefs` · `GET/PATCH /me` · `GET /me/sessions` · `DELETE /me/sessions/:id` · `GET /me/usage` |

**Phía Quản trị** (bổ sung vào tài liệu Admin §17): `PATCH /users/:id/permissions` (`canCommandOrchestrator`, `canCreateProject`) · `GET /users/:id/conversations` · `GET /users/:id/conversations/:cid` (ghi nhật ký `conversation.viewed`).

---

## 18. Lộ trình (ghép vào các giai đoạn của tài liệu Admin §19)

| GĐ | Workspace làm gì | Kết quả kiểm chứng được |
|---|---|---|
| **0a** | Chưa có tính năng Workspace. Chuẩn bị middleware đặt `app.user_id`, `app.is_tenant_admin` (mặc định `'false'`); nền frontend theo thiết kế (token, thành phần dùng chung, CSP) | — |
| **0b** | Khung Workspace sau đăng nhập (thanh bên theo §21.1, các mục chưa có tính năng thì ẩn); chuyển khu vực Workspace ⇄ Quản trị qua menu tài khoản; quên mật khẩu, đổi mật khẩu lần đầu, nhận lời mời; màn tổ chức bị vô hiệu hoá | `member` đăng nhập thấy Workspace, **không** thấy Quản trị; gọi `/api/v1/admin/*` trả `403` |
| **1a** | Sơ đồ tổ chức chỉ xem (§4.2, §21.6) | Sơ đồ khớp cấu hình ở Quản trị |
| **1b** | Hôm nay; Danh bạ Worker + mức quan hệ + chính sách nhận việc + U13; Hội thoại (chưa trích dẫn Knowledge) và quyền riêng tư; Công việc / Dự án / Phiếu / Dashboard theo **trạng thái cấu hình được**; `taskPolicy.create`; **chuỗi công việc** (§8.7); Orchestrator có ngữ cảnh, kế hoạch, duyệt từng việc, theo dõi dải chuỗi; Điều phối; **liên kết Telegram** và ra lệnh Orchestrator qua Telegram (U15); thông báo trong Workspace | Bảng kiểm `relation()` đủ nhánh. Chuỗi 3 bước chạy liền không chờ nghiệm thu từng bước; bước giữa vướng thì bước sau «Chờ việc trước», sửa ở Điều phối xong tự chạy tiếp; tick «chờ nghiệm thu» thì chuỗi dừng đúng chỗ. Quản lý đọc hội thoại của nhân viên nhận `403`; Admin đọc được và có nhật ký. Lệnh Telegram từ người chưa liên kết hoặc không có quyền bị từ chối |
| **2** | Trích dẫn Knowledge; lọc tài liệu Mật theo tập `item_id`; «Chạy lại với quyền bộ phận» + duyệt chuyển; Yêu cầu liên phòng; Worker tham gia dự án; Kết quả và đề xuất vào Kho; góp ý 👍👎; **hộp Phê duyệt** (theo Quy tắc duyệt, chuỗi cấp, uỷ quyền) và **duyệt qua Telegram**; **Chat Social** (Worker gắn cờ, Dừng tay / Trả lại, trả lời nhanh, tag) | Yêu cầu từ Kinh doanh tới Worker Kế toán **không** trả về số liệu trong tài liệu Mật cho tới khi người phụ trách duyệt chuyển. Worker Chat Social không có tài liệu liên quan thì chuyển người, không tự trả lời. Một hành động chỉ sinh một yêu cầu duyệt |
| **3** | Chi phí theo bộ phận người yêu cầu; Tài khoản › Mức sử dụng; thông báo qua email; báo cáo xuất CSV; **chat nội bộ giữa nhân sự** (tài liệu Admin §25.4) | Báo cáo chi phí cho thấy đúng phòng nào dùng Worker của phòng nào |
| **4** | Hộp thư cá nhân; MFA người dùng; các hành động gửi ra ngoài của Worker (email, đăng bài) qua Phê duyệt | Email do Worker soạn chỉ được gửi sau khi người được chỉ định duyệt |

---

## 19. Kiểm thử trọng yếu

| Nhóm | Kiểm |
|---|---|
| **Mức quan hệ** | Kiểm bảng: 3 chính sách × (cùng bộ phận / quản lý trong phạm vi / được cấp riêng / người ngoài / admin / viewer) → đúng mức ở §5.3. Thêm ca viewer có trong `accessUserIds` → vẫn «Chỉ xem» |
| **Không lách quyền** | Gọi `POST /tasks` trực tiếp tới Worker mức Qua yêu cầu thì thành yêu cầu, không chạy dạng trực tiếp. Gọi `POST /orchestrator/plans` khi không có quyền thì `403`. Gửi `run_mode` hay `confidential_allowed` từ client thì bị bỏ qua. Giao việc `origin = orchestrator` cho Worker «không nhận lệnh từ Orchestrator» thì bị từ chối `ORCHESTRATOR_NOT_ACCEPTED`; cùng Worker đó vẫn nhận việc từ chat, dự án, yêu cầu theo mức quan hệ |
| **Chuỗi công việc** | Điều kiện `done` / `accepted`; giờ bắt đầu đã hẹn; bước vướng → bước sau «Chờ việc trước» → xử lý xong tự chạy; đóng «không đạt» → hỏi người phụ trách chuỗi; «Làm lại» bước trước → bước sau «Đầu vào đã đổi», không tự chạy lại; phụ thuộc vòng tròn bị từ chối |
| **Chat Social** | Worker không gắn cờ không chọn được làm Worker tự trả lời; câu hỏi ngoài Knowledge được gán → chuyển người; tài liệu Mật không bao giờ vào câu trả lời; webhook lặp lại không tạo tin trùng; người không có quyền kênh không thấy cuộc chat |
| **Telegram** | Webhook sai `secret_token` bị bỏ; mã liên kết dùng lần hai hoặc quá 10 phút bị từ chối; lệnh trong nhóm chat bị bỏ qua; người khác người ra lệnh bấm Duyệt thì bị từ chối |
| **Tài liệu Mật** | Mỗi đường giao việc × người có quyền / không có quyền → tài liệu Mật có hay không có trong kết quả tìm kiếm (kiểm ở tầng `knowledgeStore.search()`, không kiểm qua câu trả lời của model). Bật rồi tắt cờ Mật, truy vấn ngay sau mỗi lần đổi → kết quả đổi theo |
| **Rule luôn áp dụng** | Việc từ Orchestrator vào Worker có Rule `hard` thì vẫn bị chặn |
| **Riêng tư hội thoại** | Chủ: ✔ · Admin: ✔ và có nhật ký · Quản lý: `403` · Người phụ trách Worker: `403` · Phiên hỗ trợ SuperAdmin: `403` · Truy vấn SQL thử bỏ điều kiện người dùng, trên cả `conversations`, `messages`, `message_feedback`: RLS chặn · `tenant_admin` gọi route **không** phải handler đọc hội thoại: thấy 0 dòng của người khác · `aios_console` đọc 4 bảng nội dung riêng tư: `permission denied` · Người phụ trách Worker đọc được `feedback_shares` gửi cho mình nhưng không đọc được hội thoại gốc |
| **Phạm vi dữ liệu** | Mỗi dòng của §12.2 có ít nhất một ca được thấy và một ca không được thấy |
| **Trạng thái tenant** | `suspended`: không gửi tin nhắn, không tạo việc; vẫn xem được dữ liệu cũ |

---

## 20. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Lộ tài liệu Mật qua câu trả lời của Worker cho phòng khác | **Cao** | Lọc ngay ở truy vấn Qdrant, không dựa vào lời dặn trong prompt; cờ `confidential_allowed` ghi cứng trên công việc; kết quả "chạy với quyền bộ phận" phải qua người phụ trách duyệt chuyển |
| Quyền ra lệnh Orchestrator bị cấp tràn lan, biến chính sách nhận việc thành vô nghĩa | Trung bình | Quyền cấp từng người, có nhật ký; Quản trị › Người dùng hiển thị rõ danh sách người đang có quyền; người phụ trách Worker luôn được báo khi có việc từ Orchestrator; Worker nhạy cảm đặt «không nhận lệnh từ Orchestrator» (U13) |
| Người dùng tưởng hội thoại hoàn toàn riêng tư | Trung bình | Ghi rõ trong màn chào lần đầu và ở chân khung chat: "Quản trị viên công ty có thể xem hội thoại khi cần; mọi lần xem đều được ghi lại" |
| Việc của Worker bị bỏ quên ở trạng thái Chờ nghiệm thu | Trung bình | Nhắc sau 1 ngày; hiện trên trang Hôm nay và Dashboard |
| Chuỗi dài dừng giữa chừng mà không ai biết | Trung bình | Dải chuỗi hiện bước vướng và lý do; người phụ trách chuỗi và người phụ trách Worker được báo ngay (kể cả Telegram); xử lý xong chuỗi tự chạy tiếp (§8.7) |
| "Tự nhận và báo" làm Worker phòng khác quá tải | Trung bình | Ngân sách ngày của Worker vẫn áp dụng; người phụ trách tạm dừng hoặc trả lại được; báo cáo chi phí theo bộ phận người yêu cầu cho thấy ai đang dùng nhiều |

---

## 21. Cập nhật theo thiết kế giao diện (v2.0 · 11/2026)

> Chương này gom mọi điều chỉnh **chức năng và logic** của Workspace phát sinh trong lúc thiết kế giao diện (board 52–145 trên canvas). Chỗ nào ở các chương trước mâu thuẫn với chương này thì **chương này là bản chốt**; các chương trước đã được sửa tại chỗ ở những điểm chính. Logic dùng chung với Admin và Console (bộ phận, quan hệ người–Worker, Rule toàn công ty, quy tắc duyệt, trạng thái cấu hình được, kênh chat) xem **tài liệu Admin §24.0**.

### 21.1 Điều hướng

**Thanh bên trái (thứ tự chốt):** Hôm nay · Orchestrator (nếu có quyền) · Worker · Hội thoại · **Chat Social** (mới) · Công việc · **Yêu cầu liên phòng** · Phê duyệt · Kết quả · Sơ đồ — rồi nhóm dưới: Thông báo · Tài khoản.

| Thay đổi | Chi tiết |
|---|---|
| "Yêu cầu" → **"Yêu cầu liên phòng"** | Phân biệt với *Phiếu yêu cầu*: **Yêu cầu liên phòng** = người dùng gửi việc tới Worker của **phòng khác** (đường ④, §9), Worker tự nhận và báo người phụ trách. **Phiếu yêu cầu** = phiếu trong một **dự án**, gom nhiều Công việc (tab trong Công việc). Hai thứ khác nhau, giữ hai tên khác nhau |
| Tab Công việc | Thứ tự: **Dashboard** (đổi tên từ "Phòng điều hành") · **Dự án** · Phiếu yêu cầu · Công việc · Điều phối · Báo cáo. Dự án là tab, **không** là mục menu riêng |
| "Nhân sự & Worker" | **Bỏ hẳn**: không tab, không mục menu, không màn riêng; board thiết kế đã xoá |
| Nút quay lại | Mọi trang chi tiết có nút về danh sách: "← Danh bạ Worker" (hồ sơ Worker 3 mức và Gửi yêu cầu), "← Danh sách dự án", "← Danh sách công việc" |
| Chat không chuyển trang | Bấm "Chat" ở Danh bạ / Hôm nay / Hồ sơ Worker mở **ngăn chat trượt từ phải, rộng 2/3 màn hình** (board 83), tiêu đề và ô nhập cố định, có "Mở toàn màn hình" |

### 21.2 Chat Social (mục mới, board 140, 141)

**Mục đích:** một hộp thư chung cho tin nhắn **khách hàng** từ các kênh social đã kết nối (Zalo OA, Facebook Messenger, Webchat, WhatsApp…). Worker được giao **tự trả lời**; nhân viên theo dõi và **Dừng tay** khi cần tự trả lời. Khác với *Hội thoại* (§7) là trò chuyện nội bộ giữa người dùng và Worker.

**Bố cục 3 cột** + thanh chỉ số (đang mở, chưa đọc, Worker đang trả lời, nhân viên đang trả lời, thời gian phản hồi trung bình) + nút "⚙ Kênh kết nối" (mở **Admin › Chat Social**, chỉ người có quyền Quản lý kênh). Chat Social **luôn có** trên thanh menu của mọi người dùng; người chưa được cấp kênh nào thấy trạng thái trống kèm hướng dẫn liên hệ quản trị viên.

| Cột | Nội dung |
|---|---|
| Trái — danh sách cuộc chat | Ô tìm (tên, SĐT, nội dung). **Ô chọn Kênh** (mặc định **Tất cả**, kèm số lượng từng kênh). **Ô chọn Trạng thái** (mặc định **Tất cả** · Chưa đọc · Worker đang trả lời · Nhân viên đang trả lời · Đã đóng). **Ô chọn Phụ trách** (tất cả · của tôi · từng người · từng Worker · chưa giao). Mỗi dòng: avatar + icon kênh, tên khách, tin cuối, thời gian, số chưa đọc, nhãn người đang phụ trách (🤖 Worker / 👤 nhân viên / Đã đóng) |
| Giữa — khung chat | Đầu: tên khách, kênh, ô **Phụ trách** (đổi người / Worker), nút Đóng. **Thanh trạng thái phụ trách** (xem dưới). Tin nhắn: khách bên trái, Worker (nền tím, nhãn 🤖) và nhân viên (nền xanh lime, nhãn 👤) bên phải; ảnh / tệp hiển thị trực tiếp. Ô soạn: **gửi hình / tệp**, **⚡ trả lời nhanh** (gõ `/` để tìm mẫu), **🏷 gắn tag**, **😊 emoji**, Gửi |
| Phải — khách hàng | SĐT, khu vực, đơn gần nhất, **tag** (＋ Tag), Worker phụ trách (kênh nó trả lời, số cuộc chat hôm nay, tỉ lệ tự xử lý), **quy tắc chuyển người** (vd. khách hỏi giá sỉ, khiếu nại, đổi trả) |

**Hai trạng thái phụ trách một cuộc chat:**

| Trạng thái | Hiển thị | Ô soạn | Chuyển |
|---|---|---|---|
| **Worker đang trả lời** | Thanh tím "CSKH Agent đang tự trả lời cuộc chat này", nút **✋ Dừng tay** | Khoá (gợi ý bấm Dừng tay) | Dừng tay → nhân viên |
| **Nhân viên đang trả lời** | Thanh vàng "Bạn đang trả lời · Worker tạm dừng ở cuộc chat này và chỉ gợi ý", nút **🤖 Trả lại cho Worker**; dòng hệ thống "X đã dừng tay lúc HH:MM" | Mở; có ô **🤖 Gợi ý** của Worker (bấm "Dùng" để chèn) | Trả lại → Worker |

**Quy định:**
- Dừng tay chỉ áp cho **một cuộc chat**, không tắt Worker ở kênh. Ai dừng tay thì thành người phụ trách cuộc chat đó.
- Worker **tự chuyển người** (và báo người phụ trách kênh) khi chạm quy tắc chuyển người, khi chạm Rule, hoặc khi hành động cần duyệt theo **Quy tắc duyệt** (vd. gửi ZNS hàng loạt).
- Không trả lời trong N phút sau khi dừng tay → nhắc người đang phụ trách; quá ngưỡng → báo Điều phối.
- Trả lời nhanh lấy từ danh mục mẫu của công ty (Admin quản lý); tag khách dùng chung danh mục tag khách hàng.
- Rule, ngân sách ngày của Worker và Ví credit áp dụng đầy đủ cho phần Worker tự trả lời.
- **Chỉ Worker gắn cờ «Chat Social»** được giao tự trả lời. Worker đó **chỉ trả lời từ Knowledge gắn cho chính nó**, không dùng tài liệu Mật, không trả lời bằng kiến thức chung; không có tài liệu liên quan thì gửi câu chờ và **chuyển người**. Ngoài trả lời và chuyển người, Worker không làm hành động nào khác trong Chat Social (tài liệu Admin §9.5.12).
- **Giai đoạn:** GĐ 2. Trước GĐ 2 mục Chat Social chưa hiện trên menu.
- **Quyền xem cuộc chat khách hàng** do Admin cấp **theo từng kênh** ở Admin › Chat Social (Admin §24.17), 4 mức: Chỉ xem · Xem & trả lời · Gán phụ trách · Quản lý kênh. Người dùng chỉ thấy cuộc chat (và bộ lọc kênh) của kênh mình được cấp. Quy tắc riêng tư U5 của Hội thoại nội bộ không áp cho Chat Social. Kết nối và cấu hình kênh (trang Zalo OA / Fanpage / Webchat / WhatsApp, giờ Worker trả lời, điều kiện chuyển người, lời chào) cũng ở Admin › Chat Social.

### 21.3 Orchestrator (board 52, 53, 91)

Khung ra lệnh theo tone chung: icon 🧭, "Orchestrator — Điều phối trưởng", nhãn **Mô hình** và **Chế độ lập kế hoạch**, ô lệnh + nút **Giao việc ⏎**, chip **Gợi ý lệnh**, dòng **Lệnh vừa gửi**.

**Luồng mới (thay §6.3):**

```
1. Gõ lệnh + (tuỳ chọn) chọn NGỮ CẢNH LIÊN QUAN:
   [📁 Dự án ▾]  [🎫 Phiếu yêu cầu ▾]  [☑ Công việc liên quan ▾]   → hiện thành chip ✕
2. Giao việc → LUÔN ra màn KẾ HOẠCH (chưa chạy gì), dù có chọn ngữ cảnh hay không
   Ngữ cảnh: 📁 Khuyến mãi T12 · 🎫 PYC-0412 · ☑ Chốt bảng giá KM
   ☑ #  Worker            Việc                         Hạn    Credit  Trạng thái        Thao tác
   ☑ 1  📱 Social Agent    Viết 7 bài fanpage           05/12  ~6.000  ✔ Sẵn sàng        [✎ Sửa] [⏸ Dừng]
   ☑ 2  💼 Sales Agent     Email 120 khách cũ ✋ duyệt   06/12  ~7.000  ⏸ Đã dừng · sửa   [▶ Chạy lại]
        └ Sửa tại chỗ: Giao cho (Worker / người) · Đối tượng · Hạn · Chạy sau · Đầu bài
          [Huỷ sửa] [Bỏ việc này] [✔ Lưu & duyệt việc này]
   ☑ 3  ⚖️ Legal Agent     Rà thể lệ khuyến mãi          04/12  ~5.000  ✔ Sẵn sàng
   Người nghiệm thu [▾]   Báo cáo tổng hợp [Khi xong tất cả ▾]   Trần ngân sách [18.000 credit ▾]
   [Huỷ kế hoạch]   [Duyệt N việc sẵn sàng]   [✔ Duyệt chạy toàn bộ]
3. Duyệt → tạo Công việc (nguồn = orchestrator), gắn vào dự án / phiếu đã chọn; chạy theo phụ thuộc
4. Theo dõi trên màn Orchestrator (board 53); xong thì gửi BÁO CÁO TỔNG HỢP
```

| Hạng mục | Quy định |
|---|---|
| Ngữ cảnh | Không bắt buộc. Orchestrator đọc mục tiêu, tài liệu và tiến độ của dự án / phiếu / công việc đã chọn để chọn Worker và viết đầu bài; việc mới **tự gắn** vào dự án / phiếu đó. Chỉ chọn được mục người ra lệnh có quyền xem |
| Duyệt chạy toàn bộ | Chạy mọi việc đang tick và ở trạng thái Sẵn sàng |
| Dừng một việc | Việc chuyển "Đã dừng · đang sửa", mở form sửa ngay tại dòng; **các việc khác vẫn duyệt được** ("Duyệt N việc sẵn sàng"). Việc phụ thuộc vào việc đang dừng sẽ chờ |
| Lưu & duyệt việc này | Duyệt riêng việc vừa sửa |
| Bỏ việc này | Loại khỏi kế hoạch (ghi lý do vào nhật ký kế hoạch) |
| Trần ngân sách | Áp cho cả kế hoạch; chạm trần thì dừng các việc chưa chạy và báo người ra lệnh |
| Không có Worker phù hợp / vì sao chạy mức "Mở" | Giữ nguyên quy định §6.2 và §6.3; thông tin gói vào **ghi chú dưới bảng kế hoạch**, không còn khối riêng bên phải |

### 21.4 Danh bạ & Hồ sơ Worker

- **Danh bạ (board 54, 142):** nút **▦ Lưới / ☰ Danh sách**; dạng danh sách: Worker, bộ phận, người phụ trách, mức của tôi, trạng thái, việc đang làm, thao tác (Chat / Gửi yêu cầu / Xem hồ sơ).
- **Hồ sơ Worker (thay khối ở §5.4):**
  - **Tri thức:** danh sách mở ra được, "12 tài liệu · 9 xem được tên · 3 🔒 Mật": hiện **tên + phiên bản + ngày cập nhật** của tài liệu **không Mật**; tài liệu Mật gộp một dòng, ẩn tên. Không hiện nội dung.
  - **Đang làm:** danh sách "N việc đang thực hiện · M trong hàng chờ": tên việc (bấm mở), nguồn và người giao (dự án / yêu cầu liên phòng / Orchestrator), trạng thái, tiến độ; việc trong hàng chờ ghi chờ sau việc nào. **Chỉ hiện việc người xem có quyền xem**; việc khác chỉ hiện số lượng.
  - Mở từ hội thoại thì là **modal chỉ đọc** (board 84) với "Đóng" và "＋ Giao việc".

### 21.5 Hội thoại

| Thay đổi | Chi tiết |
|---|---|
| Khung chat cố định | Trang cao bằng màn hình; tiêu đề và ô nhập đứng yên; chỉ vùng tin nhắn cuộn; danh sách bên trái cuộn riêng |
| Danh sách hội thoại | Tên Worker hiện dưới tên hội thoại |
| ＋ Hội thoại mới | Modal **Chọn người trò chuyện** (board 86): ô tìm; **Worker** (mức Trực tiếp; Worker mức Qua yêu cầu hiện mờ kèm gợi ý "Gửi yêu cầu"). Nhóm **Nhân sự nội bộ** (chat giữa người với người, kèm trạng thái trực tuyến) **ẩn tới GĐ 3** (tài liệu Admin §25.4) |
| Tạo công việc từ hội thoại | Modal ngay trên màn chat (board 85), không chuyển tab |
| Icon Worker | Mở modal hồ sơ Worker (board 84) |
| Trạng thái chat | Worker đang viết (có nút dừng); Worker tạm dừng (ô nhập khoá, hiện lý do và người phụ trách) |
| 👎 Góp ý câu trả lời | Modal: lý do (sai thông tin / thiếu nguồn / không đúng quy trình / văn phong / khác) + góp ý; gửi tới người phụ trách Worker để cải thiện |
| Quản lý hội thoại | Đổi tên · Lưu trữ (mở lại được) · Xoá |

### 21.6 Sơ đồ tổ chức › Người dùng ↔ Worker (board 78, 143, 145)

Thay ma trận (hàng = người, cột = Worker) vì không hiển thị được khi có 50+ Worker. Mục tiêu chính: **làm rõ ai quản lý Worker nào**.

- **3 thẻ chú giải:** 👑 **Phụ trách (quản lý)** — người chịu trách nhiệm Worker: cấu hình, duyệt việc ra ngoài, nhận cảnh báo; **mỗi Worker đúng 1 người** · ✔ **Dùng trực tiếp** — chat và giao việc thẳng · ✉ **Qua yêu cầu / 👁 Chỉ xem**.
- Nút chuyển **Theo người dùng / Theo Worker**; lọc bộ phận, loại quan hệ (vd. chỉ người phụ trách), ô tìm người hoặc Worker.
- **Theo người dùng:** gom theo bộ phận (khối thu gọn được, "＋ n người khác"); mỗi dòng: người (vai trò) · **Worker họ phụ trách** (chip đen 👑) · Worker dùng trực tiếp · số Worker chỉ gửi yêu cầu được.
- **Theo Worker:** mỗi dòng: Worker · bộ phận · **người phụ trách (quản lý)** · người dùng trực tiếp (avatar + số) · nhận yêu cầu từ phòng nào · ai chỉ xem; phân trang.
- Workspace chỉ xem; sửa ở Admin › Sơ đồ tổ chức (Admin §24.10).

### 21.7 Công việc, Dự án, Phiếu

| Màn | Thay đổi |
|---|---|
| Dashboard | Đổi tên từ "Phòng điều hành". Chỉ số, ngưỡng (trễ hạn, thiếu báo cáo) và trạng thái **do Admin cấu hình** (Admin §24.3) |
| Trạng thái (§8.2) | Danh sách trạng thái, màu, nhóm và chuyển trạng thái được phép đọc từ cấu hình Admin; Workspace chỉ hiện nút chuyển hợp lệ, trạng thái "bắt buộc lý do" mở ô lý do |
| Phiếu yêu cầu | Bấm mã phiếu (▶) **sổ ngay** danh sách công việc trong phiếu (tên, người thực hiện, trạng thái, tiến độ, hạn) + "Mở chi tiết phiếu →". Trang **Chi tiết phiếu** (board 98): tiến độ cuộn lên từ công việc, người xử lý, hạn, công việc trong phiếu, Sửa phiếu, ＋ Công việc. Modal **Tạo phiếu** (tiêu đề, loại, ưu tiên, hạn, người xử lý: người hoặc Worker đã tham gia dự án) |
| Chi tiết dự án | "← Danh sách dự án"; modal Thêm người (vai trò trong dự án), Mời Worker (báo người phụ trách Worker), Sửa dự án (đơn vị chủ trì, PM, hạn, trạng thái) |
| Người phụ trách Worker khi Worker được mời vào dự án | Thông báo + modal: lời mời tự chấp nhận; công tắc **"Cho phép dùng tài liệu Mật trong dự án này"** (mặc định tắt); có thể **rút Worker** khỏi dự án kèm lý do |
| Chi tiết công việc | "← Danh sách công việc"; trạng thái chờ duyệt hiện **người đang giữ, hạn duyệt và hậu quả quá hạn**; modal **Báo cáo tiến độ** (%, phút làm, ghi chú, tệp ≤ 20 MB); **Tạm dừng / Huỷ việc** (lý do bắt buộc); **Trả về làm lại** khi nghiệm thu chưa đạt (góp ý → Worker tạo phiên bản kết quả mới, giữ bản cũ để so sánh) |

### 21.8 Điều phối, Phê duyệt, Yêu cầu liên phòng, Kết quả

| Màn | Thao tác (modal) |
|---|---|
| Điều phối | Lọc theo lý do vướng (lỗi chạy, hết ngân sách, bị Rule chặn, cần tài liệu Mật, thiếu thông tin). **Đổi người thực hiện** (nhân sự hoặc Worker khác bạn được giao trực tiếp) · **Sửa đầu bài rồi chạy lại** (đầu bài cũ giữ trong lịch sử) · **Đóng việc kèm lý do** (Không đạt / Đã xử lý ngoài hệ thống) |
| Tài liệu Mật (§11.3) | Người phụ trách chạy lại với quyền bộ phận → **Xem trước kết quả trước khi chuyển** (vùng số liệu Mật tô vàng) → **Sửa / che số liệu** (che, làm tròn, về bản gốc; ghi nhật ký) → Duyệt chuyển bản đã che; hoặc **Trả lời "không cung cấp được"** kèm lý do (việc đóng với kết quả đó) |
| Phê duyệt | Duyệt · **Sửa rồi duyệt** (sửa tiêu đề, người nhận, nội dung) · **Từ chối kèm góp ý** (lý do + góp ý cho Worker; việc vào Điều phối "Bị từ chối phê duyệt"). Quy tắc nào phải duyệt, ai duyệt, hạn và xử lý quá hạn lấy từ **Quy tắc duyệt** (Admin §24.5); người được uỷ quyền duyệt thay thấy mục của người uỷ quyền |
| Yêu cầu liên phòng | Hai tab: Tôi đã gửi · Gửi tới Worker tôi phụ trách. Người phụ trách: **Tạm dừng yêu cầu** (lý do) · **Trả lại yêu cầu** (lý do, người gửi được báo, trạng thái "Đã trả lại"). Chi phí tính cho bộ phận người gửi |
| Kết quả | Xem kết quả: so sánh 2 phiên bản (đánh dấu thêm / bỏ), tải bản bất kỳ. **Đề xuất đưa vào Kho**: tên mục Knowledge, kho đích (bộ phận / ngành dọc), gợi ý loại tài liệu và trạng thái (Đang dùng / Lưu trữ) → tạo bản nháp trong Kho cho người quản lý duyệt |

### 21.9 Đăng nhập, tài khoản, trạng thái tổ chức

| Màn | Quy định |
|---|---|
| Quên mật khẩu | Nhập email công việc; luôn báo "đã gửi" (không lộ email có tồn tại không); link dùng 1 lần, hết hạn 30 phút; gửi lại sau 60 giây. Khác với link mời và link đặt mật khẩu do Admin gửi (72 giờ) |
| Đổi mật khẩu lần đầu | Bắt buộc khi đăng nhập bằng mật khẩu tạm; theo **một quy tắc mật khẩu chung** (tài liệu Admin §6.2: ≥ 10 ký tự, chặn mật khẩu phổ biến, không trùng username/email, khác mật khẩu tạm); đổi xong đăng xuất các phiên khác |
| Nhận lời mời | Hiện bộ phận, vai trò, người quản lý (chỉ đọc); điền họ tên, chức danh, mật khẩu, đồng ý quy định; lời mời **hết hạn sau 72 giờ**, dùng một lần (thống nhất với Admin §24.11); hết hạn thì liên hệ người mời để gửi lại |
| Tổ chức quá hạn thanh toán | Banner trên Hôm nay; Worker vẫn đọc được lịch sử, chạy việc mới tuỳ chính sách ân hạn của gói |
| Tổ chức tạm ngưng / vô hiệu | Tạm ngưng: banner, không chạy việc mới. Vô hiệu: màn "Tổ chức này đã bị vô hiệu hoá", không đăng nhập được |
| Vai trò `viewer` | Theo §12.3: vào Workspace **chỉ đọc** — thấy Hôm nay, Danh bạ Worker (mức tối đa «Chỉ xem»), Sơ đồ, Công việc / Dự án trong phạm vi được xem, Báo cáo; không có nút giao việc, chat, gửi yêu cầu |
| Tài khoản (board 80) | 6 tab: Hồ sơ (bộ phận, vai trò chỉ quản trị viên đổi) · Bảo mật (đổi mật khẩu, MFA, phiên đăng nhập) · Hộp thư cá nhân · Thông báo · Giao diện · **Mức sử dụng** (đổi tên từ "Sử dụng của tôi") |
| Thông báo | Gộp thông báo cùng loại trong 15 phút; lọc Tất cả / Chưa đọc / Cần tôi xử lý / Worker tôi phụ trách; cài đặt thông báo |
| Di động | Hôm nay, Chat, Nghiệm thu trên điện thoại (bố cục 1 cột, thao tác nghiệm thu nhanh) |

### 21.10 Mô hình dữ liệu bổ sung

Theo quy ước tài liệu Admin §7.7 và §24.13: mọi bảng có `tenant_id uuid NOT NULL REFERENCES tenants(id)`, bật và ép RLS. Dữ liệu Chat Social **không** thuộc nhóm nội dung riêng tư của hội thoại nội bộ (U5): quyền đọc theo `social_channel_grants` (tài liệu Admin §24.13), kiểm ở Repository và bằng policy RLS dựa trên `app.user_id`.

```sql
-- ===== Chat Social (GĐ 2) =====
CREATE TABLE social_channels (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  kind text NOT NULL CHECK (kind IN ('zalo_oa','facebook','webchat','whatsapp')), name text NOT NULL,
  external_page_id text, secret jsonb,                -- token trang / OA trong két (tài liệu Admin §13.3)
  owner_department_id uuid NOT NULL REFERENCES departments(id),   -- bộ phận sở hữu kênh: chịu chi phí Worker trả lời
  auto_reply_worker_id uuid REFERENCES workers(id),   -- phải là Worker có social_agent = true (kiểm ở handler và trigger)
  business_hours jsonb, after_hours text, handoff_rules jsonb, handoff_to jsonb, greeting text,
  token_expires_at timestamptz, enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, external_page_id));
CREATE TABLE social_contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel_id uuid NOT NULL REFERENCES social_channels(id), external_id text NOT NULL,
  name text, phone text, attrs jsonb, UNIQUE (channel_id, external_id));
CREATE TABLE social_contact_tags (contact_id uuid REFERENCES social_contacts(id) ON DELETE CASCADE, tag text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id), PRIMARY KEY (contact_id, tag));
CREATE TABLE social_conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel_id uuid NOT NULL REFERENCES social_channels(id), contact_id uuid NOT NULL REFERENCES social_contacts(id),
  handler_kind text NOT NULL CHECK (handler_kind IN ('worker','user','none')),
  handler_worker_id uuid REFERENCES workers(id), handler_user_id uuid REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('open','closed')), unread int NOT NULL DEFAULT 0, last_message_at timestamptz,
  taken_over_by uuid REFERENCES users(id), taken_over_at timestamptz);
CREATE TABLE social_messages (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  author_kind text NOT NULL CHECK (author_kind IN ('contact','worker','user','system')), author_id uuid,
  body text, attachments jsonb, external_id text, run_id uuid REFERENCES worker_runs(id),
  sources jsonb,                                      -- mục Knowledge Worker đã dựa vào để trả lời (§9.5.12)
  sent_at timestamptz NOT NULL DEFAULT now(), UNIQUE (conversation_id, external_id));   -- webhook lặp lại không tạo tin trùng
CREATE TABLE quick_replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  shortcut text NOT NULL, body text NOT NULL, scope jsonb, UNIQUE (tenant_id, shortcut));
-- Xoá tự động theo social_settings.retention_months (tài liệu Admin §24.13)

-- ===== Orchestrator: ngữ cảnh và trạng thái từng việc trong kế hoạch (GĐ 1b) =====
-- orchestrator_plans thêm: context jsonb ({project_id, ticket_id, related_task_ids[]}), budget_cap bigint,
--   reviewer_id uuid, report_mode text, channel text CHECK (channel IN ('web','telegram')), approved_via text
CREATE TABLE orchestrator_plan_items (plan_id uuid REFERENCES orchestrator_plans(id) ON DELETE CASCADE, seq int,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  worker_id uuid REFERENCES workers(id), assignee_user_id uuid REFERENCES users(id),
  CHECK ((worker_id IS NULL) <> (assignee_user_id IS NULL)),
  brief text NOT NULL, audience text, start_at timestamptz, due_at timestamptz, depends_on int[] NOT NULL DEFAULT '{}',
  dep_condition text NOT NULL DEFAULT 'done' CHECK (dep_condition IN ('done','accepted')), est_credit bigint,
  state text NOT NULL CHECK (state IN ('ready','paused','approved','dropped')), drop_reason text,
  task_id uuid REFERENCES tasks(id), PRIMARY KEY (plan_id, seq));
```

### 21.11 API bổ sung (Workspace)

| Nhóm | Endpoint |
|---|---|
| Chat Social | `GET /social/conversations?channel=&status=&handler=` · `GET/POST /social/conversations/:id/messages` · `POST /social/conversations/:id/takeover` (Dừng tay) · `POST /social/conversations/:id/release` (Trả lại cho Worker) · `PATCH /social/conversations/:id` (phụ trách, đóng, tag) · `GET /social/quick-replies` |
| Orchestrator | `POST /orchestrator/plans` (lệnh + context) · `PATCH /orchestrator/plans/:id/items/:seq` (sửa / dừng / bỏ) · `POST /orchestrator/plans/:id/approve` (`{items:'all'|[seq…]}`) |
| Sơ đồ | `GET /org/relations?view=user\|worker&unit=&kind=&q=&page=` |
| Công việc | `GET /statuses?entity=` (đọc cấu hình Admin) · `POST /tasks/:id/rework` · `POST /tasks/:id/progress` |
| Chuỗi công việc | `PUT /tasks/:id/dependencies` (`[{dependsOn, condition}]`, kiểm vòng tròn) · `PATCH /tasks/:id` (`startRule`, `startAt`) · `POST /tasks/:id/rerun-from-here` · `POST /tasks/:id/chain-decision` (`continue` / `reassign` / `cancel_rest`) · `GET /chains/:rootId` (dải chuỗi) |
| Telegram | `POST /me/telegram/link-code` · `DELETE /me/telegram/link` · `GET /me/telegram` (tài liệu Admin §25.2) |

---

*Tài liệu v2.1, đi cặp với `ADMIN_PORTAL_DESIGN.md` v2.2 (Console SuperAdmin §22, cập nhật theo thiết kế §24, quyết định 03/11/2026 §25).*
