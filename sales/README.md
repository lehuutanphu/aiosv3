# Module Thu thập Lead — Lead Hunter Agent (`sales-2`)

Hệ agent biến một **link bài viết / khối bình luận mạng xã hội** thành các **Lead có cấu trúc**
trong AI OS: tên khách hàng · số điện thoại · email · nguồn · nội dung comment · loại
(khách tiềm năng / partner tiềm năng) · phân loại dịch vụ (xe, homestay, quán ăn, tour, spa, khác).

Gắn vào `sales-2 (Lead Hunter Agent)` trong AI OS Dashboard — port `8655` theo
`server/agents.config.json`. Người chịu trách nhiệm mặc định: `s8 — Trần Thảo Uyển` (phòng Kinh doanh).

## 1. Kiến trúc

```
sales-2 (Lead Hunter Agent)
 └─ /thu-thap-lead ................. skill ĐIỀU PHỐI: nhận link/nội dung → gọi 2 bước → ghi kho Lead
     ├─ /boc-tach-lead ............. S2a  Bóc tách tên · sđt · email · nguyên văn comment
     ├─ /phan-loai-lead ............ S2b  Gán loại (khách/partner) + nhóm dịch vụ + độ tin cậy
     └─ /moi-lead-da-kenh .......... S3   Soạn lời mời theo từng kênh cho Lead đã được người duyệt
```

Chạy trong Dashboard: nút **🧲 Thu thập Lead** (mọi màn hình điều hành) hoặc màn hình
**Lead → 🧲 Thu thập từ link**. Ra lệnh cho Orches cũng được — xem §6.

## 2. Pipeline & mức tự động

| Bước | Việc | Chạy bằng | Mức tự động |
|---|---|---|---|
| S1 | Tải nội dung nguồn từ URL | `server/sales.js` → `POST /api/sales/fetch` | ✅ Tất định, không LLM |
| S2 | Bóc tách sđt/email | regex tất định trên văn bản nguồn | ✅ Luôn chạy, **không cần API key** |
| S2 | Đặt tên, phân loại khách/partner, nhóm dịch vụ | LLM qua `POST /api/sales/extract` | ✅ Khi có `OPENROUTER_API_KEY`, thiếu thì lùi về luật từ khóa |
| S3 | Ghi vào kho Lead, khử trùng theo số điện thoại | `website/js/work.js` | ✅ Tự động |
| S4 | Mời qua Zalo / gọi / SMS / email | — | 🔴 **CỔNG NGƯỜI** — AI OS không tự nhắn cho Lead |

Kết quả mỗi lần chạy = **1 phiếu yêu cầu + 2 công việc có báo cáo** trong mặt phẳng điều hành,
đúng mô hình chung: Agent làm, người chịu trách nhiệm duyệt.

## 3. Giới hạn công cụ hiện tại (cập nhật 09/08/2026)

| Cần | Trạng thái | Cách xử lý |
|---|---|---|
| Tải bài viết Facebook công khai | ⚠️ **Thường bị chặn** | Facebook trả trang đăng nhập cho máy chủ chưa đăng nhập. Agent **báo rõ là bị chặn và dừng**, không đoán nội dung. Dùng ô **"dán trực tiếp nội dung bình luận"** — cách chắc ăn nhất |
| Tải trang web thường (blog, forum, landing) | ✅ Được | `POST /api/sales/fetch`, có bóc HTML → text |
| Nội dung do JavaScript dựng sau khi tải | ❌ Không đọc được | Proxy chỉ tải HTML tĩnh, không chạy JS. Dán tay |
| Đăng nhập Facebook để đọc nhóm kín | ⚠️ Có nhưng **cân nhắc** | Đặt `FB_COOKIE` trong `server/.env`. **Tự động hóa truy cập bằng cookie tài khoản là vi phạm Điều khoản của Meta** — dùng cho việc thủ công quy mô nhỏ trên nội dung bạn có quyền xem, hoặc chuyển sang Graph API/công cụ chính thức |
| Meta Graph API (comment của Page mình sở hữu) | ❌ Chưa nối | Đây là đường **chính thống** cho Page/nhóm của chính công ty — nên làm nếu chạy dài hạn |
| Nhắn Zalo / gửi SMS / gửi email cho Lead | ❌ Không có connector | Agent chỉ soạn nội dung, người bấm gửi rồi ghi nhận lại ở màn hình Lead |
| Đồng bộ sang CRM | ❌ Chưa nối | Xuất CSV từ màn hình Lead (`⬇ CSV`), import tay |

## 4. Ba rào chắn chất lượng

1. **Cấm bịa số liên hệ.** Mọi số điện thoại/email do mô hình trả về đều bị đối chiếu lại với
   văn bản nguồn; không khớp nguyên văn thì **loại bỏ** và ghi cảnh báo vào báo cáo. Đây là chỗ
   LLM sai nguy hiểm nhất — một số điện thoại sai làm hỏng cả buổi gọi của sale.
2. **Không có cách liên hệ thì không phải Lead.** Bình luận không kèm sđt lẫn email bị bỏ qua,
   không tạo bản ghi rỗng để lấy số lượng đẹp.
3. **Nguồn chặn thì dừng, không suy đoán.** Facebook chặn → phiếu chuyển *Tạm dừng*, sinh một
   công việc hướng dẫn người dán nội dung tay. Không có "kết quả tạm" tự nghĩ ra.

Thêm một rào mềm: mỗi Lead mang cờ `can_nguoi_xac_nhan`. Bóc bằng regex thuần luôn bật cờ này
(hiện nhãn 🔴 **cần rà** trên màn hình Lead) vì tên và phân loại lúc đó chỉ là suy đoán theo từ khóa.

## 5. Dữ liệu cá nhân — phải đọc trước khi chạy thật

Lead là **dữ liệu cá nhân** theo Nghị định 13/2023/NĐ-CP. Quy ước trong module này:

- Chỉ thu thập từ nội dung **người ta tự công khai** kèm ý định được liên hệ (bình luận chào bán,
  hỏi giá, để lại số).
- Chỉ dùng đúng mục đích đã nêu khi liên hệ lần đầu; nêu rõ nguồn ("thấy anh/chị bình luận ở bài…").
- Có yêu cầu xóa thì xóa ngay trên màn hình Lead (nút 🗑 trong hồ sơ Lead) và xóa cả bản sao lưu.
- Không gửi hàng loạt tin nhắn/cuộc gọi tự động — AI OS cố tình **không** có chức năng đó.
- File `sales/data/leads/leads.json` chứa PII nên **không được commit** (đã có trong `.gitignore`).

## 6. Cách chạy

**Trong Dashboard** — nút `🧲 Thu thập Lead`, dán link hoặc dán khối bình luận, bấm *Tạo phiếu & chạy*.

**Ra lệnh cho Orches** (khung chat ở Dashboard đội Agent):

```
Thu thập lead từ https://www.facebook.com/groups/.../posts/...
```

Orches nhận diện là lệnh thu thập Lead → mở phiếu → giao `sales-2` → mở màn hình Lead.

**Bật lượt phân loại bằng mô hình** (khuyến nghị): thêm vào `server/.env`

```
OPENROUTER_API_KEY=sk-or-...
```

Không có key vẫn chạy được — chỉ là tên/phân loại kém chính xác hơn và mọi Lead đều gắn "cần rà".

## 7. Cấu trúc thư mục

```
sales/
├── README.md                         ← file này
├── skills/
│   ├── thu-thap-lead/SKILL.md            ← điều phối + luật dừng khi nguồn bị chặn
│   ├── boc-tach-lead/SKILL.md            ← chuẩn JSON một Lead + luật chống bịa số
│   ├── phan-loai-lead/SKILL.md           ← khách vs partner, bảng nhóm dịch vụ
│   └── moi-lead-da-kenh/SKILL.md         ← soạn lời mời theo kênh
├── templates/
│   └── lead.schema.md                ← đặc tả trường của một Lead
└── data/
    └── leads/                        ← bản sao lưu kho Lead (KHÔNG commit — chứa PII)
```

## 8. Cách kích hoạt skill

Giống module marketing: skill trong `sales/skills/` là **mã nguồn**, Cowork chưa tự nhận.

- **Cách A (khuyến nghị):** nhờ Claude `save_skill` từng skill → gõ `/thu-thap-lead` dùng ngay.
- **Cách B:** copy thư mục con của `sales/skills/` vào thư mục skills của Cowork.
- **Cách C (Hermes):** đưa vào `~/.hermes_sales-2/skills/` — `sales-2` chạy ở port `8655`.

Lưu ý: pipeline trong Dashboard **không phụ thuộc** việc đăng ký skill — nó gọi thẳng
`server/sales.js`. Skill dùng khi bạn muốn chạy tay trong phiên chat với Agent.
