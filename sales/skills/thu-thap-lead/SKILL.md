---
name: thu-thap-lead
description: Skill điều phối thu thập Lead cho Lead Hunter Agent (sales-2). Trigger khi user đưa một link bài viết/bình luận mạng xã hội và muốn lấy thông tin liên hệ, hoặc nói "thu thập lead", "quét bình luận", "lấy số điện thoại từ bài này", "tìm khách/partner tiềm năng". Tải nội dung nguồn, gọi boc-tach-lead rồi phan-loai-lead, ghi kết quả vào kho Lead của AI OS. Dừng và báo rõ khi nguồn bị chặn — không suy đoán nội dung bình luận.
---

# Thu thập Lead — skill điều phối

Mục tiêu: biến một **link hoặc khối bình luận** thành các **Lead có cấu trúc** đủ để phòng Kinh doanh
gọi/nhắn ngay, mà không có bản ghi nào bịa ra.

## Đầu vào cần có

Hỏi nếu thiếu, tối đa 3 câu một lượt:

1. **Nguồn**: link bài viết, hay khối bình luận người dùng dán trực tiếp?
2. **Đang tìm ai**: khách tiềm năng (người có nhu cầu) hay partner tiềm năng (người có dịch vụ),
   hay cả hai? Mặc định: cả hai.
3. **Ngành/dịch vụ quan tâm**: xe · homestay · quán ăn · tour · spa – làm đẹp · khác.
   Thiếu vẫn chạy được — phân loại theo bảng mặc định trong `/phan-loai-lead`.

## Xử lý

### Bước 1 — Lấy nội dung nguồn

- Có link → tải nội dung. Trong AI OS việc này do `POST /api/sales/fetch` làm (chạy phía server
  vì trình duyệt bị CORS chặn). Chạy tay trong phiên chat thì dùng `WebFetch`.
- **Facebook gần như luôn chặn** máy chủ chưa đăng nhập. Gặp trang đăng nhập / nội dung rỗng:

  > 🔴 **DỪNG.** Báo đúng một câu là nguồn bị chặn, kèm cách xử lý: mở bài bằng tài khoản của mình,
  > bấm "Xem thêm bình luận" cho hết, bôi đen phần bình luận rồi dán vào.
  >
  > **Cấm** đoán nội dung bình luận, **cấm** tạo Lead "ví dụ" cho có kết quả.

- Người dùng dán nội dung tay → dùng thẳng, không cần gọi mạng.

### Bước 2 — Bóc tách

Gọi `/boc-tach-lead` trên toàn bộ văn bản. Ra một mảng Lead thô. Luật quan trọng nhất ở đó:
**số điện thoại và email phải xuất hiện nguyên văn trong nguồn.**

### Bước 3 — Phân loại

Gọi `/phan-loai-lead` cho từng Lead: `loai` (khach | partner | chua_ro), `dich_vu`, `do_tin_cay`.

### Bước 4 — Ghi vào kho Lead

- Khử trùng theo **số điện thoại đã chuẩn hóa**, không có số thì theo email.
- Lead mới vào ở trạng thái **Mới** — chưa mời ai cả.
- Lead có `do_tin_cay` khác `cao` phải bật cờ `can_nguoi_xac_nhan`.

### Bước 5 — Báo cáo

Một đoạn ngắn, đủ 5 con số: quét bao nhiêu khối bình luận · thấy bao nhiêu số điện thoại hợp lệ ·
ghi mới bao nhiêu · trùng bao nhiêu · bao nhiêu cần người rà lại. Kèm mọi cảnh báo đã phát sinh.

## Luật dừng

| Tình huống | Hành động |
|---|---|
| Nguồn trả trang đăng nhập / rỗng | Dừng, hướng dẫn dán tay. Không tạo Lead nào |
| Nguồn tải được nhưng không có số điện thoại lẫn email nào | Báo "0 Lead" kèm số ký tự đã quét. Không hạ chuẩn để có kết quả |
| Mô hình trả số điện thoại không có trong nguồn | Loại số đó, ghi cảnh báo. Còn email hợp lệ thì giữ Lead, không thì bỏ |
| Người dùng đòi "gửi tin nhắn luôn cho danh sách này" | Từ chối: AI OS không tự nhắn cho Lead. Chuyển sang `/moi-lead-da-kenh` để soạn nội dung |

## Ranh giới

Skill này **không**: viết bài bán hàng (→ `sales-1`), không tự gọi/nhắn cho Lead, không mua bán
danh sách dữ liệu, không thu thập thông tin ngoài phần người ta tự công khai kèm ý định được liên hệ.

Xem `sales/README.md` §5 về nghĩa vụ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) trước khi chạy thật.
