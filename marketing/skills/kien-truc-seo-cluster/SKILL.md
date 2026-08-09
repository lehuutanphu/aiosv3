---
name: kien-truc-seo-cluster
description: Stage 2 pipeline Content Cluster — dựng sơ đồ từ khóa cho toàn bộ cluster và ma trận liên kết nội bộ. Trigger khi user nói "lập kế hoạch từ khóa", "sơ đồ SEO", "blueprint cluster", "phân bổ từ khóa", "liên kết nội bộ", hoặc khi file cluster có buoc_hien_tai = 2. Phân tầng từ khóa Pillar (rộng) và Cluster (long-tail), chạy kiểm tra ăn thịt từ khóa, ghi kết quả vào file cluster. Không bịa số volume khi chưa có công cụ nối vào.
---

# S2 — Kiến trúc SEO cho toàn cluster

Mục tiêu: mỗi bài trong cluster có **một chỗ đứng từ khóa riêng, không giẫm chân nhau**, và toàn bộ
cluster nối với nhau thành một khối mà Google đọc được.

Chuẩn chi tiết: `marketing/templates/seo-blueprint-schema.md`. Skill này thực thi theo đúng schema đó.

## Xử lý

### 1. Từ khóa bài Pillar

- 1 `tu_khoa_chinh` dạng head term, intent tổng quan.
- 5–8 `tu_khoa_phu` là các biến thể rộng + câu hỏi tổng quan.
- Pillar **không** nhắm long-tail của bất kỳ bài cluster nào — đó là phần đất của bài vệ tinh.

### 2. Từ khóa từng bài Cluster

Với mỗi bài, xác định:

| Trường | Yêu cầu |
|---|---|
| `tu_khoa_chinh` | Long-tail 4+ từ, **chứa tên thực thể cụ thể**, intent hẹp |
| `tu_khoa_phu` | 4–6 biến thể: "giá", "kinh nghiệm", "có gì", "đường đi", "review" |
| `tu_khoa_lsi` | 5–10 từ đồng hành ngữ nghĩa (đưa vào bài tự nhiên, không nhồi) |
| `title_tag` | ≤ 60 ký tự, từ khóa chính ở đầu |
| `meta_description` | 140–160 ký tự, có từ khóa chính + một lý do để click |
| `slug` | Không dấu, gạch ngang, bỏ từ dừng, ≤ 5 từ |

### 3. 🔴 Kiểm tra ăn thịt từ khóa — cổng chặn bắt buộc

Chạy đủ 3 phép kiểm trong `seo-blueprint-schema.md` §1 trên **mọi cặp bài**. Với mỗi bài, trả lời
bằng chữ câu hỏi: *"Ai gõ từ khóa này mà đọc bài pillar sẽ thấy thiếu cái gì?"*

- Không trả lời được → bài đó **không có lý do tồn tại**, đề xuất bỏ hoặc gộp.
- Hai bài trùng thực thể chính → gộp, hoặc tách theo intent khác hẳn.
- Ghi kết luận vào `ghi_chu_phan_dinh_tu_khoa` của từng bài.

**Không được chuyển sang Stage 3 khi còn chồng lấn chưa xử lý.** Đây là lỗi tốn kém nhất của
content cluster: phát hiện sau khi đã viết 15 bài thì phải viết lại, không chỉ sửa từ khóa.

### 4. Số liệu volume — quy tắc trung thực

Hệ thống chưa nối Ahrefs / SEMrush / Keyword Planner.

- **Cấm bịa** con số volume, KD, CPC.
- Được ghi ước lượng định tính `cao` / `trung bình` / `thấp` **kèm căn cứ quan sát được**
  (số kết quả SERP, có quảng cáo hay không, SERP feature nào đang chiếm chỗ).
- User dán số từ công cụ của họ → ghi kèm `nguon: "<công cụ>, <ngày>"`.

### 5. Ma trận liên kết nội bộ

Lập bảng theo `seo-blueprint-schema.md` §3: mỗi bài cluster ≥ 1 link về pillar; pillar trỏ ra
**100%** bài cluster; link ngang chỉ khi thực sự liên quan ngữ cảnh. Soạn sẵn **anchor text đề xuất**
cho từng chiều liên kết — để bước viết bài chèn đúng, không tự nghĩ ra anchor rời rạc.

## Output

1. Cập nhật file cluster: điền `pillar.*` và toàn bộ `cluster[].*`, đặt `buoc_hien_tai = 3`.
2. Ghi `marketing/data/bai-viet/CLS-YYYY-NNN/seo-blueprint.md`.
3. In bảng blueprint ra chat theo mẫu §4 của schema.
4. Câu chốt: *"Blueprint xong, không phát hiện chồng lấn từ khóa. Bước kế tiếp: `/viet-bai-chuan-seo`
   — bắt đầu vòng lặp viết <1 + N> bài."*

Nếu **có** phát hiện chồng lấn: báo rõ cặp bài nào, đề xuất gộp/tách, **chờ user chốt** rồi mới
đặt `buoc_hien_tai = 3`.
