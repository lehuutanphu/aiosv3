---
name: boc-tach-lead
description: Bóc tách thông tin liên hệ từ khối bình luận mạng xã hội thành JSON Lead — tên, số điện thoại, email, nguyên văn bình luận. Được gọi bởi skill thu-thap-lead, hoặc dùng trực tiếp khi user dán một đoạn bình luận và nói "tách sđt ra giúp", "lấy thông tin liên hệ trong đoạn này". Luật cứng - chỉ ghi số điện thoại và email xuất hiện nguyên văn trong nguồn, không suy đoán, không hoàn thiện số thiếu chữ số.
---

# Bóc tách Lead từ bình luận

Đầu vào: một khối văn bản (bình luận Facebook/Zalo/forum đã dán hoặc đã tải).
Đầu ra: JSON thuần `{"leads":[...]}`, không kèm văn xuôi.

## Luật cứng — phần quan trọng nhất

1. **Chỉ ghi thông tin có nguyên văn trong nguồn.** Số điện thoại/email không tìm thấy nguyên văn
   thì để rỗng. Tuyệt đối không hoàn thiện số thiếu chữ số, không thêm mã vùng, không sửa "sai chính tả"
   của số điện thoại.
2. **Không có sđt lẫn email → không tạo Lead.** Bình luận kiểu "đẹp quá", "quan tâm ạ" bị bỏ qua.
   Số lượng Lead ít là kết quả đúng, không phải lỗi.
3. **`comment` giữ nguyên văn.** Được phép cắt bớt cho gọn, **không** được viết lại theo ý mình,
   không tóm tắt vào trường này (tóm tắt để ở `nhu_cau`).
4. **Tên là tên hiển thị người ta để.** Không suy ra tên từ email, không đoán giới tính, không
   chuẩn hóa cách viết hoa.
5. Một người bình luận nhiều lần → **một Lead**, gộp nội dung, giữ số điện thoại đầu tiên tìm được.

## Nhận dạng số điện thoại Việt Nam

| Dạng gặp thật | Chuẩn hóa về |
|---|---|
| `0903112233`, `0903.112.233`, `0903 112 233`, `0903-112-233` | `0903112233` |
| `+84903112233`, `84903112233` | `0903112233` |
| Cố định `02838221234` (10–11 số, đầu `02`) | giữ nguyên |

Hợp lệ: di động `0(3\|5\|7\|8\|9)` + 8 số · cố định `02` + 8–9 số. Ngoài khuôn này → **không phải
số điện thoại**, bỏ qua (rất hay gặp: năm sinh, giá tiền, số nhà, mã đơn hàng).

Cạm bẫy: số nằm cuối dòng và dòng sau bắt đầu bằng chữ số ("…0987445566" xuống dòng "30 phút trước")
— **không** được nối hai dòng thành một số.

## Nhiễu giao diện cần bỏ khỏi `comment`

`Thích` · `Trả lời` · `Phản hồi` · `Chia sẻ` · `Xem thêm` · `Đã chỉnh sửa` · `2 giờ`, `30 phút`,
`3 ngày` · các mẩu ngăn bằng dấu `·`.

## Trả về

```json
{
  "leads": [
    {
      "ten": "Trần Minh Khoa",
      "sdt": "0903112233",
      "email": "",
      "comment": "<nguyên văn bình luận, có thể cắt bớt>",
      "nhu_cau": "<1 câu: họ cần gì, hoặc họ cung cấp dịch vụ gì>",
      "loai": "khach | partner | chua_ro",
      "dich_vu": "xe | homestay | quan-an | tour | spa-lam-dep | khac",
      "do_tin_cay": "cao | trung_binh | thap"
    }
  ]
}
```

`do_tin_cay` hạ xuống `thap` khi: không rõ tên, bình luận mơ hồ không nói rõ cần gì/bán gì, hoặc
số điện thoại nằm tách khỏi phần nội dung nên không chắc là của người này.

Việc gán `loai` và `dich_vu` theo bảng trong `/phan-loai-lead`.
