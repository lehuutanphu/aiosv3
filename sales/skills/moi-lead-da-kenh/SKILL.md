---
name: moi-lead-da-kenh
description: Soạn nội dung mời cho một Lead đã có trong kho — theo từng kênh (Zalo, gọi điện, SMS, email, Messenger) và theo loại (khách tiềm năng hay partner tiềm năng). Trigger khi user nói "soạn tin mời cho lead này", "viết lời mời hợp tác partner", "nhắn gì cho khách này", "soạn kịch bản gọi điện". Chỉ soạn nội dung — không tự gửi, không gửi hàng loạt.
---

# Mời Lead qua các kênh

Đầu vào: một Lead (tên · loại · nhóm dịch vụ · nguyên văn bình luận) + kênh muốn dùng.
Đầu ra: nội dung soạn sẵn để **người** bấm gửi.

## Luật cứng

1. **Không tự gửi.** Skill này không gọi connector nhắn tin nào. Soạn xong đưa cho người dùng copy.
2. **Không gửi hàng loạt.** Từ chối yêu cầu kiểu "nhắn cùng một tin cho 200 lead" — vừa hỏng tỷ lệ
   phản hồi vừa là spam. Đề xuất chia nhóm theo `dich_vu` và cá nhân hóa theo bình luận gốc.
3. **Luôn nêu nguồn ở câu đầu.** "Em thấy anh/chị bình luận ở bài … trong nhóm …". Người nhận có
   quyền biết vì sao mình bị liên hệ (Nghị định 13/2023/NĐ-CP).
4. **Bám nguyên văn bình luận của họ.** Nhắc lại đúng thứ họ nói cần/có. Không gán nhu cầu họ
   chưa từng nói.
5. **Không hứa con số chưa được duyệt** — giá, chiết khấu, hoa hồng phải do người xác nhận bằng chữ.
6. Kèm sẵn **cách từ chối**: một câu cho phép họ nói không ("nếu không phù hợp anh/chị bỏ qua giúp em").

## Khung theo loại

### Partner tiềm năng (họ có dịch vụ)

1. Nguồn + nhắc đúng dịch vụ họ đang chào.
2. Mình là ai, đang cần nguồn cung gì, quy mô khách ra sao.
3. Lợi ích cụ thể: lượng khách đưa về / cách thanh toán / không mất phí đăng ký (chỉ nêu điều đã được duyệt).
4. Một hành động nhỏ tiếp theo: xin bảng giá, xin vài hình, hẹn 10 phút gọi.

### Khách tiềm năng (họ có nhu cầu)

1. Nguồn + nhắc đúng nhu cầu họ hỏi.
2. Trả lời thẳng câu họ hỏi (nếu đã có dữ liệu) — đừng bắt họ hỏi lại.
3. Một phương án cụ thể kèm khoảng giá **đã được duyệt**, hoặc nói rõ cần thêm thông tin gì để báo giá.
4. Hành động tiếp theo: gửi báo giá chi tiết, hoặc gọi 5 phút chốt nhu cầu.

## Giới hạn theo kênh

| Kênh | Độ dài | Lưu ý |
|---|---|---|
| Zalo / Messenger | 4–6 dòng | Xuống dòng thoáng, một câu hỏi duy nhất ở cuối |
| SMS | ≤ 300 ký tự | Có tên người gửi + tên công ty, không viết tắt khó hiểu |
| Email | Tiêu đề ≤ 60 ký tự | Tiêu đề nhắc đúng nhu cầu/dịch vụ của họ, không giật tít |
| Gọi điện | Kịch bản 30 giây | Câu mở đầu · 2 câu hỏi làm rõ · 1 lời hẹn cụ thể · cách kết thúc lịch sự |

## Sau khi gửi

Nhắc người dùng ghi nhận lại trên màn hình **Lead → ✉ Mời**: kênh đã dùng, ngày, phản hồi.
Đây là cách duy nhất để lần sau không mời trùng và biết kênh nào hiệu quả cho nhóm dịch vụ nào.
