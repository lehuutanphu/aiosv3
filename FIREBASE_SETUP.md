# Kho dữ liệu Firebase cho AI OS

Hướng dẫn dựng Firestore + Cloud Storage làm nơi lưu chính thức cho AI OS.

**Chưa làm gì cả thì hệ thống vẫn chạy bình thường** — mọi thứ lưu xuống đĩa máy đang chạy
proxy. Bật Firebase là để dữ liệu không phụ thuộc vào một máy duy nhất.

---

## 1. Vì sao có tài liệu này

Trước đây dữ liệu nằm rải ba nơi, và một nơi trong đó không tồn tại:

| Nơi | Chứa gì | Vấn đề |
|---|---|---|
| `localStorage` trình duyệt | Dự án, phiếu, công việc, báo cáo, kho lead, tri thức KWSR | Xoá cache là mất trắng — **đã xảy ra một lần**, mất 11 bài viết của vòng cluster đầu |
| Đĩa máy local | `hr/data/`, `sales/data/` | Chỉ nằm trên một máy, không có bản sao |
| *(không đâu cả)* | **Bài viết Content Cluster** | Engine chạy trong trình duyệt, không ghi được đĩa |

Giờ cả ba gom về `server/db.js`, ghi song song **đĩa local + Firestore**.

---

## 2. Kiến trúc

```
Trình duyệt  ──►  Backend Proxy (localhost:8787)  ──►  Firestore  (dữ liệu)
(dashboard)       Firebase Admin SDK                └►  Cloud Storage (ảnh, CV, file)
                          │
                          └────────────────────────►  Đĩa local (bản sao)
```

**Trình duyệt KHÔNG nói chuyện trực tiếp với Firebase.** Đây là chủ ý: dashboard AI OS
không có màn đăng nhập, nên nếu gọi Firebase thẳng từ client thì security rules buộc phải
mở cho khách vãng lai — ai biết `projectId` cũng đọc được hồ sơ ứng viên và kho lead.

Đi qua proxy thì:
- Service account key nằm trong `.env` trên máy người vận hành, không lộ ra frontend
- `firestore.rules` và `storage.rules` khoá `if false` toàn bộ — Admin SDK đi vòng qua
  rules nên khoá chặt không ảnh hưởng gì tới ứng dụng, chỉ chặn mọi đường vào trực tiếp

**Đánh đổi:** phải bật proxy mới đồng bộ được. Không bật thì dashboard vẫn chạy, chỉ là
dữ liệu nằm trong localStorage như cũ — huy hiệu góc trên bên phải sẽ báo ⚠ đỏ.

---

## 3. Các bước cần bạn tự làm

Ba bước đầu **phải làm bằng tay** — tạo project và lấy key là thao tác cần đăng nhập tài
khoản Google của bạn.

### Bước 1 — Tạo project

1. Vào <https://console.firebase.google.com> → **Add project**
2. Đặt tên (vd `aios-workspace`) → ghi lại **Project ID** hệ thống sinh ra
3. Google Analytics: chọn **Disable** (không cần cho mục đích lưu trữ)

### Bước 2 — Bật Firestore

1. Menu trái → **Build ▸ Firestore Database** → **Create database**
2. Chọn **Production mode** (khoá sẵn — đúng thứ ta muốn)
3. Location: chọn khu vực gần Việt Nam, vd `asia-southeast1` (Singapore).
   **Chọn xong không đổi được**, cân nhắc kỹ.

### Bước 3 — Lấy service account key

1. ⚙️ **Project settings** → tab **Service accounts**
2. **Generate new private key** → tải file JSON về
3. Đổi tên thành `serviceAccount.json`, đặt vào thư mục **`server/`**

> **File này là chìa khoá toàn quyền.** Ai cầm được là đọc/ghi/xoá được cả project, và
> security rules không chặn nổi vì Admin SDK đi vòng qua rules. `.gitignore` đã chặn sẵn.
> Nếu lỡ đẩy lên GitHub thì phải vào Console thu hồi key ngay, đổi rules là không đủ.

### Bước 4 — Cloud Storage *(tuỳ chọn, chỉ cần nếu lưu ảnh)*

1. Menu trái → **Build ▸ Storage** → **Get started**
2. Ghi lại tên bucket, dạng `<project-id>.firebasestorage.app`

> **Lưu ý về chi phí:** Cloud Storage cho project tạo mới hiện yêu cầu bật gói **Blaze**
> (trả theo mức dùng) — vẫn có hạn mức miễn phí nhưng phải gắn thẻ thanh toán. Firestore
> thì gói Spark miễn phí là đủ. Kiểm tra lại trong Console vì chính sách của Google có
> thể đã đổi. **Bỏ qua bước này cũng được** — Firestore vẫn chạy, ảnh lưu xuống đĩa.

### Bước 5 — Điền `server/.env`

```
FIREBASE_ENABLED=true
FIREBASE_SERVICE_ACCOUNT=./serviceAccount.json
FIREBASE_PROJECT_ID=aios-workspace-xxxxx
FIREBASE_STORAGE_BUCKET=aios-workspace-xxxxx.firebasestorage.app
```

Khởi động lại proxy, rồi kiểm tra:

```bash
curl http://localhost:8787/api/db/status
```

`"enabled": true` là xong. `false` thì trường `lyDo` nói rõ vướng ở đâu.

### Bước 6 — Nạp security rules *(khuyến nghị)*

```bash
npx firebase-tools deploy --only firestore:rules,storage:rules
```

Không chạy lệnh này thì rules mặc định của Firestore ở Production mode cũng đã khoá client
rồi, nhưng nạp file trong repo lên giúp cấu hình khớp với thứ đang được version-control.

---

## 4. Dữ liệu nằm ở đâu

### Firestore

| Collection | Nội dung | Nguồn |
|---|---|---|
| `staff`, `customers` | Nhân sự, khách hàng | Dashboard |
| `projects`, `tickets`, `tasks` | Dự án, phiếu yêu cầu, công việc + báo cáo | Dashboard |
| `work_leads` | Lead hiển thị trong màn Kho Lead | Dashboard |
| `clusters/{CLS}/articles/{mã}` | **Bài viết Content Cluster** | Vòng lặp 4 Agent |
| `media` | Metadata ảnh, trỏ tới đường dẫn Storage | Upload ảnh |
| `agents`, `aios_meta/kwsr` | Roster Agent + Knowledge/Workflow/Skill/Rule | Màn Agent |
| `leads`, `hr_requisitions` | **Chỉ khi `SYNC_PII=true`** | sales.js, hr.js |

### Cloud Storage

```
clusters/{CLS}/images/*     ảnh minh hoạ bài viết
hr/{REQ}/*                  CV, offer letter  (chỉ khi SYNC_PII=true)
```

### Bản sao trên đĩa (luôn có, kể cả khi tắt Firebase)

```
data/work.json                          trạng thái làm việc
data/agents.json                        roster + KWSR
marketing/data/bai-viet/{CLS}/*.md      bài viết, kèm frontmatter SEO
marketing/data/clusters/{CLS}.json      sổ theo dõi từng cluster
```

---

## 5. Dữ liệu cá nhân — đọc trước khi bật `SYNC_PII`

Kho lead chứa **số điện thoại và email của người ngoài công ty**. Hồ sơ tuyển dụng chứa
**CV, mức lương, thông tin ứng viên**. Đưa hai nhóm này lên Firebase là chuyển dữ liệu cá
nhân sang hạ tầng đặt ngoài Việt Nam, thuộc phạm vi điều chỉnh của **Nghị định 13/2023/NĐ-CP**
về bảo vệ dữ liệu cá nhân.

Vì vậy mặc định `SYNC_PII=false`: hai nhóm này **chỉ ghi xuống đĩa local**, không lên cloud.
Phần công việc / bài viết / roster Agent thì đồng bộ bình thường.

Chỉ bật `SYNC_PII=true` sau khi đã rà soát cơ sở pháp lý cho việc chuyển dữ liệu ra nước
ngoài và nghĩa vụ thông báo/lấy đồng ý của chủ thể dữ liệu. Đây là quyết định pháp lý,
không phải quyết định kỹ thuật.

---

## 6. Hạn mức và chi phí

Gói **Spark** (miễn phí, không cần thẻ) mỗi ngày cho:
- Firestore: 50.000 lượt đọc · 20.000 lượt ghi · 1 GB lưu trữ

Tầng lưu trữ được viết để bám sát hạn mức này:

- **Chỉ ghi bản ghi thực sự đổi.** Ghi đè cả ~300 document mỗi lần lưu thì 20.000 lượt ghi
  cháy sau khoảng 60 thao tác. So sánh theo chuỗi JSON đưa con số đó về 1–3 document mỗi lần.
- **Hoãn nhịp 1,5 giây.** Một thao tác kéo-thả gọi `save()` nhiều lần liên tiếp; gom lại
  thành một lượt đẩy.
- **Đọc một lần lúc mở trang**, không hỏi lại máy chủ theo chu kỳ.

Một vòng Content Cluster 11 bài tốn khoảng 250–300 lượt ghi (24 công việc + báo cáo + 22
lượt lưu bài). Chạy vài vòng một ngày vẫn nằm trong hạn mức miễn phí.

---

## 7. Khi hỏng thì sao

Huy hiệu ở góc phải màn hình Điều hành công việc báo trạng thái:

| Huy hiệu | Nghĩa |
|---|---|
| ☁ **Đã đồng bộ Firebase** | Dữ liệu đã lên cloud |
| 💾 **Đã lưu vào đĩa máy này** | Proxy chạy nhưng Firebase tắt/lỗi — vẫn có file trên đĩa |
| ⚠ **Chỉ lưu trong trình duyệt** | Proxy không chạy. Dữ liệu **sẽ mất nếu xoá cache** |

Nguyên tắc trong `db.js`: **lỗi cloud không bao giờ được ném ra ngoài làm hỏng luồng làm
việc.** Đĩa local luôn ghi trước; Firestore hỏng thì hàm vẫn trả về thành công kèm cờ
`firestore.ok = false` và lý do cụ thể. Rê chuột lên huy hiệu để xem lý do.

Vòng lặp Content Cluster ghi **từng bài ngay khi viết xong**, không đợi hết vòng — chạy dở
25 phút mà đứt thì phần đã viết vẫn còn nguyên trên đĩa.
