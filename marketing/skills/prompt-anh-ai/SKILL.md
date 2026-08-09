---
name: prompt-anh-ai
description: Stage 3.4 pipeline Content Cluster — sinh bộ AI Image Prompt tiếng Anh cho mọi thẻ IMAGE_PLACEHOLDER trong một bài viết, và tùy chọn sinh ảnh thật qua genful.ai MCP. Trigger khi user nói "tạo prompt ảnh", "prompt hình ảnh", "AI image prompt", "sinh ảnh cho bài", "vẽ ảnh minh họa", hoặc ngay sau khi skill viet-bai-chuan-seo viết xong một bài. Prompt luôn miễn phí; sinh ảnh thật TỐN CREDIT nên phải xin duyệt bằng chữ trước.
---

# S3.4 — AI Image Prompt

Chuẩn chi tiết: `marketing/templates/image-prompt-schema.md`. Skill này thực thi theo đúng chuẩn đó.

## Bước 1 — Quét placeholder

1. Đọc file bài viết vừa hoàn thành.
2. Trích **mọi** `[IMAGE_PLACEHOLDER_X: <bối cảnh>]` kèm đoạn văn bao quanh (200 từ trước/sau).
3. Số prompt sinh ra phải **bằng đúng** số placeholder. Thiếu một cái là bài chưa xong.

## Bước 2 — Dựng prompt

Mỗi prompt đủ 5 thành phần: **Subject · Scene · Lighting · Camera angle · Aspect ratio**.

- Viết bằng **tiếng Anh**, kể cả khi bài tiếng Việt. Tên riêng địa danh giữ nguyên, không dịch.
- Chọn đúng một style theo bảng trong schema (`photorealistic` là mặc định).
- Ratio theo vị trí: hero `--ar 16:9`, ảnh giữa bài `--ar 16:9` hoặc `4:3`, ảnh dọc `--ar 2:3`.
- Prompt phải **bám bối cảnh của placeholder tương ứng** — không mô tả cảnh mà bài không nhắc tới.
- Viết `alt_text_vi` bằng tiếng Việt, mô tả đúng nội dung ảnh, chèn từ khóa phụ nếu tự nhiên.
  Đây là phần lên Google Image Search, **không được bỏ trống**.

Cấm: tên thương hiệu đã đăng ký nhãn hiệu, gương mặt người thật nhận diện được, yêu cầu chữ trong ảnh.

## Bước 3 — Ghi kết quả

1. Điền bảng **AI Image Prompts** ở cuối file bài viết.
2. Append vào `marketing/data/bai-viet/CLS-YYYY-NNN/image-prompts.json` theo định dạng JSON trong schema.
3. Cập nhật file cluster: `so_prompt_anh`, `trang_thai = "hoan_tat"` cho bài đó, append `nhat_ky[]`.

## Bước 4 (tùy chọn) — Sinh ảnh thật qua genful.ai MCP

Mặc định `anh.che_do = "chi_tao_prompt"` → **dừng ở bước 3**, không gọi MCP.

Chỉ chạy tiếp khi user yêu cầu rõ. Khi đó theo đúng thứ tự:

1. **`gommo_credit_balance`** — báo số dư hiện có.
2. **`gommo_models_list`** — lấy catalog. **Cấm bịa** `ratio`, `resolution`, `mode`; chỉ dùng enum
   có thật trong catalog.
3. Nếu một tham số có nhiều lựa chọn → **hỏi user chọn**, không tự quyết. Chỉ khi catalog có đúng một
   lựa chọn mới được tự điền.
4. 🔴 **Cổng credit** — in bảng: số ảnh, model, cấu hình, credit ước tính. **Chờ user đồng ý bằng chữ.**
   Không có câu đồng ý rõ ràng thì không gọi `gommo_image_create`. Ghi `anh.credit_da_duyet = true`
   kèm thời điểm vào `nhat_ky[]`.
5. `gommo_image_create` → giữ `imageInfo.id_base`, ghi vào `anh.task_id_base[]`.
6. Theo dõi bằng `gommo_image_status` với `id_base`. **Không** dùng `task_id` nội bộ để poll.
7. Cấu hình bị từ chối → dừng, hỏi lại. **Không đoán** tham số thay thế.

## Output

```
🖼️  <ma_bai> — <n> prompt ảnh
    IMAGE_PLACEHOLDER_1  hero      photorealistic  --ar 16:9
    IMAGE_PLACEHOLDER_2  giữa bài  photorealistic  --ar 16:9
    Ảnh thật: chưa sinh (chế độ chỉ tạo prompt)
```

Câu chốt: *"<ma_bai> hoàn tất. Chuyển sang bài kế tiếp."* — rồi quay lại `viet-bai-chuan-seo`
cho bài sau. Chỉ khi **mọi** bài `hoan_tat` mới gọi `dong-goi-cluster`.
