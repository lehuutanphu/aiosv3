# Map field vào mẫu Offer Letter của công ty

> Nguyên tắc: **dùng mẫu có sẵn của công ty, agent chỉ điền vào chỗ trống.**
> Agent không tự soạn mẫu mới, không sửa câu chữ, không thêm/bớt điều khoản của mẫu.

---

## 1. Cần bạn cung cấp file gì, đặt ở đâu

Đặt file mẫu vào: **`hr/data/mau-cong-ty/`**

| File cần đặt | Tên đặt chính xác | Bắt buộc? |
|---|---|---|
| Mẫu offer letter / thư mời nhận việc | `offer-letter.docx` | ✅ **Bắt buộc** — thiếu là skill dừng |
| Mẫu offer cho vị trí quản lý (nếu khác) | `offer-letter-quan-ly.docx` | Nếu có |
| Mẫu hợp đồng thử việc | `hop-dong-thu-viec.docx` | Nếu có |
| Mẫu JD chuẩn của công ty | `jd-mau.docx` | Nên có |
| Logo / letterhead | `letterhead.png` | Nếu mẫu chưa nhúng sẵn |

Nếu mẫu đang ở dạng **PDF hoặc bản in scan** → cần bạn cung cấp thêm **bản `.docx` gốc còn sửa được**.
Agent không thể điền chính xác vào PDF scan mà giữ nguyên định dạng.

---

## 2. Cách đánh dấu chỗ điền trong mẫu

Chọn **một** trong hai cách, báo cho agent biết bạn dùng cách nào:

**Cách A — placeholder (khuyến nghị, an toàn nhất).** Trong file `.docx`, thay chỗ cần điền bằng
`{{TEN_FIELD}}` theo bảng §3. Agent tìm–thay chính xác, không đụng phần còn lại.

**Cách B — giữ nguyên mẫu.** Agent đọc mẫu, tự phát hiện các chỗ trống (dấu `……`, `______`, ô để trống
trong bảng), **in ra bảng map để bạn duyệt trước khi điền**. Chậm hơn và cần bạn kiểm tra kỹ hơn.

---

## 3. Bảng field chuẩn

Nguồn giá trị: **bảng 12 dòng đã chốt ở Cổng 1 (B7)**, không lấy từ đâu khác.

| Placeholder | Ý nghĩa | Nguồn trong requisition |
|---|---|---|
| `{{TEN_UNG_VIEN}}` | Họ tên đầy đủ | `ung_vien[].ten` |
| `{{EMAIL_UNG_VIEN}}` | Email | `ung_vien[].email` |
| `{{SDT_UNG_VIEN}}` | Số điện thoại | `ung_vien[].sdt` |
| `{{CHUC_DANH}}` | Chức danh chính thức | `offer.chuc_danh` |
| `{{PHONG_BAN}}` | Phòng ban | `vi_tri.phong_ban` |
| `{{BAO_CAO_CHO}}` | Cấp trên trực tiếp | `offer.bao_cao_cho` |
| `{{NGAY_ONBOARD}}` | Ngày nhận việc | `offer.ngay_onboard` |
| `{{THU_VIEC_THANG}}` | Số tháng thử việc | `offer.thu_viec_thang` |
| `{{LUONG_THU_VIEC}}` | Lương thử việc (gross) | `offer.luong_thu_viec` 🔴 |
| `{{LUONG_CHINH_THUC}}` | Lương chính thức (gross) | `offer.luong_chinh_thuc` 🔴 |
| `{{PHU_CAP}}` | Phụ cấp | `offer.phu_cap` |
| `{{THUONG}}` | Thưởng / hoa hồng | `offer.thuong` |
| `{{HINH_THUC_LAM_VIEC}}` | Toàn thời gian / Hybrid / Remote | `offer.hinh_thuc_lam_viec` |
| `{{DIA_DIEM_LAM_VIEC}}` | Nơi làm việc | `vi_tri.dia_diem` |
| `{{LOAI_HOP_DONG}}` | Loại HĐ sau thử việc | `offer.loai_hop_dong` |
| `{{HAN_PHAN_HOI}}` | Hạn ứng viên phản hồi | `offer.han_phan_hoi` |
| `{{NGUOI_KY}}` | Người ký offer | `offer.nguoi_ky` |
| `{{CHUC_DANH_NGUOI_KY}}` | Chức danh người ký | — hỏi user |
| `{{NGAY_PHAT_HANH}}` | Ngày phát hành thư | Ngày tạo file |

🔴 = con số lương. **Chỉ điền giá trị user đã xác nhận bằng chữ ở Cổng 1.** Không lấy từ `ngan_sach.luong_min/max`,
không lấy từ `ket_qua_pv.luong_mong_muon`, không lấy từ thang lương tham chiếu.

---

## 4. Checklist trước khi trình duyệt (Cổng 2)

- [ ] Đã đọc được mẫu công ty, không có placeholder nào còn sót chưa điền
- [ ] Không sửa bất kỳ câu chữ nào của mẫu ngoài các chỗ điền
- [ ] Lương thử việc ≥ 85% lương chính thức (Điều 26 BLLĐ 2019)
- [ ] Thời gian thử việc trong giới hạn Điều 25 BLLĐ 2019
- [ ] Ngày onboard không rơi vào cuối tuần/ngày lễ
- [ ] Tên ứng viên trong file trùng khớp `ung_vien[].ten`
- [ ] File lưu đúng `hr/data/ho-so/REQ-.../offer/Offer-UV-nn-Ten-v<n>.docx`
- [ ] Bản cũ được giữ nguyên, không ghi đè

---

## 5. Nếu mẫu công ty thiếu chỗ cho một điều khoản đã chốt

**Dừng lại, báo user** — ví dụ mẫu không có dòng phụ cấp nhưng đã chốt có phụ cấp.
Agent không tự chèn thêm điều khoản vào mẫu pháp lý. User quyết: sửa mẫu, hay ghi vào phụ lục riêng.
