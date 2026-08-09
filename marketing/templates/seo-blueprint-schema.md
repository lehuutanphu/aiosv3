# Schema — Topic Cluster SEO Blueprint

Sản phẩm của skill `kien-truc-seo-cluster` (Stage 2). Ghi vào file cluster
`marketing/data/clusters/CLS-YYYY-NNN.json`, đồng thời in bảng tóm tắt ra chat.

## 1. Phân tầng từ khóa — chống ăn thịt lẫn nhau

Đây là phần dễ hỏng nhất của một content cluster. Quy tắc phân định:

| Tầng | Bài | Dạng từ khóa | Intent | Ví dụ |
|---|---|---|---|---|
| Rộng | **Pillar** (1 bài) | Head term, 1–3 từ | Tổng quan, so sánh, "là gì", "cẩm nang" | `du lịch Đà Nẵng` |
| Hẹp | **Cluster** (N bài) | Long-tail, 4+ từ, gắn thực thể cụ thể | Chi tiết một thực thể, "kinh nghiệm", "giá", "đường đi" | `kinh nghiệm đi Bà Nà Hills tự túc` |

**Kiểm tra bắt buộc trước khi sang Stage 3** — mọi cặp bài `(A, B)` trong cluster:

1. `tu_khoa_chinh` của A **không được** là chuỗi con của `tu_khoa_chinh` của B (trừ cặp pillar–cluster,
   nơi việc lồng nhau là có chủ đích).
2. Hai bài cluster **không** cùng nhắm một thực thể chính. Trùng thực thể → gộp làm một bài,
   hoặc tách theo intent khác hẳn (một bài "giá vé", một bài "lịch trình").
3. Mỗi bài cluster phải trả lời được câu: *"Ai gõ từ khóa này mà đọc bài pillar sẽ thấy thiếu cái gì?"*
   Không trả lời được → bài đó không có lý do tồn tại, bỏ khỏi danh sách.

Ghi kết quả phân định vào `ghi_chu_phan_dinh_tu_khoa` của từng bài cluster.

## 2. Số liệu volume — quy tắc trung thực

Hệ thống **chưa nối** Ahrefs / SEMrush / Google Keyword Planner (xem `marketing/README.md` §3).

- **Cấm bịa** số volume, KD, CPC. Không ghi "1.900 lượt/tháng" khi không có nguồn.
- Được phép ghi **mức độ ước lượng định tính**: `cao` / `trung bình` / `thấp`, kèm căn cứ
  (số kết quả SERP, có/không có quảng cáo, độ dài SERP feature).
- Nếu người dùng dán số liệu từ công cụ của họ → ghi kèm `nguon: "<tên công cụ>, <ngày>"`.

## 3. Ma trận liên kết nội bộ

```
                    ┌──────────────┐
              ┌────▶│   PILLAR     │◀────┐
              │     │   (P-00)     │     │
              │     └──────┬───────┘     │
              │            │             │
     link về  │            │ link ra     │ link về
              │            ▼             │
       ┌──────┴───┐  ┌──────────┐  ┌─────┴────┐
       │  C-01    │  │  C-02    │  │  C-03    │
       └──────────┘  └──────────┘  └──────────┘
            ▲              │
            └──────────────┘
          link ngang: CHỈ khi thực sự liên quan ngữ cảnh
```

| Chiều liên kết | Bắt buộc | Số lượng | Anchor text |
|---|---|---|---|
| Cluster → Pillar | ✅ Có | ≥ 1 mỗi bài | Chứa từ khóa chính của pillar, đặt trong câu văn tự nhiên |
| Pillar → Cluster | ✅ Có | Đủ **100%** số bài cluster | Chứa từ khóa chính của bài cluster đích |
| Cluster ↔ Cluster | ⚪ Tùy | 0–2 mỗi bài | Chỉ khi hai bài thực sự nối tiếp nhau về ngữ cảnh |

**Cấm anchor text:** "tại đây", "click vào đây", "xem thêm", "link này", URL trần.

## 4. Bảng blueprint in ra chat

```
🗺️  CLS-2026-001 — <chủ đề gốc>
    Pillar  : P-00  <tiêu đề>            KW: <tu_khoa_chinh>          (~2.500 từ)
    Cluster : C-01  <tiêu đề>            KW: <tu_khoa_chinh>          (~1.500 từ)
              C-02  <tiêu đề>            KW: <tu_khoa_chinh>          (~1.500 từ)
              ...
    Kiểm tra ăn thịt từ khóa : ✅ không phát hiện chồng lấn
    Tổng số bài              : 1 + N
    Ước tính tổng độ dài     : ~X từ
```
