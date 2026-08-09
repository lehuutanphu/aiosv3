---
ma_bai: C-01
cluster_id: CLS-YYYY-NNN
loai: cluster            # pillar | cluster
tieu_de:
slug:
title_tag:               # ≤ 60 ký tự
meta_description:        # 140–160 ký tự
tu_khoa_chinh:
tu_khoa_phu: []
tu_khoa_lsi: []
do_dai_thuc_te: 0
ngay_viet:
nguon_tham_khao: []      # URL + ngày truy cập cho mọi số liệu/giá/giờ mở cửa
---

# {H1 — chứa từ khóa chính, khác title_tag ít nhất một chút}

{Mở bài 80–120 từ: nêu đúng vấn đề người đọc đang có, hứa hẹn cụ thể bài này giải quyết gì.
Không mở bài kiểu "Trong thời đại ngày nay…". Chèn từ khóa chính trong 100 từ đầu.}

[IMAGE_PLACEHOLDER_1: {mô tả bối cảnh ảnh hero bằng tiếng Việt để Agent 4 dựng prompt}]

## {H2 — khía cạnh 1}

{Nội dung. Mỗi H2 tối thiểu 150 từ, có ít nhất một chi tiết cụ thể: con số, giá, giờ, địa chỉ,
tên riêng. Thông tin có thể thay đổi theo thời gian (giá vé, giờ mở cửa) phải kèm ngày kiểm chứng
và nguồn trong `nguon_tham_khao`.}

### {H3 — chi tiết}

{...}

## {H2 — khía cạnh 2}

[IMAGE_PLACEHOLDER_2: {bối cảnh}]

{...}

## {H2 — Kinh nghiệm thực tế / Lưu ý}

{Phần này phải mang thông tin mà đọc trang chủ không có được: mẹo, thời điểm nên đi, lỗi thường gặp,
chi phí phát sinh. Đây là phần tạo khác biệt so với bài của đối thủ.}

## Câu hỏi thường gặp

**{Câu hỏi 1 — dạng long-tail, lấy từ People Also Ask}**

{Trả lời 40–60 từ, thẳng vào ý, đủ để lấy featured snippet.}

**{Câu hỏi 2}**

{...}

## Kết luận

{Tóm 3–4 ý chính, không lặp nguyên văn phần trên. Kết bằng {cta_mac_dinh} của cluster.}

---

## Liên kết nội bộ

> Bài cluster **bắt buộc** có ít nhất 1 link về pillar với anchor text tự nhiên (không dùng
> "tại đây", "click vào đây"). Bài pillar **bắt buộc** trỏ ra toàn bộ bài cluster.

- Về bài trụ cột: [{anchor text chứa từ khóa pillar}]({slug pillar})
- Bài liên quan cùng cluster: [{anchor}]({slug}) — chỉ liên kết khi thực sự liên quan về ngữ cảnh

## AI Image Prompts

> Do skill `prompt-anh-ai` điền. Mỗi placeholder ở trên phải có đúng một prompt tương ứng.

| Placeholder | Prompt (English) | Aspect |
|---|---|---|
| IMAGE_PLACEHOLDER_1 | | `--ar 16:9` |
| IMAGE_PLACEHOLDER_2 | | `--ar 16:9` |
