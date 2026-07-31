---
name: offer-va-luu-ho-so
description: Bước 7-10 quy trình tuyển dụng — chốt điều khoản offer (ngày onboard, thời gian thử việc, lương), điền vào MẪU OFFER LETTER CÓ SẴN CỦA CÔNG TY, trình duyệt, tạo draft gửi ứng viên, và lưu hồ sơ. Trigger khi user nói "gửi offer", "offer letter", "thư mời nhận việc", "chốt lương", "ngày onboard", "thử việc", "duyệt offer", "lưu hồ sơ ứng viên", "onboard". BA CỔNG DUYỆT NGƯỜI BẮT BUỘC — agent tuyệt đối không tự điền lương và không tự gửi email.
---

# B7–B10 — Offer letter & lưu hồ sơ

> ⛔ **Đây là skill có rủi ro cao nhất trong toàn bộ pipeline.** Sai một con số lương là sai cam kết
> pháp lý với người lao động. Ba cổng dưới đây **không được rút gọn, không được gộp, không được suy đoán.**

---

## 🔴 CỔNG 1 (B7) — Chốt điều khoản

Trình bảng sau và **chờ user xác nhận từng dòng**. Ô nào user chưa nói ra thì để `[ CHỜ BẠN ĐIỀN ]` —
tuyệt đối không lấy số từ dải lương trong requisition, từ mức mong muốn của ứng viên, hay từ thang lương
tham chiếu để điền thay.

**Giảm hỏi lại thông tin đã có** — với các dòng KHÔNG phải lương (1, 2, 3, 9), được phép GỢI Ý sẵn giá
trị lấy từ dữ liệu đã có thật trong requisition (`vi_tri.ten`/`cap_bac` → chức danh, `vi_tri.phong_ban` →
phòng ban, `vi_tri.hinh_thuc`/`dia_diem` → hình thức & nơi làm việc, `ung_vien[].ket_qua_pv.co_the_onboard_tu`
→ gợi ý ngày onboard), ghi rõ "(gợi ý, xác nhận hoặc sửa)" — user vẫn phải xác nhận/sửa từng dòng, không tự
chốt thay. **Các dòng lương (5, 6) và phụ cấp/thưởng (7, 8) tuyệt đối không gợi ý** — luôn để trống chờ user.

```
📄 ĐIỀU KHOẢN OFFER — UV-<nn> <Tên> — <Vị trí>

 1. Chức danh chính thức      : [ ]
 2. Phòng ban / Báo cáo cho   : [ ]
 3. Ngày onboard              : [ ]
 4. Thời gian thử việc        : [ ] tháng
 5. Lương thử việc (gross)    : [ ]   (…% lương chính thức: [ ])
 6. Lương chính thức (gross)  : [ ]
 7. Phụ cấp                   : [ ]
 8. Thưởng / hoa hồng         : [ ]
 9. Hình thức & nơi làm việc  : [ ]
10. Loại hợp đồng sau thử việc: [ ]
11. Hạn phản hồi offer        : [ ]
12. Người ký offer            : [ ]
```

**Kiểm tra bắt buộc trước khi qua cổng 2** — nêu ra nếu phát hiện, không tự sửa:

- Lương thử việc < **85%** lương chính thức → vi phạm Bộ luật Lao động 2019 (Điều 26). Cảnh báo rõ.
- Thời gian thử việc vượt trần Điều 25: tối đa **60 ngày** với vị trí cần trình độ cao đẳng trở lên,
  **30 ngày** với trung cấp/công nhân kỹ thuật, **6 ngày** với công việc khác (quản lý doanh nghiệp: 180 ngày).
- Lương chính thức thấp hơn mức ứng viên nêu ở vòng PV → cảnh báo rủi ro từ chối offer.
- Ngày onboard rơi vào cuối tuần / ngày lễ.
- Lương lệch khỏi dải trong requisition → hỏi lại, có thể user gõ nhầm.

Chỉ khi user xác nhận đủ **12/12 dòng** mới được sang cổng 2. Ghi vào `ung_vien[].offer` + `nhat_ky[]`.

---

## 🔴 CỔNG 2 (B8) — Điền mẫu công ty & trình duyệt

### Nguyên tắc: dùng MẪU CÓ SẴN, không tự chế mẫu mới

1. Đảm bảo đủ 12/12 dòng ở Cổng 1 đã được lưu vào `ung_vien[].offer` (qua `upsert_candidate`).
2. Gọi tool `generate_offer_letter` với `ma_uv` (+ `chuc_danh_nguoi_ky` nếu user đã cho biết, hỏi 1 lần
   nếu chưa có). Server tự điền đúng mẫu `hr/data/mau-cong-ty/offer-letter.docx` bằng dữ liệu `offer.*`
   đã chốt — bạn **không tự đọc/soạn nội dung docx**, tool đã đảm bảo chỉ thay đúng chỗ placeholder,
   giữ nguyên toàn bộ câu chữ/định dạng mẫu.
3. Nếu tool báo lỗi "chưa có mẫu" → DỪNG, yêu cầu user đặt file `offer-letter.docx` vào
   `hr/data/mau-cong-ty/` (xem `hr/templates/offer-field-map.md`). Không tự soạn offer letter thay thế.
4. Nếu tool báo `missingTemplateFields` → nói rõ cho user những chỗ mẫu không có sẵn field tương ứng
   (đã tự để trống trong file xuất ra) để họ tự điền tay hoặc quyết định bổ sung mẫu.
5. File xuất ra tự động theo đúng `hr/data/ho-so/REQ-YYYY-NNN/offer/Offer-UV-<nn>-<Ten>-v<n>.docx`,
   tự tăng version, không ghi đè bản cũ.

### Trình duyệt

Tạo draft email nội bộ gửi người có thẩm quyền, đính kèm bản offer + bảng điều khoản. Chờ phản hồi.
Khi được duyệt, ghi vào `nhat_ky[]`:

```json
{ "thoi_gian": "<ISO>", "hanh_dong": "duyet_offer_UV-03", "nguoi_duyet": "<tên>", "phien_ban": "v1" }
```

Có sửa → tạo `v2`, `v3`… **giữ nguyên bản cũ**, không ghi đè.

---

## 🔴 CỔNG 3 (B9) — Gửi offer

- Gmail MCP `create_draft` với file offer đính kèm. **KHÔNG dùng bất kỳ hành động gửi nào.**
- Báo: *"Draft offer cho UV-<nn> đã sẵn sàng trong Gmail. Kiểm tra người nhận và file đính kèm rồi bấm Gửi."*
- Sau khi user xác nhận đã gửi → `trang_thai: "da_offer"`, đặt nhắc theo dõi tới `han_phan_hoi`.
- Trước hạn 1 ngày chưa có phản hồi → nhắc user gọi điện, đừng chỉ chờ email.

**Kiểm tra chống gửi nhầm — chạy trước khi tạo draft:** email người nhận trùng khớp `ung_vien[].email`;
tên trong file offer trùng tên ứng viên; file đính kèm đúng phiên bản đã duyệt; không có ứng viên nào
khác trong dòng To/Cc.

---

## B10 — Lưu hồ sơ & đóng job

### Cấu trúc thư mục lưu trữ

```
hr/data/ho-so/REQ-YYYY-NNN/
├── JD-<vi-tri>.md
├── bai-dang/
├── cv/UV-<nn>-<ten>.pdf
├── phong-van/UV-<nn>-bien-ban.md
├── offer/Offer-UV-<nn>-<Ten>-v<n>.docx
└── tong-ket.md
```

Sau khi ứng viên nhận việc, gom hồ sơ người trúng tuyển sang `hr/data/ho-so/nhan-su/<Ten>-<ngay-onboard>/`.

### Đồng bộ OneDrive / Google Drive

Chưa có connector Drive/OneDrive. Cách làm: đặt `hr/data/ho-so/` **bên trong thư mục đồng bộ**
của OneDrive/Google Drive trên máy (hoặc tạo symbolic link) → app desktop tự đẩy lên cloud.
Hỏi user đường dẫn thư mục sync và ghi vào `duong_dan_luu_tru` của requisition.

### Đóng đợt tuyển

1. Ẩn/đóng tất cả bài đăng trong `kenh_dang[]` (đưa link ra cho user thao tác).
2. Tạo draft email cảm ơn cho ứng viên chưa được chọn; ứng viên loại B chuyển `du_phong` — giữ lại cho đợt sau.
3. Viết `tong-ket.md`: thời gian tuyển thực tế vs dự kiến, kênh nào ra ứng viên tốt nhất, số CV/số PV/số offer,
   bài học cho đợt sau.
4. `trang_thai = "da_dong"`, `buoc_hien_tai = 10`.

## Bảo mật

Hồ sơ ứng viên là dữ liệu cá nhân (Nghị định 13/2023). Không đưa lương/hồ sơ ứng viên vào bất kỳ báo cáo
chia sẻ rộng nào. `hr/data/` đã được gitignore — kiểm tra lại trước khi commit.
