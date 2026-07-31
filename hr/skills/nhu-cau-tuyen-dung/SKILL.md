---
name: nhu-cau-tuyen-dung
description: Bước 1 quy trình tuyển dụng — xác định nhu cầu tuyển và tạo file requisition. Trigger khi user nói "cần tuyển", "mở đợt tuyển mới", "tuyển thêm người", "phiếu yêu cầu tuyển dụng", "requisition", "cần bao nhiêu người", "khi nào onboard". Hỏi đủ thông tin bắt buộc rồi sinh data/requisitions/REQ-YYYY-NNN.json theo templates/requisition.template.json. Không tự bịa lương hay ngày onboard.
---

# B1 — Xác định nhu cầu tuyển dụng

Mục tiêu: biến một câu nói mơ hồ ("cần tuyển kế toán") thành **requisition đầy đủ, có ngày tháng, có tiêu chí đo được**.

## Thông tin BẮT BUỘC phải hỏi

Hỏi theo nhóm, tối đa 4 câu/lượt, đừng dồn hết một lần.

**Nhóm 1 — Vị trí**

1. Tên vị trí chính xác (theo cách gọi nội bộ) + phòng ban
2. Số lượng cần tuyển
3. Cấp bậc: Thực tập / Nhân viên / Chuyên viên / Trưởng nhóm / Quản lý
4. Báo cáo cho ai

**Nhóm 2 — Thời gian**

5. Ngày onboard **mong muốn**
6. Ngày onboard **muộn nhất chấp nhận được** (deadline cứng)
7. Lý do tuyển: thay thế người nghỉ / mở rộng đội / vị trí mới hoàn toàn

**Nhóm 3 — Bối cảnh kinh doanh (quan trọng cho B2)**

8. Doanh nghiệp đang thay đổi gì khiến vị trí này khác so với lần tuyển trước?
9. 3 việc người này sẽ làm nhiều nhất trong 3 tháng đầu
10. Thế nào là "làm tốt" sau 6 tháng? (tiêu chí đo được)

**Nhóm 4 — Khung ngân sách**

11. Dải lương dự kiến (min–max) — 🔴 **chỉ ghi con số user nói ra**. Nếu user chưa biết, ghi `null`
    và ghi chú "chờ chốt", **không** tự lấy từ thang lương tham chiếu điền vào.
12. Hình thức: Toàn thời gian / Bán thời gian / Thời vụ / Remote / Hybrid

## Xử lý

1. Sinh `requisition_id` = `REQ-<năm>-<số thứ tự 3 chữ số>`, đếm từ các file có sẵn trong `hr/data/requisitions/`.
2. Copy `hr/templates/requisition.template.json` → điền → lưu `hr/data/requisitions/REQ-YYYY-NNN.json`.
3. Đặt `buoc_hien_tai = 2`, `trang_thai = "dang_mo"`.
4. Nếu chưa có, tạo thư mục `hr/data/ho-so/REQ-YYYY-NNN/`.

## Cảnh báo tự động

Tính số ngày từ hôm nay đến ngày onboard mong muốn:

- **< 21 ngày** → cảnh báo: "Thời gian rất gấp. Chu kỳ tuyển trung bình cho vị trí này là 4–6 tuần.
  Cân nhắc: (a) lùi ngày onboard, (b) dùng nguồn giới thiệu nội bộ song song, (c) hạ một số tiêu chí *nên có*."
- **> 90 ngày** → hỏi lại có nên hoãn mở đợt để JD sát thực tế hơn không.

## Output

1. File requisition JSON.
2. Tóm tắt in ra chat: vị trí, số lượng, mốc thời gian, 3 việc chính, tiêu chí 6 tháng.
3. Câu chốt: *"Requisition đã tạo. Bước kế tiếp: `/jd-va-tin-tuyen-dung` để cập nhật JD."*
