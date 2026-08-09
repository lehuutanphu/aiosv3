# marketing/data — Dữ liệu vận hành

Khác với `hr/data/`, thư mục này **không chứa PII** nên **được commit bình thường** — bài viết là
tài sản nội dung của công ty, cần lịch sử phiên bản.

Ngoại lệ cần tự kiểm: nếu nội dung nghiên cứu có kèm dữ liệu khách hàng, số liệu doanh thu chưa công bố
hay bảng giá nội bộ → tách ra ngoài repo trước khi commit.

## Cấu trúc

```
data/
├── clusters/                    ← trạng thái từng cluster — CLS-YYYY-NNN.json
└── bai-viet/
    └── CLS-YYYY-NNN/
        ├── nghien-cuu-goc.md        ← Stage 1: báo cáo nghiên cứu + danh sách thực thể
        ├── seo-blueprint.md         ← Stage 2: sơ đồ từ khóa + ma trận liên kết
        ├── P-00-<slug>.md           ← bài trụ cột
        ├── C-01-<slug>.md           ← bài vệ tinh
        ├── C-02-<slug>.md
        ├── ...
        ├── image-prompts.json       ← toàn bộ prompt ảnh của cluster
        └── PACKAGE.md               ← Stage 4: gói bàn giao cuối
```

## File trạng thái `clusters/CLS-YYYY-NNN.json`

Đây là **xương sống của vòng lặp**. Mọi skill đọc/ghi cùng file này, nên một cluster 20 bài viết
dở dang có thể đóng phiên chat rồi mở lại hôm sau chạy tiếp đúng bài đang dở — không phải làm lại
từ đầu, không mất bài đã viết.

Trường quan trọng:

| Trường | Ý nghĩa |
|---|---|
| `buoc_hien_tai` | 1–4 theo 4 stage của pipeline |
| `pillar.trang_thai` / `cluster[].trang_thai` | `chua_bat_dau` → `da_nghien_cuu` → `da_co_dan_y` → `da_viet` → `da_co_prompt_anh` → `hoan_tat` |
| `lien_ket_noi_bo.thieu_link_ve_pillar[]` | Do Stage 4 điền. Còn phần tử = chưa được đóng gói |
| `anh.credit_da_duyet` | Chỉ `true` khi người dùng đã đồng ý bằng chữ cho việc tiêu credit sinh ảnh |
| `nhat_ky[]` | Mỗi hành động một dòng — dùng để biết ai/agent nào làm gì, lúc nào |

## Đặt tên

- `cluster_id`: `CLS-<năm>-<3 chữ số>`, đếm từ các file có sẵn trong `clusters/`.
- `ma_bai`: `P-00` cho pillar, `C-01`…`C-NN` cho vệ tinh. **Không đổi mã** sau khi đã tạo —
  ma trận liên kết nội bộ tham chiếu theo mã này.
- Tên file bài: `<ma_bai>-<slug>.md`, slug không dấu, phân cách bằng gạch ngang.
