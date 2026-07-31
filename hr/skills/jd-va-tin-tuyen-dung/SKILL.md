---
name: jd-va-tin-tuyen-dung
description: Bước 2+3 quy trình tuyển dụng — cập nhật JD theo thực tế doanh nghiệp, viết bài đăng tuyển cho từng kênh (website, Facebook group, Zalo), viết brief hình ảnh, và lưu sổ link bài đăng để follow comment/inbox. Trigger khi user nói "viết JD", "cập nhật mô tả công việc", "job description", "bài đăng tuyển", "đăng tin tuyển dụng", "post tuyển dụng", "ảnh tuyển dụng", "lưu link bài đăng". Đọc requisition JSON, ghi lại jd{} và kenh_dang[].
---

# B2+B3 — JD & Tin tuyển dụng đa kênh

## Phần A — Cập nhật JD (B2)

### A1. Đối chiếu với JD cũ

Hỏi user có JD cũ của vị trí này không (`hr/data/mau-cong-ty/` hoặc file user đưa).

- **Có JD cũ** → đọc, rồi hỏi từng mục: "Mục này còn đúng không?" Đánh dấu 3 loại thay đổi:
  `[GIỮ]` / `[SỬA: lý do]` / `[BỎ: lý do]` / `[THÊM: lý do]`. **Luôn nêu lý do gắn với thay đổi của
  doanh nghiệp**, không sửa cho khác đi.
- **Không có JD cũ** → dựng mới từ `hr/templates/jd.template.md` + dữ liệu requisition.

### A2. Tách yêu cầu thành 3 tầng — bắt buộc

| Tầng | Ý nghĩa | Quy tắc |
|---|---|---|
| **Bắt buộc** | Thiếu là loại ngay | Tối đa **5 mục**. Mỗi mục phải kiểm chứng được qua CV hoặc PV |
| **Nên có** | Cộng điểm | Tối đa 5 mục |
| **Ưu tiên** | Điểm cộng nhỏ | Không giới hạn |

Nếu user liệt kê > 5 mục bắt buộc, **phản biện**: "Mỗi tiêu chí bắt buộc cắt đi khoảng 30–50% số ứng viên.
Với 8 tiêu chí bắt buộc gần như sẽ không còn ai nộp. Chọn 5 mục nào thật sự thiếu là không làm được việc?"

3 tầng này sẽ thành **rubric chấm CV ở bước 4** — ghi vào `jd.tieu_chi` của requisition.

### A3. Output JD

File `hr/data/ho-so/REQ-YYYY-NNN/JD-<vi-tri>.md` (và `.docx` nếu user cần bản gửi ra ngoài — dùng skill `docx`).

---

## Phần B — Bài đăng tuyển (B3)

### B1. Viết riêng cho từng kênh, KHÔNG copy-paste một bản

Dùng `hr/templates/tin-tuyen-dung.template.md` — có sẵn 4 bản mẫu (website / FB Group / Zalo /
giới thiệu nội bộ), brief ảnh, và bảng sổ link.

| Kênh | Độ dài | Giọng văn | Lưu ý |
|---|---|---|---|
| **Website công ty** | Đầy đủ | Trang trọng, chuẩn SEO | Có schema JobPosting, đầy đủ JD, form nộp |
| **Facebook Group** | 150–250 chữ | Thân mật, xuống dòng thoáng, có emoji vừa phải | 3 dòng đầu là phần hiện trước nút "Xem thêm" — phải chốt được vị trí + mức lương + địa điểm. Nhiều group cấm để link → chuẩn bị bản CTA "cmt hoặc inbox" |
| **Zalo / Zalo OA** | 100–150 chữ | Ngắn, gạch đầu dòng | Ưu tiên số điện thoại/Zalo liên hệ trực tiếp |
| **Nhân viên giới thiệu** | 80 chữ | Nội bộ, nêu thưởng giới thiệu | Bản để nhân viên forward lại |

**Bắt buộc có ở mọi bản:** vị trí, địa điểm làm việc (quận/thành phố), dải lương (nếu được phép công bố),
3 việc chính, cách nộp CV, hạn nộp.

**Tuyệt đối không viết:** "lương thỏa thuận" đơn độc (giảm mạnh lượng ứng tuyển), "chịu được áp lực cao",
"đa nhiệm", "coi công ty là gia đình", yêu cầu giới tính/tuổi/tình trạng hôn nhân (vi phạm Bộ luật Lao động).

### B2. Brief hình ảnh

Chưa có công cụ tạo ảnh. Xuất **brief** để người dựng trên Canva:

```
KÍCH THƯỚC : 1200x1200 (FB/Zalo) | 1200x628 (website)
TEXT CHÍNH : <tối đa 6 chữ, cỡ lớn nhất>
TEXT PHỤ   : <mức lương hoặc điểm hấp dẫn nhất — dòng thứ 2>
LOGO       : góc trên trái
CTA        : <cách nộp CV — dải dưới cùng>
MÀU        : theo bộ nhận diện công ty
TRÁNH      : chữ quá 20% diện tích ảnh; ảnh stock người nước ngoài không hợp bối cảnh
```

### B3. Đăng bài & sổ link — quan trọng nhất cho việc follow

Không có MCP cho Facebook/Zalo. Quy trình:

1. Xuất từng bản đăng ra file riêng trong `hr/data/ho-so/REQ-YYYY-NNN/bai-dang/`.
2. User đăng tay (hoặc dùng Chrome MCP nếu bật).
3. **Hỏi lại link từng bài** rồi ghi vào `kenh_dang[]` của requisition:

```json
{
  "kenh": "Facebook Group - Việc làm Kế toán HCM",
  "loai": "facebook_group",
  "url": "https://facebook.com/groups/.../posts/...",
  "ngay_dang": "2026-07-29",
  "nguoi_dang": "Phú",
  "lan_check_cuoi": null,
  "so_comment": 0,
  "so_inbox": 0,
  "trang_thai": "dang_chay"
}
```

4. Nhắc user: cấu hình **chuyển tiếp inbox FB/Zalo về email tuyển dụng** — đó là cách duy nhất để
   bước 4 gom CV tự động được.

### B4. Nhắc follow bài đăng

Mỗi lần skill này hoặc `/tuyen-dung` chạy, liệt kê bài nào có `lan_check_cuoi` quá 3 ngày và nhắc:
"Vào <link> check comment + inbox, báo lại số lượng để mình cập nhật."

## Kết thúc

Đặt `buoc_hien_tai = 4`. Câu chốt: *"Đã đăng <n> kênh. Bước kế tiếp: `/thu-nhan-sang-loc-cv`."*
