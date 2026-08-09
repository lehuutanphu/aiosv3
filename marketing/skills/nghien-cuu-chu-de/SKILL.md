---
name: nghien-cuu-chu-de
description: Stage 1 pipeline Content Cluster — nghiên cứu link/chủ đề gốc và bóc tách danh sách thực thể con. Trigger khi user đưa một link hoặc chủ đề tổng quan và muốn tách thành nhiều bài viết, hoặc nói "nghiên cứu chủ đề này", "bóc tách chủ đề", "có thể tách ra bao nhiêu bài". Đọc nguồn, liệt kê mọi thực thể/chủ đề con, phân loại thành 1 Pillar + N Cluster, rồi tạo file marketing/data/clusters/CLS-YYYY-NNN.json. Không tự viết bài ở bước này.
---

# S1 — Nghiên cứu gốc & bóc tách thực thể

Mục tiêu: biến một link/chủ đề mơ hồ thành **danh sách thực thể con có thật, mỗi thực thể đủ chất liệu
để đứng thành một bài viết độc lập**.

## Đầu vào cần có

Hỏi nếu thiếu, tối đa 4 câu một lượt:

1. **Nguồn**: link cụ thể, hay chủ đề tự do? (nếu là link → đọc bằng WebFetch)
2. **Đối tượng đọc**: ai sẽ đọc bộ bài này? (khách lẻ / doanh nghiệp / người mới tìm hiểu…)
3. **Website đích + CTA mặc định**: bài dẫn người đọc tới hành động gì?
4. **Giọng văn**: theo brand guideline nào, hay tự do?

Thiếu mục 2 và 3 vẫn chạy được, nhưng phải ghi `null` và cảnh báo là bài sẽ chung chung hơn.

## Xử lý

### 1. Đọc nguồn

- Link → `WebFetch`. Đọc **toàn bộ**, không dừng ở phần đầu.
- Chủ đề tự do → `WebSearch` lấy 5–8 nguồn uy tín, ưu tiên trang chính chủ và báo lớn.
- Ghi lại ngày truy cập vào `nguon.ngay_truy_cap` — số liệu có hạn sử dụng.

### 2. Bóc tách thực thể con

Liệt kê **mọi** thực thể/chủ đề con xuất hiện trong nguồn. Với chủ đề du lịch đó là địa danh, món ăn,
hoạt động, phương tiện; với sản phẩm là tính năng, use case, nhóm khách hàng; với dịch vụ là gói dịch
vụ, quy trình, vấn đề khách gặp phải.

Với mỗi thực thể, chấm 3 câu hỏi sàng lọc:

| Câu hỏi | Không đạt thì |
|---|---|
| Có đủ **chất liệu riêng** cho ≥ 1.200 từ không? (chi tiết, số liệu, trải nghiệm) | Gộp vào bài khác làm một mục H2 |
| Có **người tìm kiếm riêng** thực thể này không? | Bỏ, chỉ nhắc trong bài pillar |
| Có **trùng thực thể chính** với mục nào đã chọn không? | Gộp hai mục lại, hoặc tách theo intent khác hẳn |

Ghi rõ lý do loại cho từng mục bị loại — người dùng cần thấy tại sao một địa danh không được lên bài.

### 3. Phân loại

- **Pillar (1 bài)**: bài tổng quan bao trùm toàn chủ đề, dẫn ra mọi bài vệ tinh. Độ dài 2.000–2.500 từ.
- **Cluster (N bài)**: mỗi thực thể đạt sàng lọc = 1 bài, 1.200–1.800 từ.

### 4. Tạo file trạng thái

1. Sinh `cluster_id` = `CLS-<năm>-<số thứ tự 3 chữ số>`, đếm từ file có sẵn trong `marketing/data/clusters/`.
2. Copy `marketing/templates/cluster.template.json` → điền → lưu `marketing/data/clusters/CLS-YYYY-NNN.json`.
3. Tạo thư mục `marketing/data/bai-viet/CLS-YYYY-NNN/`.
4. Ghi báo cáo nghiên cứu ra `marketing/data/bai-viet/CLS-YYYY-NNN/nghien-cuu-goc.md`.
5. Đặt `buoc_hien_tai = 2`, `trang_thai = "dang_mo"`.

## Quy tắc trung thực

- **Chỉ ghi thực thể có trong nguồn.** Không thêm địa danh/tính năng vì "thường thấy trong loại bài này".
- Số liệu (giá, giờ mở cửa, khoảng cách) phải kèm URL nguồn + ngày truy cập. Không nhớ được nguồn thì
  ghi `chưa kiểm chứng` — bước viết bài sẽ phải tra lại.
- Nguồn mâu thuẫn nhau → ghi cả hai kèm nguồn, đánh dấu `cần xác minh`, không tự chọn bên nào.

## Output

1. File `CLS-YYYY-NNN.json` + `nghien-cuu-goc.md`.
2. Bảng in ra chat:

```
📚 CLS-2026-001 — <chủ đề gốc>
   Nguồn        : <url> (truy cập <ngày>)
   Thực thể tìm thấy : <tổng> — chọn <N> lên bài, loại <m>
   Pillar       : <tiêu đề dự kiến>
   Cluster      : C-01 <thực thể> · C-02 <thực thể> · …
   Đã loại      : <thực thể> (<lý do>) · …
```

3. Câu chốt: *"Đã bóc tách xong <N> chủ đề con. Bước kế tiếp: `/kien-truc-seo-cluster` để dựng sơ đồ từ khóa."*
