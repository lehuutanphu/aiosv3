---
name: lich-phong-van
description: Bước 5+6 quy trình tuyển dụng — tạo draft email hẹn phỏng vấn, lên lịch trên Google Calendar, gửi email mời ứng viên lên văn phòng, và theo dõi kết quả phỏng vấn trên Google Sheets. Trigger khi user nói "hẹn phỏng vấn", "lên lịch phỏng vấn", "email mời phỏng vấn", "lịch PV", "kết quả phỏng vấn", "cập nhật ứng viên", "follow ứng viên", "danh sách phỏng vấn". Dùng Gmail MCP tạo DRAFT (không tự gửi) và Google Calendar MCP tạo sự kiện.
---

# B5+B6 — Hẹn phỏng vấn & theo dõi kết quả

## Phần A — Hẹn lịch (B5)

### A1. Lấy khung giờ trống

1. Hỏi user: ai tham gia phỏng vấn, thời lượng mỗi buổi (mặc định 45 phút), khoảng ngày mong muốn.
2. Google Calendar MCP: `list_events` / `suggest_time` trên lịch của người phỏng vấn.
3. Đề xuất **3 khung giờ** cho mỗi ứng viên. Quy tắc:
   - Chừa **15 phút đệm** giữa 2 buổi liên tiếp.
   - Không xếp trước 9h00, sau 17h00, hoặc 12h00–13h30.
   - Không quá **4 buổi/ngày** cho cùng một người phỏng vấn.

### A2. Draft email hẹn phỏng vấn

Dùng `hr/templates/email-moi-phong-van.template.md`. Gmail MCP `create_draft` — **KHÔNG gửi**.

Bắt buộc có trong email: tên ứng viên, vị trí, **3 lựa chọn khung giờ**, hình thức (tại VP / online),
**địa chỉ đầy đủ + chỉ dẫn gửi xe + tầng/phòng**, tên người phỏng vấn, thời lượng, giấy tờ cần mang,
đầu mối liên hệ khi cần đổi lịch, hạn phản hồi.

Báo cáo lại: *"Đã tạo <n> draft trong Gmail. Xem lại rồi bấm Gửi."* Ghi `trang_thai: "cho_xac_nhan_lich"`.

### A3. Sau khi ứng viên xác nhận

1. Calendar MCP `create_event`: tiêu đề `PV — <Vị trí> — <UV-nn> <Tên>`, mời người phỏng vấn
   (**không** thêm email ứng viên vào cùng sự kiện nội bộ nếu có nhiều người khác trong đó).
2. Mô tả sự kiện: link CV, điểm số, **danh sách `diem_can_hoi[]` từ bước 4** — người phỏng vấn có sẵn câu hỏi.
3. Tạo draft email xác nhận lại cho ứng viên (kèm .ics nếu cần).
4. Ghi `lich_pv: { thoi_gian, hinh_thuc, nguoi_pv[], event_id }`, `trang_thai: "da_hen_pv"`.

### A4. Nhắc trước 1 ngày

Nhắc user tạo draft nhắc lịch cho ứng viên có buổi PV vào ngày mai. Tỷ lệ vắng mặt giảm rõ khi có nhắc.

---

## Phần B — Theo dõi kết quả (B6) — Google Sheets

### B1. Thiết lập một lần

Nếu chưa có sheet: hướng dẫn user tạo Google Sheet tên `Tuyen dung <Năm> — Pipeline`, dán schema từ
`hr/templates/pipeline-sheet-schema.md` (có sẵn Data Validation cho cột trạng thái + conditional format).
Ghi link sheet vào `sheet_pipeline_url` của requisition.

### B2. Đồng bộ

Chưa có MCP ghi trực tiếp Google Sheets. Quy trình 2 chiều:

- **Agent → Sheet:** xuất `hr/data/ho-so/REQ-YYYY-NNN/pipeline.csv` đúng thứ tự cột → user dán đè vùng dữ liệu.
- **Sheet → Agent:** user tải sheet về `.csv`/`.xlsx` hoặc dán bảng vào chat → agent cập nhật `ung_vien[]`.

Luôn nói rõ agent đang đọc dữ liệu **tại thời điểm nào**, tránh làm việc trên bản cũ.

### B3. Trạng thái ứng viên (giá trị hợp lệ duy nhất)

`moi` → `cho_xac_nhan_lich` → `da_hen_pv` → `da_phong_van` → `cho_offer` → `da_offer` → `nhan_viec`
Nhánh dừng: `tu_choi_loi_moi` · `khong_den_pv` · `loai` · `ung_vien_tu_choi_offer` · `du_phong`

### B4. Ghi nhận kết quả phỏng vấn — dùng FORM, không gõ tay qua chat

Gọi tool `open_interview_form` (kèm `ma_uv`/`ten` nếu đã biết) để mở form thật trên giao diện —
người phỏng vấn tự điền: điểm chuyên môn (1–5), điểm phù hợp văn hóa (1–5), điểm mạnh, điểm lo ngại,
**mức lương mong muốn ứng viên nêu**, thời gian có thể onboard, kết luận (Đồng ý / Cân nhắc / Từ chối).
Form tự ghi vào `ung_vien[]` và đồng bộ Excel khi user bấm Lưu — bạn **không cần** gọi `upsert_candidate`
cho các field này nữa, chỉ cần chủ động gọi tool mở form đúng lúc (ngay sau khi user báo đã phỏng vấn xong).

Form chỉ cho **chọn ứng viên đã có sẵn** (đã chấm CV ở B4) từ dropdown, không nhập tay và không tạo được
ứng viên mới. Nếu user muốn đánh giá phỏng vấn cho người chưa có trong `ung_vien[]`, phải thêm ứng viên đó
qua `upsert_candidate` trước (kể cả khi chưa qua vòng CV chính thức), rồi mới gọi `open_interview_form`.

Chỉ hỏi trực tiếp trong chat nếu user chủ động kể miệng kết quả thay vì điền form — khi đó mới dùng
`upsert_candidate` như trước.

🔴 **Lương mong muốn chỉ ghi lại đúng con số ứng viên nói.** Không suy diễn, không tự đề xuất mức trả.

### B5. Email từ chối

Chỉ tạo **draft** theo `hr/templates/email-tu-choi.template.md` — kế thừa rule sẵn có của `hr-1`:
"Không tự gửi email từ chối — phải có người duyệt." Giữ giọng văn tôn trọng, không nêu lý do chi tiết
mang tính đánh giá cá nhân.

## Kết thúc

Khi có ứng viên ở `cho_offer`: đặt `buoc_hien_tai = 7`, chốt câu:
*"UV-<nn> đã qua phỏng vấn. Bước kế tiếp: `/offer-va-luu-ho-so` — bước này cần bạn xác nhận điều khoản."*

Nếu user chọn kết luận **"Đồng ý"** trong form đánh giá phỏng vấn, việc này **tự động xảy ra** (form tự
chuyển `trang_thai: "cho_offer"` và `buoc_hien_tai = 7`) — bạn không cần tự làm lại, chỉ cần đọc đúng
trạng thái mới trong JSON và tiếp tục thẳng vào Cổng 1 (B7) khi user nhắn tiếp.
