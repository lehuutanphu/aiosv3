---
name: content-cluster
description: Skill ĐIỀU PHỐI toàn bộ pipeline sản xuất Topic Cluster chuẩn SEO (1 bài Pillar + N bài Cluster) từ một link hoặc chủ đề gốc. Trigger khi user nhắc "content cluster", "topic cluster", "bộ bài viết SEO", "tách chủ đề thành nhiều bài", "viết cluster", "bài trụ cột và vệ tinh", "pillar page", "CLS-", "tiếp tục cluster", "cluster đang tới đâu". Đọc file trạng thái marketing/data/clusters/CLS-*.json, xác định đang ở stage nào, rồi gọi đúng skill con và LẶP cho tới khi mọi bài viết hoàn tất. KHÔNG tự làm việc của skill con, KHÔNG dừng ở bước lập kế hoạch.
---

# Điều phối Content Cluster

Bạn là bộ điều phối của `mkt-1 (Content Agent)`. Nhiệm vụ: **định vị trạng thái → gọi đúng skill con →
cập nhật trạng thái → lặp tới khi xong**. Không làm thay việc của skill con.

## Bước 0 — Định vị

1. Liệt kê `marketing/data/clusters/CLS-*.json`.
2. Nếu **không có file nào** hoặc user đưa link/chủ đề mới → gọi skill `nghien-cuu-chu-de`.
3. Nếu **có nhiều file đang mở** (`trang_thai` ≠ `da_dong`) → hỏi user chọn cluster nào.
4. Nếu **có đúng 1 file đang mở** → đọc, in bảng tóm tắt, rồi chạy tiếp từ đúng chỗ đang dở.

## Bảng tóm tắt bắt buộc in ra mỗi lần chạy

```
🗺️  CLS-2026-001 — <chủ đề gốc>
    Nguồn        : <url hoặc "chủ đề tự do">
    Stage hiện tại: S<n> — <tên stage>
    Tiến độ bài  : <n>/<tổng> hoàn tất | <n> đang viết | <n> chưa bắt đầu
    Bài đang dở  : <ma_bai> — <tiêu đề> (<trạng thái>)
    Việc cần bạn : <danh sách việc chờ người, hoặc "không có">
    Bước kế tiếp : /<ten-skill>
```

## Bản đồ stage → skill

| `buoc_hien_tai` | Stage | Gọi skill |
|---|---|---|
| 1 | Nghiên cứu gốc & bóc tách thực thể | `nghien-cuu-chu-de` |
| 2 | Kiến trúc SEO cluster & ma trận liên kết | `kien-truc-seo-cluster` |
| 3 | **Vòng lặp viết bài** (từng bài một) | `viet-bai-chuan-seo` → `prompt-anh-ai` |
| 4 | Kiểm tra liên kết & đóng gói bàn giao | `dong-goi-cluster` |

## 🔁 Quy tắc vòng lặp — điều khoản quan trọng nhất của skill này

Ở Stage 3, bạn **phải lặp cho tới khi mọi bài trong danh sách đạt `hoan_tat`**:

```
Thứ tự xử lý: P-00 (pillar) trước → rồi C-01, C-02, … C-NN theo đúng thứ tự mã bài.

Với mỗi bài:
  1. viet-bai-chuan-seo   → nghiên cứu sâu + dàn ý + viết bài đầy đủ
  2. prompt-anh-ai        → sinh prompt cho mọi [IMAGE_PLACEHOLDER_X] trong bài đó
  3. ghi file trạng thái  → trang_thai = "hoan_tat", append nhat_ky[]
  4. → sang bài kế tiếp NGAY, không hỏi lại, không xin phép
```

**Cấm các hành vi sau:**

- ❌ Dừng lại sau khi lập xong kế hoạch rồi hỏi "anh có muốn tôi viết tiếp không?"
- ❌ Viết tóm tắt/dàn ý các bài còn lại thay vì viết bài đầy đủ.
- ❌ Trả kết quả cuối khi còn bài ở trạng thái ≠ `hoan_tat`.
- ❌ Gộp nhiều bài vào một lượt xử lý để "cho nhanh" — mỗi bài một lượt, giữ context sạch.

**Ngoại lệ duy nhất được phép dừng:** hết giới hạn phiên/context. Khi đó phải (a) ghi file trạng thái
trước, (b) báo rõ đã xong bài nào, còn bài nào, (c) nói chính xác câu lệnh để chạy tiếp:
`/content-cluster` sẽ tự nhận đúng chỗ đang dở.

## Khi nào dùng subagent

Mặc định chạy tuần tự trong phiên chính — giữ được mạch văn và tránh trùng lặp câu chữ giữa các bài.

Chuyển sang subagent `viet-bai-cluster` khi **N > 6 bài**: mỗi bài một context riêng, chạy song song
theo lô 3–4 bài. Đổi lại phải truyền đủ vào prompt subagent: blueprint SEO, danh sách tiêu đề toàn
cluster (để tránh trùng góc nhìn), và **tóm tắt 3 dòng của các bài đã viết xong** — thiếu phần này
các bài sẽ lặp ý nhau.

Nghiên cứu chủ đề con của nhiều bài có thể chạy song song bằng subagent `nghien-cuu-chu-de-con`
ngay cả khi N nhỏ, vì nghiên cứu không sinh ra văn phong cần nhất quán.

## Quy tắc cập nhật trạng thái

- Sau mỗi skill con chạy xong, ghi lại file cluster: cập nhật `buoc_hien_tai` hoặc
  `trang_thai` của bài tương ứng, append `nhat_ky[]` một dòng
  `{ "thoi_gian": "<ISO>", "hanh_dong": "...", "ma_bai": "...", "nguoi_thuc_hien": "mkt-1" }`.
- **Không bao giờ** ghi đè `cluster[]` — chỉ sửa đúng phần tử theo `ma_bai`.
- Không đổi `ma_bai` sau khi đã tạo — ma trận liên kết nội bộ tham chiếu theo mã này.
- File cluster hỏng/thiếu field → dừng, báo user, không tự đoán để vá.

## Nhắc việc chủ động

Khi được gọi, tự kiểm tra và cảnh báo nếu:

- Có bài ở `da_viet` nhưng chưa có prompt ảnh quá **1 phiên** → nhắc chạy `prompt-anh-ai`.
- Blueprint có **≥ 2 bài cùng `tu_khoa_chinh`** → cảnh báo ăn thịt từ khóa, yêu cầu quay lại Stage 2.
- Bài viết có số liệu (giá vé, giờ mở cửa) mà `nguon_tham_khao` rỗng → nhắc bổ sung nguồn.
- Cluster mở quá **30 ngày** chưa đóng → hỏi có tiếp tục hay đóng lại.

## Đóng cluster

Chỉ đóng khi: mọi bài `hoan_tat` ✅, `lien_ket_noi_bo.da_kiem_tra = true` và hai mảng
`thieu_link_*` đều rỗng ✅, mọi bài đều có prompt ảnh ✅. Khi đó gọi `dong-goi-cluster`,
đặt `trang_thai = "da_dong"`, `ngay_dong = <hôm nay>`.
