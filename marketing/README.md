# Module Content Cluster — Content Agent (`mkt-1`)

Hệ agent sản xuất trọn bộ bài viết Topic Cluster chuẩn SEO (01 bài Trụ cột + N bài Vệ tinh) từ một
link hoặc chủ đề gốc. Gắn vào `mkt-1 (Content Agent)` trong AI OS Dashboard — port `8644` theo
`server/agents.config.json`.

## 1. Kiến trúc

```
mkt-1 (Content Agent) — chủ pipeline, giữ trạng thái
 └─ /content-cluster ............... skill ĐIỀU PHỐI: đọc file cluster, xác định stage, gọi skill con,
     │                               và LẶP tới khi mọi bài viết hoàn tất
     ├─ /nghien-cuu-chu-de ......... S1  Đọc nguồn → bóc tách N thực thể con → tạo file cluster
     ├─ /kien-truc-seo-cluster ..... S2  Phân tầng từ khóa + ma trận liên kết + chặn ăn thịt từ khóa
     ├─ /viet-bai-chuan-seo ........ S3  Nghiên cứu sâu → dàn ý → viết bài đầy đủ   ⟲ lặp từng bài
     ├─ /prompt-anh-ai ............. S3.4 Sinh AI Image Prompt (+ tùy chọn sinh ảnh) ⟲ lặp từng bài
     └─ /dong-goi-cluster .......... S4  Quét liên kết hai chiều → đóng gói bàn giao
```

**Nguyên tắc:** mọi skill đọc/ghi **cùng một file trạng thái** `data/clusters/CLS-YYYY-NNN.json`.
Một cluster 20 bài dở dang có thể đóng phiên chat rồi mở lại hôm sau chạy tiếp đúng bài đang dở —
đây là lý do dùng skill + file trạng thái thay vì subagent cho vòng lặp tuần tự.

**Subagent dùng 2 chỗ:**

| Subagent | Khi nào | Vì sao |
|---|---|---|
| `agents/nghien-cuu-chu-de-con.md` | Bất kỳ khi nào cần tra nhiều thực thể | Nghiên cứu không sinh văn phong cần nhất quán → song song được vô hại |
| `agents/viet-bai-cluster.md` | Chỉ khi **N > 6 bài** | Mỗi bài một context sạch. Đổi lại phải truyền tóm tắt các bài đã viết, nếu không các bài sẽ lặp ý nhau |

## 2. Pipeline 4 stage & mức tự động

| Stage | Việc | Skill | Mức tự động |
|---|---|---|---|
| 1 | Đọc nguồn, bóc tách N chủ đề con, sàng lọc | `nghien-cuu-chu-de` | ✅ Tự động |
| 2 | Sơ đồ từ khóa Pillar/Cluster + ma trận liên kết | `kien-truc-seo-cluster` | ✅ Tự động, 🔴 dừng nếu phát hiện chồng lấn |
| 3 | **Vòng lặp**: nghiên cứu → dàn ý → viết bài → prompt ảnh | `viet-bai-chuan-seo` + `prompt-anh-ai` | ✅ Tự động, lặp tới hết |
| 3.4b | Sinh **ảnh thật** từ prompt | `prompt-anh-ai` | 🔴 **CỔNG NGƯỜI** — tốn credit |
| 4 | Quét liên kết hai chiều, đóng gói | `dong-goi-cluster` | ✅ Tự động |
| — | Đăng bài lên website, gắn schema | — | ❌ Chưa có connector — xem §3 |

## 3. Giới hạn công cụ hiện tại (cập nhật 09/08/2026)

| Cần | Trạng thái | Cách xử lý |
|---|---|---|
| Đọc web / nghiên cứu | ✅ WebSearch + WebFetch | Đọc nguồn, quét SERP, lấy People Also Ask |
| Sinh ảnh AI | ✅ genful.ai MCP đã kết nối | `gommo_image_create` — **tốn credit**, có cổng duyệt |
| Số liệu volume từ khóa | ❌ Chưa nối Ahrefs / SEMrush / Keyword Planner | **Cấm bịa số.** Chỉ ước lượng định tính kèm căn cứ SERP, hoặc dùng số user dán vào |
| Đăng bài lên CMS | ❌ Không có MCP WordPress/Webflow | Xuất Markdown trong `data/bai-viet/`, người đăng tay |
| Google Search Console | ❌ Chưa có connector | Người tự khai báo sitemap sau khi đăng |
| Đăng social FB / Zalo | ❌ Không có MCP | Bàn giao cho `mkt-2 (Social Agent)`, đăng tay |
| Kiểm tra đạo văn | ❌ Chưa có | Rào chắn hiện tại là quy tắc cấm lặp câu chữ giữa các bài trong cùng cluster |

## 4. Ba rào chắn chất lượng

Đây là những chỗ pipeline dễ hỏng nhất, đã được cứng hóa thành luật trong skill:

1. **Chặn ăn thịt từ khóa (S2)** — không được sang Stage 3 khi hai bài còn chồng lấn `tu_khoa_chinh`.
   Phát hiện sau khi đã viết 15 bài thì phải viết lại, không chỉ sửa từ khóa.
2. **Vòng lặp phải chạy hết (S3)** — cấm dừng ở kế hoạch rồi hỏi "có viết tiếp không", cấm trả bản
   tóm tắt thay cho bài đầy đủ. Ngoại lệ duy nhất là hết giới hạn phiên, và khi đó phải ghi file
   trạng thái trước rồi báo rõ còn bài nào.
3. **Cổng credit sinh ảnh (S3.4)** — prompt luôn miễn phí và là sản phẩm mặc định. Sinh ảnh thật chỉ
   chạy khi có câu đồng ý rõ ràng bằng chữ, sau khi đã gọi `gommo_models_list` và báo credit ước tính.

## 5. Quy tắc trung thực nội dung

- Số liệu có hạn sử dụng (giá, giờ mở cửa, lịch tàu) **phải** kèm nguồn + ngày kiểm chứng trong
  `nguon_tham_khao`. Tra không ra thì dẫn về nguồn chính chủ, **không** tự nghĩ ra con số.
- Không viết trải nghiệm cá nhân giả. Không dùng so sánh nhất khi không có nguồn xếp hạng.
- Không đưa tên thương hiệu đã đăng ký nhãn hiệu hay gương mặt người thật vào prompt ảnh.
- Nguồn mâu thuẫn → nêu cả hai kèm nguồn, không tự chọn bên nào.

## 6. Cấu trúc thư mục

```
marketing/
├── README.md                        ← file này
├── skills/
│   ├── content-cluster/SKILL.md         ← điều phối + luật vòng lặp
│   ├── nghien-cuu-chu-de/SKILL.md
│   ├── kien-truc-seo-cluster/SKILL.md
│   ├── viet-bai-chuan-seo/SKILL.md
│   ├── prompt-anh-ai/SKILL.md
│   └── dong-goi-cluster/SKILL.md
├── agents/
│   ├── nghien-cuu-chu-de-con.md     ← subagent nghiên cứu song song
│   └── viet-bai-cluster.md          ← subagent viết bài, dùng khi N > 6
├── templates/
│   ├── cluster.template.json        ← file trạng thái
│   ├── bai-viet.template.md         ← khung bài viết + frontmatter SEO
│   ├── seo-blueprint-schema.md      ← chuẩn phân tầng từ khóa + ma trận liên kết
│   └── image-prompt-schema.md       ← chuẩn prompt ảnh 5 thành phần
└── data/
    ├── README.md
    ├── clusters/                    ← trạng thái từng cluster (được commit)
    └── bai-viet/CLS-YYYY-NNN/       ← bài viết + prompt + gói bàn giao
```

## 7. Cách chạy

```
/content-cluster
```

Lần đầu: đưa kèm link hoặc chủ đề gốc. Các lần sau gõ trơn — skill tự đọc `data/clusters/` và
chạy tiếp đúng bài đang dở.

## 8. Cách kích hoạt skill

Các skill trong `marketing/skills/` là **mã nguồn**, Cowork chưa tự nhận. Chọn 1 cách:

- **Cách A (khuyến nghị):** yêu cầu Claude `save_skill` từng skill để đăng ký vào Cowork → gõ
  `/content-cluster` dùng ngay.
- **Cách B:** copy thư mục con của `marketing/skills/` vào thư mục skills của Cowork.
- **Cách C (Hermes):** đưa vào `~/.hermes_mkt-1/skills/` — `mkt-1` chạy ở port `8644` theo
  `server/agents.config.json`.
