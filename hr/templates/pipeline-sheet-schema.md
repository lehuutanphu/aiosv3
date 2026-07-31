# Google Sheets — Pipeline ứng viên (thay Excel)

Tên file đề xuất: **`Tuyen dung 2026 — Pipeline`**

**Sheet mẫu (master template) đã upload:**
https://docs.google.com/spreadsheets/d/1uwK0rwXAbcQUt7zKVzhheLgL9wr9yJnf/edit?usp=drive_link

> File gốc dựng từ `Tuyen-dung-2026-Pipeline.xlsx` (cùng thư mục `hr/templates/`) — đủ 3 sheet
> (`Pipeline`, `Kenh_dang`, `Tong_quan`), data validation và định dạng có điều kiện đã thiết lập sẵn.
> **Đây là bản mẫu dùng chung, không dùng trực tiếp để nhập liệu.** Khi mở một requisition mới:
> Tệp → Tạo bản sao → đổi tên theo `REQ-ID`, rồi dán link bản sao vào `sheet_pipeline_url` của
> requisition đó (skill `nhu-cau-tuyen-dung` hoặc `lich-phong-van` sẽ hỏi link này ở bước B1/B6).

---

## Sheet 1: `Pipeline` — cột theo đúng thứ tự này

Agent xuất `.csv` đúng thứ tự dưới đây để bạn dán đè. Sai thứ tự là lệch dữ liệu.

| # | Cột | Kiểu | Ghi chú |
|---|---|---|---|
| A | `Ma_UV` | Text | `UV-01` — khóa duy nhất, không đổi |
| B | `REQ_ID` | Text | `REQ-2026-001` |
| C | `Ho_ten` | Text | |
| D | `Email` | Text | |
| E | `SDT` | Text | Định dạng ô là **Text**, nếu không Sheets sẽ ăn mất số 0 đầu |
| F | `Vi_tri` | Text | |
| G | `Nguon` | Danh sách | `gmail` / `facebook_inbox` / `zalo` / `gioi_thieu` / `website` |
| H | `Ngay_nop` | Date | `YYYY-MM-DD` |
| I | `Diem_CV` | Number | 0–100 |
| J | `Xep_loai` | Danh sách | `A` / `B` / `C` |
| K | `Trang_thai` | Danh sách | xem §2 |
| L | `Ngay_PV` | Date | |
| M | `Gio_PV` | Time | |
| N | `Nguoi_PV` | Text | |
| O | `Diem_chuyen_mon` | Number | 1–5 |
| P | `Diem_van_hoa` | Number | 1–5 |
| Q | `Ket_luan_PV` | Danh sách | `Dong_y` / `Can_nhac` / `Tu_choi` |
| R | `Luong_mong_muon` | Number | 🔴 chỉ ghi con số ứng viên nói |
| S | `Co_the_onboard_tu` | Date | |
| T | `Ngay_gui_offer` | Date | |
| U | `Ket_qua_offer` | Danh sách | `Cho_phan_hoi` / `Nhan` / `Tu_choi` |
| V | `Ngay_onboard_thuc_te` | Date | |
| W | `Ghi_chu` | Text | |
| X | `Cap_nhat_luc` | Datetime | Agent ghi mốc thời gian đồng bộ gần nhất |
| Y | `File_CV` | Text | Tên file PDF gốc trong `hr/data/ho-so/<REQ-ID>/cv/` |
| Z | `Diem_bat_buoc` | Number | 0–50 — breakdown rubric B1, hạng mục tiêu chí bắt buộc |
| AA | `Diem_nen_co` | Number | 0–25 — breakdown rubric B1, hạng mục tiêu chí nên có |
| AB | `Diem_kinh_nghiem` | Number | 0–15 — breakdown rubric B1, kinh nghiệm liên quan |
| AC | `Diem_on_dinh` | Number | 0–10 — breakdown rubric B1, tín hiệu ổn định |
| AD | `Diem_manh` | Text | Gộp các điểm mạnh, phân cách `; ` |
| AE | `Diem_can_hoi` | Text | Gộp các điểm cần hỏi ở vòng PV, phân cách `; ` |

Cột Z–AC cộng lại đúng bằng cột I (`Diem_CV`) nếu agent chấm đủ 4 hạng mục — dùng để soát nhanh
khi thấy điểm tổng có vẻ bất thường mà không cần mở lại CV gốc.

---

## 2. Data Validation cho cột K (`Trang_thai`)

Dán danh sách này vào Dữ liệu → Xác thực dữ liệu → Danh sách các mục:

```
moi, cho_xac_nhan_lich, da_hen_pv, da_phong_van, cho_offer, da_offer, nhan_viec, du_phong, tu_choi_loi_moi, khong_den_pv, loai, ung_vien_tu_choi_offer
```

Bật **"Từ chối dữ liệu đầu vào"** — nếu không, gõ tay sai chính tả một lần là agent đọc lại không khớp.

## 3. Định dạng có điều kiện (dễ nhìn)

| Điều kiện (công thức tùy chỉnh trên A2:X) | Màu |
|---|---|
| `=$K2="nhan_viec"` | Nền xanh lá nhạt |
| `=$K2="loai"` hoặc `="ung_vien_tu_choi_offer"` | Nền xám, chữ nhạt |
| `=$K2="da_offer"` | Nền vàng |
| `=AND($K2="da_phong_van", TODAY()-$L2>5)` | Nền đỏ nhạt — **quá 5 ngày chưa có kết quả** |
| `=$J2="A"` (chỉ cột J) | Chữ đậm |

## 4. Sheet 2: `Kenh_dang` — sổ link bài đăng

| Kenh | Loai | Link | Ngay_dang | Nguoi_dang | Check_lan_cuoi | So_comment | So_inbox | Trang_thai |
|---|---|---|---|---|---|---|---|---|

Định dạng có điều kiện: `=TODAY()-$F2>3` → nền cam (quá 3 ngày chưa check comment/inbox).

## 5. Sheet 3: `Tong_quan` — công thức đếm

```
Tổng CV        =COUNTA(Pipeline!A2:A)
Loại A         =COUNTIF(Pipeline!J2:J,"A")
Đã hẹn PV      =COUNTIF(Pipeline!K2:K,"da_hen_pv")
Đã PV          =COUNTIF(Pipeline!K2:K,"da_phong_van")
Đã gửi offer   =COUNTIF(Pipeline!K2:K,"da_offer")
Nhận việc      =COUNTIF(Pipeline!K2:K,"nhan_viec")
Tỷ lệ CV→PV    =COUNTIF(Pipeline!K2:K,"da_phong_van")/COUNTA(Pipeline!A2:A)
Tỷ lệ PV→offer =COUNTIF(Pipeline!K2:K,"da_offer")/COUNTIF(Pipeline!K2:K,"da_phong_van")
Nguồn tốt nhất =QUERY(Pipeline!G2:K, "select G, count(K) where K='nhan_viec' group by G order by count(K) desc", 0)
```

---

## 6. Quy trình đồng bộ

**Đã tự động (Agent → file thật, không qua Google Sheets):** mỗi khi agent chấm/cập nhật 1 ứng
viên (`upsert_candidate`), server tự ghi thẳng vào đúng dòng của `Ma_UV` (khóa ghép với `REQ_ID`)
trong **`hr/templates/Tuyen-dung-2026-Pipeline.xlsx`** trên máy chạy server — không cần copy/dán
tay, không qua Google Sheets. File này dùng chung cho mọi REQ, mở trực tiếp bằng Excel để xem.
Nếu bạn vẫn muốn đưa lên Google Sheets, tự mở file `.xlsx` → Tệp → Nhập → chọn sheet để đồng bộ
thủ công (chưa có kết nối tự động 2 chiều với Google Sheets).

Agent luôn ghi `Cap_nhat_luc` để bạn biết dữ liệu đang là bản lúc nào.

⚠️ Vì server ghi trực tiếp vào file này, **đóng file trong Excel trước khi agent chạy** (Excel
khóa file khi đang mở, agent sẽ báo lỗi ghi nếu file đang mở) — mở lại sau khi agent báo đã cập
nhật xong.

## 7. Chia sẻ & bảo mật

Sheet chứa dữ liệu cá nhân (Nghị định 13/2023). Chia sẻ theo **email cụ thể**, không dùng
"bất kỳ ai có liên kết". Cột `Luong_mong_muon` nên ẩn với người không thuộc nhóm quyết định lương.
