# Module Tuyển dụng — HR Agent (`hr-1`)

Hệ agent phục vụ toàn bộ quy trình tuyển dụng của công ty, gắn vào `hr-1 (HR Agent)` trong AI OS Dashboard.

## 1. Kiến trúc

```
hr-1 (HR Agent) — chủ pipeline, giữ trạng thái
 └─ /tuyen-dung ................ skill ĐIỀU PHỐI: đọc requisition, báo bước kế tiếp, gọi skill con
     ├─ /nhu-cau-tuyen-dung .... B1  Xác định nhu cầu → tạo requisition
     ├─ /jd-va-tin-tuyen-dung .. B2+B3  JD, bài đăng, brief ảnh, sổ link kênh
     ├─ /thu-nhan-sang-loc-cv .. B4  Gom CV, chấm điểm  → subagent `cham-diem-cv`
     ├─ /lich-phong-van ........ B5+B6  Email hẹn, lịch PV, cập nhật pipeline
     └─ /offer-va-luu-ho-so .... B7–B10  Chốt điều khoản → trình duyệt → gửi → lưu hồ sơ
```

**Nguyên tắc:** mọi skill đọc/ghi **cùng một file trạng thái** `data/requisitions/REQ-YYYY-NNN.json`.
Đóng phiên chat rồi mở lại tuần sau vẫn chạy tiếp đúng chỗ đang dở — đây là lý do dùng skill + file
trạng thái thay vì subagent cho các bước tuần tự.

**Subagent chỉ dùng 1 chỗ:** `agents/cham-diem-cv.md` — chấm điểm CV hàng loạt, mỗi CV một context
riêng, chạy song song. Chỉ kích hoạt khi có **> 15 CV** trong một đợt.

## 2. Pipeline 10 bước & mức tự động

| Bước | Việc | Skill | Mức tự động |
|---|---|---|---|
| 1 | Xác định nhu cầu: vị trí, số lượng, ngày onboard | `nhu-cau-tuyen-dung` | ✅ Tự động |
| 2 | Cập nhật JD & yêu cầu cốt lõi | `jd-va-tin-tuyen-dung` | ✅ Tự động, người duyệt nội dung |
| 3 | Bài đăng + hình ảnh, đăng đa kênh, lưu link | `jd-va-tin-tuyen-dung` | ⚠️ Nửa — xem §3 |
| 4 | Nhận CV: Email, inbox FB, Zalo OA | `thu-nhan-sang-loc-cv` | ⚠️ Nửa — Gmail tự động |
| 5 | Email hẹn PV + lên lịch + email mời lên VP | `lich-phong-van` | ✅ Tự động ở mức **draft** |
| 6 | Follow list ứng viên, cập nhật kết quả | `lich-phong-van` | ✅ Google Sheets |
| 7 | Chốt ngày onboard / thử việc / lương | `offer-va-luu-ho-so` | 🔴 **CỔNG NGƯỜI** |
| 8 | Trình duyệt offer letter | `offer-va-luu-ho-so` | 🔴 **CỔNG NGƯỜI** |
| 9 | Gửi offer letter cho ứng viên | `offer-va-luu-ho-so` | 🔴 **CỔNG NGƯỜI** |
| 10 | Lưu hồ sơ ứng viên lên OneDrive/Google Drive | `offer-va-luu-ho-so` | ⚠️ Nửa — qua thư mục sync |

## 3. Giới hạn công cụ hiện tại (cập nhật 29/07/2026)

| Cần | Trạng thái | Cách xử lý |
|---|---|---|
| Gmail | ✅ Đã kết nối | Đọc CV, tạo draft email. **Không auto-send** |
| Google Calendar | ✅ Đã kết nối | Tạo lịch PV, gửi lời mời |
| Đăng bài FB Group / Zalo | ❌ Không có MCP | Chrome MCP bán tự động, hoặc đăng tay rồi dán link vào requisition |
| Inbox FB / Zalo OA | ❌ Không có MCP | **Cấu hình chuyển tiếp về email tuyển dụng** → gom hết về Gmail |
| Tạo hình ảnh | ❌ Không có MCP | Skill xuất **brief ảnh** + text overlay, người dựng trên Canva |
| Google Drive / OneDrive | ❌ Không có connector | Lưu vào `data/ho-so/` rồi để app desktop tự sync |
| Google Sheets ghi trực tiếp | ❌ Chưa có | Skill xuất `.csv` đúng schema → người dán vào Sheet (xem `templates/pipeline-sheet-schema.md`) |

## 4. Ba cổng duyệt bắt buộc (Human-in-the-Loop)

Agent **dừng lại và chờ xác nhận rõ ràng bằng chữ**, không suy đoán, không mặc định:

1. **Cổng lương (B7)** — mọi con số lương, thưởng, phụ cấp, ngày onboard, thời gian thử việc phải do
   người nhập hoặc xác nhận lại từng dòng. Agent không được lấy số từ thang lương tham chiếu để điền thẳng.
2. **Cổng duyệt offer (B8)** — offer letter phải được người có thẩm quyền duyệt; ghi log ai duyệt, lúc nào
   vào `nhat_ky[]` của requisition.
3. **Cổng gửi (B9)** — agent chỉ tạo **draft Gmail**. Người bấm Gửi. Không có ngoại lệ.

Ngoài ra: **email từ chối ứng viên** cũng chỉ tạo draft (kế thừa rule sẵn có của `hr-1`).

## 5. Bảo mật hồ sơ ứng viên

- `data/ho-so/` và `data/requisitions/` chứa PII → đã đưa vào `.gitignore`, **không commit**.
- Báo cáo tổng hợp gửi ra ngoài phải ẩn PII (tên → mã ứng viên `UV-01`, che SĐT/email).
- Không đưa lương của ứng viên này vào ngữ cảnh khi trao đổi về ứng viên khác.

## 6. Cấu trúc thư mục

```
hr/
├── README.md                    ← file này
├── skills/
│   ├── tuyen-dung/SKILL.md
│   ├── nhu-cau-tuyen-dung/SKILL.md
│   ├── jd-va-tin-tuyen-dung/SKILL.md
│   ├── thu-nhan-sang-loc-cv/SKILL.md
│   ├── lich-phong-van/SKILL.md
│   └── offer-va-luu-ho-so/SKILL.md
├── agents/
│   └── cham-diem-cv.md          ← subagent chấm CV song song
├── templates/
│   ├── requisition.template.json
│   ├── jd.template.md
│   ├── tin-tuyen-dung.template.md
│   ├── email-moi-phong-van.template.md
│   ├── email-tu-choi.template.md
│   ├── offer-field-map.md       ← map field vào MẪU OFFER CÔNG TY
│   └── pipeline-sheet-schema.md ← schema Google Sheets bước 6
└── data/
    ├── requisitions/            ← trạng thái từng đợt tuyển (gitignored)
    ├── ho-so/                   ← CV + hồ sơ ứng viên (gitignored)
    └── mau-cong-ty/             ← nơi đặt mẫu offer letter thật của công ty
```

## 7. Cách kích hoạt skill

Các skill trong `hr/skills/` là **mã nguồn**, Cowork chưa tự nhận. Chọn 1 cách:

- **Cách A (khuyến nghị):** yêu cầu Claude `save_skill` từng skill để đăng ký vào Cowork → gõ `/tuyen-dung` dùng ngay.
- **Cách B:** copy thư mục con của `hr/skills/` vào thư mục skills của Cowork.
- **Cách C (Hermes):** đưa vào `~/.hermes_hr-1/skills/` — `hr-1` chạy ở port `8646` theo `server/agents.config.json`.
