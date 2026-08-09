---
name: dong-goi-cluster
description: Stage 4 pipeline Content Cluster — kiểm tra liên kết nội bộ hai chiều và đóng gói toàn bộ cluster thành gói bàn giao. Trigger khi user nói "đóng gói cluster", "kiểm tra liên kết nội bộ", "bàn giao bộ bài viết", "cluster xong chưa", hoặc khi mọi bài trong file cluster đã hoan_tat. Chặn việc đóng gói khi còn bài thiếu link về pillar hoặc thiếu prompt ảnh.
---

# S4 — Kiểm tra liên kết & đóng gói bàn giao

Mục tiêu: đảm bảo bộ bài viết là **một khối liên kết hoàn chỉnh**, không phải N file rời nhau.

## Bước 1 — Cổng chặn trước khi đóng gói

Không chạy tiếp nếu còn bất kỳ mục nào chưa đạt. Báo rõ mục nào hỏng, sửa xong mới chạy lại:

| Kiểm tra | Điều kiện đạt |
|---|---|
| Mọi bài đã viết | Không còn `trang_thai` ≠ `hoan_tat` |
| Mọi bài có prompt ảnh | `so_prompt_anh` > 0 và bằng số placeholder trong file bài |
| Độ dài đạt sàn | Pillar ≥ 2.000 từ · Cluster ≥ 1.200 từ |
| Có nguồn cho số liệu | Bài có giá/giờ/khoảng cách phải có `nguon_tham_khao` khác rỗng |

## Bước 2 — Quét liên kết nội bộ hai chiều

1. **Cluster → Pillar**: mở từng file `C-*.md`, tìm link tới slug của pillar.
   Thiếu → đưa `ma_bai` vào `lien_ket_noi_bo.thieu_link_ve_pillar[]`.
2. **Pillar → Cluster**: mở `P-00-*.md`, đối chiếu với danh sách `cluster[]`.
   Bài nào chưa được trỏ tới → đưa vào `lien_ket_noi_bo.thieu_link_tu_pillar[]`.
3. **Anchor text**: quét mọi link nội bộ, bắt các anchor cấm — "tại đây", "click vào đây",
   "xem thêm", "link này", URL trần. Báo từng chỗ kèm đề xuất anchor thay thế.
4. **Link chết nội bộ**: link trỏ tới slug không tồn tại trong cluster → báo lỗi.

Thiếu link thì **tự chèn** vào đúng ngữ cảnh phù hợp (không nhét vào cuối bài cho đủ số),
dùng anchor text blueprint đã soạn ở Stage 2. Chèn xong quét lại cho tới khi cả hai mảng rỗng.

## Bước 3 — Đóng gói

Ghi `marketing/data/bai-viet/CLS-YYYY-NNN/PACKAGE.md`:

```markdown
# Gói bàn giao — CLS-YYYY-NNN · <chủ đề gốc>

Ngày đóng gói: <ngày> · Tổng <1+N> bài · <tổng số> từ · <tổng số> prompt ảnh

## Danh sách bài viết

| Mã | Loại | Tiêu đề | Từ khóa chính | Số từ | Ảnh | File |
|---|---|---|---|---|---|---|
| P-00 | Pillar | … | … | … | … | … |
| C-01 | Cluster | … | … | … | … | … |

## Thứ tự đăng đề xuất

1. **P-00 trước** — cluster cần đích để trỏ về.
2. Các bài cluster theo thứ tự ưu tiên từ khóa, giãn 2–3 ngày một bài.

## Sơ đồ liên kết nội bộ
<bảng: bài nào trỏ tới bài nào>

## Việc còn lại cho người
- [ ] Sinh ảnh thật từ prompt (chưa chạy — tốn credit, cần duyệt)
- [ ] Kiểm tra lại số liệu có hạn sử dụng: <liệt kê bài + số liệu + ngày kiểm chứng>
- [ ] Đăng lên <website_dich>, gắn schema Article/FAQPage
- [ ] Khai báo sitemap, gửi Google Search Console
```

## Bước 4 — Chốt trạng thái

- `lien_ket_noi_bo.da_kiem_tra = true`, `ngay_kiem_tra = <hôm nay>`.
- `buoc_hien_tai = 4`, `trang_thai = "da_dong"`, `ngay_dong = <hôm nay>`.
- Append `nhat_ky[]`.

## Output

In ra chat bảng danh sách bài + đường dẫn `PACKAGE.md` + danh sách việc còn lại cho người.
Nêu thẳng những gì **chưa** làm (ảnh thật, đăng bài, schema) — không để người dùng tưởng đã xong hết.
