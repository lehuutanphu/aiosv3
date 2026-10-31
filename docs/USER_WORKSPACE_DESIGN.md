# AI OS Workspace — Tài liệu mô tả & thiết kế Không gian làm việc của người dùng

> **Phiên bản:** v1.1 — đã chốt U1–U11 (xem [§0.2](#02-quyết-định-đã-chốt)). So với v1.0 (sau đợt review): đổi tên menu «Yêu cầu» thành «Yêu cầu liên phòng» (§4.1, §9); thêm **U11** (Worker không nhận lệnh từ Orchestrator); U3 chuyển thành **gỡ** module demo; sửa thứ tự trong `relation()` (viewer đứng đầu); sửa RLS của nội dung riêng tư ở §16 và tách `feedback_shares`; cờ Mật lọc theo tập `item_id` lấy từ PostgreSQL; chia lại lộ trình thành 0a/0b/1a/1b ở §18.
> **Phạm vi:** thiết kế, chưa viết code. Đây là **tài liệu thứ hai**, đi cặp với [`ADMIN_PORTAL_DESIGN.md`](ADMIN_PORTAL_DESIGN.md) (gọi tắt **tài liệu Admin**). Phần nào tài liệu Admin đã đặc tả thì ở đây chỉ dẫn chiếu, không viết lại.
> **Nguồn giao diện:** dashboard hiện có tại `website/dashboard.html`, `website/js/app.js`, `website/js/work.js` (bản đang chạy ở workers.ai-os.vn), khảo sát tại commit `c89a426`.

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
| U2 | Quản lý công việc | **Tính năng lõi cho mọi tenant**: Dự án, Phiếu yêu cầu, Công việc, Điều phối, Báo cáo, Phòng điều hành |
| U3 | Module demo | Các module nghiệp vụ trong bản demo (HR, Sales, Marketing, TripX…) **bị gỡ khỏi bản production** (tài liệu Admin R1, §2.3). Workspace không có module nghiệp vụ riêng: mọi việc đi qua Công việc và Worker |
| U4 | Portal khách hàng | **Bỏ hẳn** khỏi cả hai tài liệu |
| U5 | Riêng tư hội thoại | Hội thoại của ai người đó xem. **Quản lý không xem được.** Chỉ `tenant_admin` xem được, và mỗi lần xem đều **ghi nhật ký**. **Phiên hỗ trợ của SuperAdmin không đọc được hội thoại** |
| U6 | Thấy Worker | **Phương án C**: thấy tất cả Worker đang hoạt động; giao việc theo 3 mức quan hệ |
| U7 | Chính sách nhận việc | Admin đặt cho từng Worker: **Mở / Theo bộ phận / Hạn chế** (mặc định Theo bộ phận) |
| U8 | Orchestrator | Việc giao qua Orchestrator **luôn chạy ở mức "Mở"**, bỏ qua chính sách nhận việc. Đổi lại, **chỉ người được cấp quyền mới ra lệnh được cho Orchestrator** (thường là CEO, Phó TGĐ). Rule vẫn áp dụng đầy đủ. Ngoại lệ duy nhất là Worker nhạy cảm đặt «không nhận lệnh từ Orchestrator» (U11) |
| U9 | Yêu cầu từ phòng khác | **Tự nhận và báo** cho người phụ trách Worker |
| U10 | Tài liệu Mật | Cờ **"Mật"** chỉ áp cho tài liệu **Knowledge**: chỉ bộ phận sở hữu Worker và Orchestrator được dùng. **Workflow, Skill, Rule luôn áp dụng đầy đủ** cho mọi người, để quy trình không bị hở. Quản lý cấp trên trong phạm vi được dùng trực tiếp |
| U11 | Worker nhạy cảm | Mỗi Worker có tuỳ chọn **«Không nhận lệnh từ Orchestrator»** (`accept_from_orchestrator`, mặc định vẫn nhận). Worker đặt tắt thì Orchestrator **không giao được**, kể cả cho người có quyền ra lệnh; người dùng vẫn giao qua các đường ②③④ theo mức quan hệ bình thường (§6.2) |

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

### 2.2 Chuyển đổi từ dashboard demo hiện tại

| Thành phần trong dashboard hiện tại | Xử lý |
|---|---|
| Ô ra lệnh Orches, luồng 4 bước "nhận lệnh → phân tích → giao → báo cáo" | **Giữ**, thành màn Orchestrator (§6). Chỉ hiện với người có quyền ra lệnh |
| Chat với Agent (tab "💬 Chat" trong ngăn chi tiết) | **Giữ**, thành màn Hội thoại (§7) |
| Phòng điều hành · Dự án · Phiếu yêu cầu · Công việc · Điều phối · Nhân sự & Agent · Báo cáo | **Giữ**, thành Quản lý công việc (§8). Dữ liệu chuyển từ localStorage và `data/work.json` sang PostgreSQL theo tenant |
| Sơ đồ tổ chức AI Workforce | **Giữ ở dạng chỉ xem** (§4.2). Sửa thì ở Quản trị |
| Tab "Hồ sơ & KWSR" (thêm/sửa/xoá tài liệu, workflow, skill, rule) | **Chuyển sang Quản trị.** Workspace chỉ còn hồ sơ chỉ đọc (§5.4) |
| Bấm nút CEO để sửa Global Rule | **Chuyển sang Quản trị** |
| Portal khách hàng, Luồng nghiệp vụ | **Bỏ** |
| 12 Agent khai báo cứng trong `AGENTS`, dữ liệu mẫu `seed()` | **Bỏ.** Danh bạ lấy từ CSDL; chỉ Worker `active`/`paused` mới hiện (§5) |
| Dòng hoạt động tự chạy (`AMBIENT`), số liệu và % trưởng thành gõ cứng | **Bỏ.** Mọi số liệu lấy từ dữ liệu thật |
| Các module nghiệp vụ của bản demo | Gỡ khỏi bản production (U3) |

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
├─ /cong-viec            Quản lý công việc                                      §8
│   ├─ Phòng điều hành   tổng quan trong phạm vi của tôi
│   ├─ Dự án             danh sách · chi tiết (thành viên, Worker tham gia, phiếu, tiến độ)
│   ├─ Phiếu yêu cầu
│   ├─ Công việc         việc của tôi · việc tôi giao · việc của Worker tôi phụ trách
│   ├─ Điều phối         việc đang vướng cần xử lý
│   ├─ Nhân sự & Worker  khối lượng việc theo người, Worker người đó phụ trách
│   └─ Báo cáo
├─ /yeu-cau              Yêu cầu liên phòng: Đã gửi · Tới Worker tôi phụ trách   §9
├─ /phe-duyet            Hộp chờ duyệt                                          §13
├─ /ket-qua              Kết quả bàn giao và tệp                                §10
├─ /so-do                Sơ đồ tổ chức (chỉ xem)                                §4.2
├─ /thong-bao            Trung tâm thông báo                                    §14
└─ /tai-khoan            Hồ sơ · mật khẩu · phiên đăng nhập · hộp thư cá nhân · thông báo   §15
```

Thanh bên trái của Workspace gồm: **Hôm nay · Orchestrator** (nếu có quyền) **· Worker · Hội thoại · Công việc · Yêu cầu liên phòng · Phê duyệt · Kết quả · Sơ đồ**. Mỗi mục có bộ đếm việc cần xử lý.

### 4.2 Sơ đồ tổ chức (chỉ xem)

Dùng lại 3 chế độ xem của tài liệu Admin §8.5 (theo đơn vị, theo ngành dọc, ma trận người ↔ Worker), nhưng **không có thao tác sửa**. Bấm vào một Worker thì mở hồ sơ Worker (§5.4). Mỗi Worker có nhãn mức quan hệ của người đang xem (✔ Trực tiếp / ✉ Qua yêu cầu / 👁 Chỉ xem).

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
Tri thức         12 tài liệu (3 🔒 Mật)                           (chỉ hiện số lượng)
Đang làm         2 việc · hàng chờ 1
```

- **Không hiện** nội dung Knowledge, nội dung Skill hay model đang dùng.
- Tên các Rule có hiện, để người dùng hiểu vì sao Worker từ chối một việc.
- Worker đã đặt «Không nhận lệnh từ Orchestrator» (U11) thì hồ sơ hiện dòng **«Việc từ Orchestrator: không nhận»**, để người có quyền ra lệnh biết vì sao không thấy Worker này trong kế hoạch.
- Với mức **Qua yêu cầu**, nút Chat được thay bằng **[✉ Gửi yêu cầu]**. Với mức **Chỉ xem**, chỉ có nút **[Liên hệ người phụ trách]**.

---

## 6. Orchestrator: ra lệnh giao việc cho cả đội

### 6.1 Ai được ra lệnh

- **Quyền ra lệnh Orchestrator** (`canCommandOrchestrator`) được Admin **cấp riêng cho từng người** ở Quản trị › Người dùng. Quyền này không gắn với vai trò. Thông thường chỉ cấp cho **CEO, Phó TGĐ** hoặc người được uỷ quyền điều hành.
- Khi tạo tenant, **Admin đầu tiên được cấp sẵn** để tenant dùng được ngay. Admin có thể chuyển quyền cho CEO rồi tự gỡ của mình.
- Người không có quyền **không thấy** mục Orchestrator trên thanh bên. Gọi API trực tiếp thì nhận lỗi `403`.
- Mọi lần cấp hoặc thu hồi quyền đều ghi nhật ký.

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
| **Worker đặt «Không nhận lệnh từ Orchestrator»** (U11) | ✖ **Không giao được.** Orchestrator loại Worker này khỏi kế hoạch và nói rõ «Worker X không nhận lệnh từ Orchestrator; hãy giao trực tiếp hoặc gửi yêu cầu». Gọi API cố giao thì `taskPolicy.create` từ chối với mã `ORCHESTRATOR_NOT_ACCEPTED`. Trong trình sửa kế hoạch, người ra lệnh không chọn được Worker này |

Do Orchestrator mạnh như vậy, **người phụ trách Worker luôn được báo** khi Worker của mình nhận việc từ Orchestrator.

**Worker nhạy cảm (U11).** Một số Worker không nên bị gọi qua đường tắt này dù người ra lệnh là CEO: Worker lương, kiểm toán, pháp chế nội bộ…

- **Ai đặt:** `tenant_admin`, hoặc `unit_manager`/`function_head` với Worker trong phạm vi của mình. Đặt trong trình tạo Worker (bước 1, tài liệu Admin §9.4) hoặc tab Thông tin của Worker. Mọi lần đổi ghi nhật ký.
- **Gợi ý, không tự bật:** khi Admin chọn chính sách nhận việc «Hạn chế», trình tạo gợi ý bật tuỳ chọn này nhưng để Admin quyết định. Quản trị › Worker có bộ lọc «Không nhận lệnh từ Orchestrator».
- **Phạm vi tác dụng:** chỉ chặn đường ① (Orchestrator). Người dùng vẫn giao cho Worker này qua chat, dự án hoặc yêu cầu theo mức quan hệ của họ (§5), nên việc đó chịu chính sách nhận việc và cờ Mật như bình thường.
- **Đổi tuỳ chọn giữa chừng:** chỉ ảnh hưởng việc tạo sau đó. Với kế hoạch Orchestrator đã xác nhận nhưng chưa tạo hết việc, các việc còn lại giao cho Worker này bị từ chối và vào Điều phối của người ra lệnh.

### 6.3 Luồng ra lệnh

```
1. Người có quyền gõ lệnh tự nhiên:
   "Chuẩn bị chương trình khuyến mãi tháng 12: nội dung fanpage, email khách cũ, rà điều khoản khuyến mãi"
2. Orchestrator phân tích và TRÌNH KẾ HOẠCH (chưa chạy gì):
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ Kế hoạch — 3 việc · ước tính ~18.000 credit                                   │
   │ 1. 📱 Social Agent (Marketing·TCT)   Viết 7 bài fanpage        hạn 05/12      │
   │ 2. 💼 Sales Agent (Kinh doanh·HN)    Email cho 120 khách cũ   hạn 06/12  ✋ cần duyệt gửi │
   │ 3. ⚖️ Legal Agent (Pháp lý·TCT)      Rà thể lệ khuyến mãi      hạn 04/12  → trước việc 2 │
   │ Gắn vào dự án: [— Không —  ▾]     Người nghiệm thu: [Tôi ▾]                    │
   │                                       [Sửa kế hoạch]  [Huỷ]  [✔ Xác nhận & giao] │
   └──────────────────────────────────────────────────────────────────────────────┘
3. Xác nhận → tạo 3 Công việc (nguồn = orchestrator), chạy theo thứ tự phụ thuộc
4. Theo dõi tiến độ ngay trên màn Orchestrator; xong thì Orchestrator gửi BÁO CÁO TỔNG HỢP
```

| Hạng mục | Quy định |
|---|---|
| Sửa kế hoạch | Đổi Worker, đổi hạn, bỏ bớt việc, sửa đầu bài từng việc, thêm phụ thuộc |
| Người nghiệm thu | Mặc định là người ra lệnh; có thể giao cho người khác (ví dụ trưởng phòng Marketing) ngay trong kế hoạch |
| Gắn dự án | Tuỳ chọn. Có gắn thì thành viên dự án thấy các việc này |
| Không có Worker phù hợp | Orchestrator nói rõ và đề xuất: giao cho **người** (chọn nhân sự), hoặc báo Admin tạo Worker mới. **Không tự bịa ra Worker**. Worker duy nhất phù hợp mà không nhận lệnh từ Orchestrator (U11) cũng tính là không có Worker phù hợp; Orchestrator nêu tên Worker đó và gợi ý giao trực tiếp hoặc gửi yêu cầu |
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

Giữ mô hình đang chạy trong `work.js`: **Dự án → Phiếu yêu cầu → Công việc → Báo cáo**. Tiến độ cuộn lên từ công việc tới phiếu tới dự án. Có thêm Điều phối và Phòng điều hành. Thay đổi so với bản demo: dữ liệu theo tenant trong PostgreSQL, nhân sự là `users` thật, Worker lấy từ CSDL, và quyền theo §12.

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

```
Mới ──► Đang thực hiện ──► Chờ nghiệm thu ──► Hoàn tất
             │   ▲                │
             │   └── Làm lại ◄────┘ (người nghiệm thu trả về, kèm góp ý)
             ▼
          Vướng ──► (Điều phối §8.6) ──► Đang thực hiện | Đã huỷ
Bất kỳ lúc nào ──► Tạm dừng | Đã huỷ (kèm lý do bắt buộc)
```

- Việc của **Worker** xong thì chuyển **Chờ nghiệm thu**, **không tự Hoàn tất**. Người nghiệm thu phải xác nhận.
- **Phiếu không tự đóng** khi còn công việc chưa Hoàn tất hoặc chưa Huỷ (giữ quy tắc của bản demo).
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

### 8.5 Phòng điều hành, Nhân sự & Worker, Báo cáo

| Màn | Nội dung | Phạm vi dữ liệu |
|---|---|---|
| **Phòng điều hành** | Dự án đang chạy, việc trễ hạn, việc thiếu báo cáo, Worker đang chạy, việc chờ nghiệm thu | Theo §12: người dùng thường thấy việc của mình; quản lý thấy phạm vi quản lý; Admin thấy toàn công ty |
| **Nhân sự & Worker** | Khối lượng việc của từng người, các Worker người đó phụ trách | Như trên |
| **Báo cáo** | Dòng thời gian báo cáo tiến độ; lọc theo người, Worker, dự án, khoảng ngày; xuất CSV | Như trên |

### 8.6 Điều phối: việc đang vướng

Giữ nguyên tinh thần của bản demo: **không việc nào được nằm im không rõ vì sao.** Mọi công việc lỗi hoặc bế tắc dồn về đây kèm lý do cụ thể.

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

## 9. Bốn đường giao việc và Yêu cầu liên phòng

### 9.1 Bốn đường, một quy tắc

| Đường | Ai dùng được | Mức áp dụng | Tài liệu Mật |
|---|---|---|---|
| **① Orchestrator** | Người có quyền ra lệnh (§6.1) | Luôn **Mở** (bỏ qua chính sách nhận việc), **trừ Worker «không nhận lệnh từ Orchestrator»** (U11) | ✔ |
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
- Quá hạn duyệt thì hành động **bị huỷ**, công việc vào Điều phối.
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
| Sử dụng của tôi | Số lượt chat, việc, chi phí tháng này của chính mình |

---

## 16. Mô hình dữ liệu bổ sung (PostgreSQL)

Theo quy ước của tài liệu Admin §7.7: mọi bảng có `tenant_id` (khoá ngoại tới `tenants`), bật Row-Level Security, SQL thuần. Các cột dưới đây **đã nằm sẵn** trong lệnh `CREATE TABLE` của tài liệu Admin §7.7; nêu lại ở đây để thấy Workspace cần gì, **không** làm thành migration riêng:

```sql
ALTER TABLE users     ADD COLUMN can_command_orchestrator boolean NOT NULL DEFAULT false,
                      ADD COLUMN can_create_project boolean NOT NULL DEFAULT false;
ALTER TABLE workers   ADD COLUMN intake_policy text NOT NULL DEFAULT 'department'
                        CHECK (intake_policy IN ('open','department','restricted')),
                      ADD COLUMN accept_from_orchestrator boolean NOT NULL DEFAULT true;   -- U11
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
  status text NOT NULL, stuck_reason text, priority text, start_date date, deadline date,
  progress int NOT NULL DEFAULT 0, cost_credit bigint NOT NULL DEFAULT 0,
  cost_dept_id uuid NOT NULL,                 -- bộ phận chịu chi phí = bộ phận người yêu cầu
  created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, close_reason text);
CREATE TABLE task_dependencies (task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on uuid REFERENCES tasks(id) ON DELETE CASCADE, tenant_id uuid NOT NULL REFERENCES tenants(id), PRIMARY KEY (task_id, depends_on));
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

## 18. Lộ trình (ghép vào 5 giai đoạn của tài liệu Admin §19)

| GĐ | Workspace làm gì | Kết quả kiểm chứng được |
|---|---|---|
| **0a** | Chưa có tính năng Workspace. Chỉ chuẩn bị middleware đặt `app.user_id` và `app.is_tenant_admin` (mặc định `'false'`) | — |
| **0b** | Khung Workspace sau đăng nhập; chuyển khu vực Workspace ⇄ Quản trị; bỏ dữ liệu giả (`AMBIENT`, `AGENTS`, `seed()`), bỏ Portal khách hàng và Luồng nghiệp vụ | `member` đăng nhập thấy Workspace, **không** thấy nút Quản trị; gọi `/api/v1/admin/*` trả `403` |
| **1a** | Chưa có tính năng Workspace (đang làm tổ chức, người dùng, Rule ở tài liệu Admin) | — |
| **1b** | Danh bạ Worker + mức quan hệ + chính sách nhận việc + **tuỳ chọn không nhận lệnh từ Orchestrator (U11)**; hội thoại (chưa có trích dẫn Knowledge); quyền riêng tư hội thoại và các bảng RLS ở §16; Quản lý công việc chuyển sang PostgreSQL; `taskPolicy.create`; quyền ra lệnh Orchestrator + kế hoạch + xác nhận; Điều phối; trang Hôm nay | Bảng kiểm `relation()` đủ 7 nhánh (kể cả viewer). Quản lý gọi API đọc hội thoại của nhân viên nhận `403`; Admin đọc được và có dòng nhật ký; `aios_console` đọc `messages` nhận `permission denied`. Người không có quyền không thấy Orchestrator; có quyền thì việc chạy ngay ở Worker «Hạn chế» và Rule `hard` vẫn chặn đúng; Worker đặt U11 từ chối với `ORCHESTRATOR_NOT_ACCEPTED` |
| **2** | Trích dẫn Knowledge; **lọc tài liệu Mật theo tập `item_id`** khi truy vấn Qdrant; «Chạy lại với quyền bộ phận» + giữ kết quả chờ duyệt chuyển; Yêu cầu sang phòng khác (tự nhận và báo); Worker tham gia dự án; kết quả bàn giao + đề xuất đưa vào Kho; góp ý 👍👎 (qua `feedback_shares`) | Yêu cầu từ Kinh doanh tới Worker Kế toán **không** trả về được số liệu trong tài liệu Mật (kiểm bằng câu hỏi trúng nội dung đó); sau khi người phụ trách chạy lại và duyệt chuyển thì người yêu cầu mới nhận được. Bật hoặc tắt cờ Mật có hiệu lực ngay ở lượt truy vấn kế tiếp |
| **3** | Chi phí theo bộ phận người yêu cầu; «Sử dụng của tôi»; trung tâm thông báo + email; báo cáo xuất CSV | Báo cáo chi phí cho thấy đúng phòng nào dùng Worker của phòng nào |
| **4** | Hộp Phê duyệt; hộp thư cá nhân; MFA người dùng | Email do Worker soạn chỉ được gửi sau khi người được chỉ định duyệt |

---

## 19. Kiểm thử trọng yếu

| Nhóm | Kiểm |
|---|---|
| **Mức quan hệ** | Kiểm bảng: 3 chính sách × (cùng bộ phận / quản lý trong phạm vi / được cấp riêng / người ngoài / admin / viewer) → đúng mức ở §5.3. Thêm ca viewer có trong `accessUserIds` → vẫn «Chỉ xem» |
| **Không lách quyền** | Gọi `POST /tasks` trực tiếp tới Worker mức Qua yêu cầu thì thành yêu cầu, không chạy dạng trực tiếp. Gọi `POST /orchestrator/plans` khi không có quyền thì `403`. Gửi `run_mode` hay `confidential_allowed` từ client thì bị bỏ qua. Giao việc `origin = orchestrator` cho Worker «không nhận lệnh từ Orchestrator» thì bị từ chối `ORCHESTRATOR_NOT_ACCEPTED`; cùng Worker đó vẫn nhận việc từ chat, dự án, yêu cầu theo mức quan hệ |
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
| Quyền ra lệnh Orchestrator bị cấp tràn lan, biến chính sách nhận việc thành vô nghĩa | Trung bình | Quyền cấp từng người, có nhật ký; Quản trị › Người dùng hiển thị rõ danh sách người đang có quyền; người phụ trách Worker luôn được báo khi có việc từ Orchestrator; Worker nhạy cảm đặt «không nhận lệnh từ Orchestrator» (U11) |
| Người dùng tưởng hội thoại hoàn toàn riêng tư | Trung bình | Ghi rõ trong màn chào lần đầu và ở chân khung chat: "Quản trị viên công ty có thể xem hội thoại khi cần; mọi lần xem đều được ghi lại" |
| Việc của Worker bị bỏ quên ở trạng thái Chờ nghiệm thu | Trung bình | Nhắc sau 1 ngày; hiện trên trang Hôm nay và Phòng điều hành |
| "Tự nhận và báo" làm Worker phòng khác quá tải | Trung bình | Ngân sách ngày của Worker vẫn áp dụng; người phụ trách tạm dừng hoặc trả lại được; báo cáo chi phí theo bộ phận người yêu cầu cho thấy ai đang dùng nhiều |

---

*Tài liệu đi cặp với `ADMIN_PORTAL_DESIGN.md`. Các thay đổi kéo theo ở tài liệu Admin (quyền ra lệnh Orchestrator, chính sách nhận việc, cờ Mật, đọc hội thoại, chặn phiên hỗ trợ đọc hội thoại, đường dẫn Workspace) được cập nhật cùng lúc.*
