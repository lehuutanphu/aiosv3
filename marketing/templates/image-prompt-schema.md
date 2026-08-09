# Chuẩn AI Image Prompt

Mọi prompt viết **bằng tiếng Anh**, kể cả khi bài viết là tiếng Việt — model sinh ảnh hiểu tiếng Anh
tốt hơn đáng kể. Tên riêng địa danh giữ nguyên (Ba Na Hills, Hoi An), không dịch.

## 5 thành phần bắt buộc

Thiếu bất kỳ thành phần nào là prompt chưa đạt:

| # | Thành phần | Ví dụ |
|---|---|---|
| 1 | **Subject** — chủ thể chính, cụ thể | `a wooden fishing boat with a woman in ao ba ba rowing` |
| 2 | **Scene** — bối cảnh, thời gian, chi tiết môi trường | `on the Thu Bon river at Hoi An, lanterns on the far bank, early evening` |
| 3 | **Lighting** — nguồn sáng và chất sáng | `warm golden hour backlight, soft haze` |
| 4 | **Camera angle** — góc máy + ống kính | `low angle, 35mm lens, shallow depth of field` |
| 5 | **Aspect ratio** — luôn ở cuối | `--ar 16:9` |

## Style — chọn đúng một, ghi rõ trong prompt

| Style | Khi dùng | Từ khóa chèn |
|---|---|---|
| `photorealistic` | Mặc định cho du lịch, ẩm thực, sản phẩm | `photorealistic, editorial travel photography, natural colors` |
| `lifestyle` | Ảnh có người dùng sản phẩm/dịch vụ | `candid lifestyle photography, natural expression` |
| `flat illustration` | Sơ đồ, infographic, bài hướng dẫn | `flat vector illustration, limited palette, clean lines` |
| `3d render` | Sản phẩm chưa có ảnh thật | `soft studio 3d render, matte finish` |

## Aspect ratio theo vị trí

| Vị trí trong bài | Ratio |
|---|---|
| Ảnh hero (đầu bài) | `--ar 16:9` |
| Ảnh chen giữa H2 | `--ar 16:9` hoặc `--ar 4:3` |
| Ảnh dọc cho mobile / Pinterest | `--ar 2:3` |
| Thumbnail mạng xã hội | `--ar 1:1` |

## Cấm

- **Không** đưa tên thương hiệu có nhãn hiệu đăng ký vào prompt (Coca-Cola, Toyota…) — rủi ro pháp lý.
- **Không** đưa tên người thật hoặc gương mặt nhận diện được của người có thật.
- **Không** yêu cầu chữ trong ảnh — model sinh chữ sai chính tả tiếng Việt gần như luôn luôn.
  Cần chữ thì để khâu hậu kỳ chèn overlay.
- **Không** mô tả cảnh mà bài viết không hề nhắc tới. Prompt phải bám bối cảnh của
  `[IMAGE_PLACEHOLDER_X: ...]` tương ứng.

## Định dạng trả về

```json
[
  {
    "placeholder": "IMAGE_PLACEHOLDER_1",
    "vi_tri": "hero",
    "prompt": "photorealistic editorial travel photography, a wooden fishing boat ... --ar 16:9",
    "alt_text_vi": "Thuyền gỗ trên sông Thu Bồn lúc hoàng hôn ở Hội An",
    "style": "photorealistic",
    "aspect": "16:9"
  }
]
```

`alt_text_vi` là **tiếng Việt**, mô tả đúng nội dung ảnh, có chèn từ khóa phụ nếu tự nhiên —
đây là phần lên Google Image Search, không được bỏ trống.

## Sinh ảnh thật qua genful.ai MCP

Prompt là sản phẩm mặc định. Sinh ảnh thật là bước **tùy chọn, tốn credit**:

1. Gọi `gommo_models_list` **trước** — lấy danh sách model và các enum hợp lệ.
2. **Không bịa** `ratio`, `resolution`, `mode`. Chỉ dùng giá trị có trong catalog và đã được người dùng chọn.
3. Báo số ảnh + model + cấu hình, **chờ người duyệt bằng chữ**, rồi mới gọi `gommo_image_create`.
4. Giữ `imageInfo.id_base`, theo dõi bằng `gommo_image_status`. Không dùng `task_id` nội bộ để poll.
5. Ghi `id_base` vào `anh.task_id_base[]` của file cluster.
