---
title: {Tiêu đề bài — chính là H1, chứa từ khóa chính}
slug: {khong-dau-noi-bang-gach-ngang}
category: {đúng MỘT trong: move | stay | eat | exp | event | guide}
tags: {2-4 thẻ, phân cách bằng dấu phẩy}
keywords: {từ khóa chính, 2-3 từ khóa phụ, phân cách bằng dấu phẩy}
metaTitle: {≤ 60 ký tự, có thể khác title một chút}
metaDescription: {≤ 155 ký tự, có từ khóa chính, đọc như lời mời chứ không phải tóm tắt máy móc}
excerpt: {1 câu ≤ 120 ký tự — hiện ở thẻ bài trên trang blog}
authorName: TripX
readTimeMin: {ước lượng: tổng số từ chia 200, làm tròn}
ma_bai: {P-00 hoặc C-01…}
cluster: {CLS-YYYY-NNN}
---

# {H1 — trùng title}

{Mở bài 80–120 từ: nêu đúng vấn đề người đọc đang có, hứa hẹn cụ thể bài này giải quyết gì.
Không mở bài kiểu "Trong thời đại ngày nay…". Chèn từ khóa chính trong 100 từ đầu.}

## {H2 — khía cạnh 1}

{Nội dung. Mỗi H2 tối thiểu 150 từ, có ít nhất một chi tiết cụ thể: con số, giá, giờ, địa chỉ,
tên riêng. Thông tin có thể đổi theo thời gian (giá vé, giờ mở cửa) phải ghi rõ mốc thời gian
kiểm chứng ngay trong câu, ví dụ "giá tháng 8/2026".}

![{alt tiếng Việt mô tả ảnh}](/images/blog/{slug}-1.jpg)

### {H3 — chi tiết}

{...}

## {H2 — khía cạnh 2}

{...}

![{alt tiếng Việt mô tả ảnh}](/images/blog/{slug}-2.jpg)

## {H2 — Kinh nghiệm thực tế / Lưu ý}

{Phần này phải mang thông tin mà đọc trang chủ không có được: mẹo, thời điểm nên đi, lỗi thường
gặp, chi phí phát sinh. Đây là phần tạo khác biệt so với bài của đối thủ.}

{Số liệu dạng bảng (giá vé, khung giờ, so sánh) để trong BẢNG MARKDOWN thật, không nhét vào ảnh —
ảnh AI không đáng tin khi cần chữ/số tiếng Việt chính xác.}

| {Cột 1} | {Cột 2} |
|---|---|
| {…} | {…} |

## Câu hỏi thường gặp

**{Câu hỏi 1 — dạng long-tail}**

{Trả lời 40–60 từ, thẳng vào ý, đủ để lấy featured snippet.}

**{Câu hỏi 2}**

{...}

## Kết luận

{Tóm 3–4 ý chính, không lặp nguyên văn phần trên.}

{Bài cluster: BẮT BUỘC có ít nhất 1 link về bài pillar, anchor text tự nhiên chứa từ khóa —
không dùng "tại đây"/"click vào đây". Bài pillar: trỏ ra toàn bộ bài cluster.
Dạng link: [{anchor text}](/blog/{slug-bai-kia})}

<!-- ============================================================
QUY ĐỊNH BẮT BUỘC — đọc kỹ trước khi viết

1. FRONT-MATTER: giá trị để TRẦN, KHÔNG bọc dấu nháy. Bộ đọc của TripX cắt theo dấu hai
   chấm đầu tiên và giữ nguyên phần còn lại — bọc nháy thì dấu nháy lọt vào tiêu đề thật.

2. category CHỈ nhận đúng một trong sáu giá trị: move (đi lại/phương tiện) · stay (lưu trú)
   · eat (ăn uống) · exp (trải nghiệm/tham quan) · event (sự kiện) · guide (cẩm nang tổng hợp).
   Không chắc thì để trống, đừng bịa giá trị mới.

3. ẢNH: đúng HAI placeholder dạng ![alt](/images/blog/{slug}-1.jpg) và -2.jpg, đặt xen giữa
   các H2 chứ không dồn đầu bài. Đây là quy ước để hệ thống nhận diện chỗ cần chèn ảnh thật —
   sai định dạng là bài đăng lên bị vỡ ảnh.

4. KHÔNG chèn <script>, <iframe>, <style>, class hay style — sanitizer phía TripX loại hết.
   Nhúng YouTube thì dùng link thường.

5. KHÔNG bịa số liệu. Không có nguồn chắc chắn thì viết định tính ("khoảng", "tùy mùa")
   thay vì nêu một con số cụ thể trông như đã kiểm chứng.

6. CHỈ trả về nội dung bài: bắt đầu bằng --- của front-matter, kết thúc ở câu cuối phần Kết
   luận. Không thêm lời dẫn, không in dòng trạng thái, không giải thích quy trình.
============================================================ -->
