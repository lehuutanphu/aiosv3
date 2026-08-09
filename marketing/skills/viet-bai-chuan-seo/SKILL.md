---
name: viet-bai-chuan-seo
description: Stage 3 pipeline Content Cluster — nghiên cứu sâu, lập dàn ý và viết trọn một bài viết chuẩn SEO (pillar hoặc cluster). Trigger khi user nói "viết bài", "viết tiếp bài", "viết bài pillar", "viết bài cluster", "viết C-01", hoặc khi file cluster có buoc_hien_tai = 3. Xử lý ĐÚNG MỘT BÀI mỗi lượt theo thứ tự P-00 rồi C-01…C-NN, viết bài đầy đủ 1.200–2.500 từ kèm liên kết nội bộ và thẻ IMAGE_PLACEHOLDER. Không viết tóm tắt hay dàn ý thay cho bài hoàn chỉnh.
---

# S3 — Viết một bài chuẩn SEO

Skill này xử lý **đúng một bài mỗi lượt**. Vòng lặp qua các bài do skill `content-cluster` điều phối.

## Bước 1 — Chọn bài & nạp ngữ cảnh

1. Đọc file cluster, chọn bài đầu tiên có `trang_thai` ≠ `hoan_tat`, theo thứ tự `P-00` → `C-01` → …
2. Nạp: blueprint SEO của bài đó, danh sách **tiêu đề toàn bộ bài khác** trong cluster (để không giẫm
   góc nhìn), và **tóm tắt 3 dòng của các bài đã viết xong** (để không lặp câu chữ).
3. In ra: `▶ Đang viết <ma_bai> — <tiêu đề> (bài <i>/<tổng>)`.

## Bước 2 — Nghiên cứu sâu chủ đề con

Nghiên cứu riêng cho thực thể của bài này, không dùng lại nghiên cứu tổng ở Stage 1:

- `WebSearch` + `WebFetch` 3–6 nguồn về **đúng** thực thể này.
- Thu thập chi tiết mà bài tổng quan không thể có: giá cụ thể, giờ mở cửa, địa chỉ, lịch trình mẫu,
  lỗi người đi trước hay mắc, thời điểm nên/không nên.
- Đọc SERP top 5 của `tu_khoa_chinh`: các bài đang xếp hạng nói gì, và **thiếu gì**. Phần thiếu đó
  là chỗ bài này thắng.
- Lấy 3–5 câu hỏi từ People Also Ask cho mục FAQ.

Ghi mọi URL + ngày truy cập vào `nguon_tham_khao` của frontmatter bài viết.

## Bước 3 — Dàn ý H1–H2–H3

- H1: chứa `tu_khoa_chinh`, khác `title_tag` một chút để không lặp máy móc.
- 4–7 H2 cho bài cluster, 7–12 H2 cho bài pillar.
- Mỗi H2 gắn với một `tu_khoa_phu` hoặc `tu_khoa_lsi` cụ thể — không đặt H2 chỉ vì "cho đủ mục".
- Bắt buộc có H2 **"Kinh nghiệm thực tế / Lưu ý"** và mục **FAQ**.
- Bài pillar bắt buộc có một H2 dẫn ra toàn bộ bài cluster.

## Bước 4 — Viết bài đầy đủ

Theo `marketing/templates/bai-viet.template.md`.

| Loại bài | Độ dài | Số IMAGE_PLACEHOLDER |
|---|---|---|
| Pillar `P-00` | 2.000–2.500 từ | 3–5 |
| Cluster `C-nn` | 1.200–1.800 từ | 2–4 |

Quy tắc viết:

- **Từ khóa chính** xuất hiện trong 100 từ đầu, trong 1 H2, và rải tự nhiên — mật độ ~1%, **không nhồi**.
- Mỗi H2 tối thiểu 150 từ và phải có ít nhất một chi tiết cụ thể: con số, giá, giờ, địa chỉ, tên riêng.
  Đoạn văn chung chung không có chi tiết = viết lại.
- Câu ngắn, xuống dòng nhiều. Có bảng hoặc danh sách ở ít nhất 2 chỗ.
- **Cấm lặp câu chữ giữa các bài trong cùng cluster.** Cùng nói về một địa danh ở hai bài thì phải
  khác góc nhìn và khác cách diễn đạt. Nếu thấy mình đang viết lại đoạn đã viết ở bài trước → đổi góc.
- Chèn liên kết nội bộ theo **đúng anchor text** blueprint đã soạn ở Stage 2.
- Đặt `[IMAGE_PLACEHOLDER_X: <mô tả bối cảnh bằng tiếng Việt>]` tại vị trí ảnh — mô tả phải đủ
  cụ thể để `prompt-anh-ai` dựng được prompt mà không cần đọc lại toàn bài.

## Quy tắc trung thực

- Số liệu thay đổi theo thời gian (giá vé, giờ mở cửa, lịch tàu) **phải** có nguồn + ngày kiểm chứng.
  Không tra được → viết "tham khảo tại <nguồn chính chủ>", **không** ghi một con số cụ thể tự nghĩ ra.
- Không viết trải nghiệm cá nhân giả ("mình đã đến đây và thấy…") khi không có dữ liệu thật.
  Viết theo hướng tổng hợp kinh nghiệm từ nguồn.
- Không hứa hẹn kết quả không kiểm chứng được, không dùng so sánh nhất ("tốt nhất Việt Nam")
  nếu không có nguồn xếp hạng.

## Output

1. Ghi file `marketing/data/bai-viet/CLS-YYYY-NNN/<ma_bai>-<slug>.md`.
2. Cập nhật file cluster: `trang_thai = "da_viet"`, `duong_dan_bai`, `do_dai_thuc_te`, append `nhat_ky[]`.
3. In ra: `✅ <ma_bai> xong — <số> từ, <n> placeholder ảnh. Tiếp: /prompt-anh-ai`.
4. **Gọi ngay `prompt-anh-ai` cho bài này**, rồi quay lại lấy bài kế tiếp. Không dừng lại hỏi user.
