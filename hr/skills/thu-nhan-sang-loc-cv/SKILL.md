---
name: thu-nhan-sang-loc-cv
description: Bước 4 quy trình tuyển dụng — gom CV từ Gmail (và inbox Facebook/Zalo đã chuyển tiếp), chấm điểm theo rubric trong JD, xếp hạng shortlist. Trigger khi user nói "gom CV", "check CV", "lọc CV", "sàng lọc hồ sơ", "shortlist", "chấm điểm CV", "có ai nộp chưa", "ứng viên mới". Dùng Gmail MCP để tìm và tải CV. Khi có trên 15 CV thì gọi subagent cham-diem-cv chạy song song. Báo cáo tổng hợp phải ẩn PII.
---

# B4 — Thu nhận & sàng lọc CV

## Phần A — Gom CV

### A0. Copy file PDF vào thư mục (cách đang dùng thật — chưa có Gmail MCP)

Hệ thống này chưa nối Gmail MCP thật, nên A1 dưới đây chỉ là quy trình đích hướng tới. Cách đang
hoạt động thật ngay bây giờ:

1. Requisition đã có sẵn thư mục `hr/data/ho-so/REQ-YYYY-NNN/cv/` (tạo tự động từ B1).
2. User tự copy file CV (.pdf, đặt tên rõ ràng — khuyến khích `Ten-Ung-Vien.pdf`) vào đúng thư mục đó.
3. User nhắn tên file vào chat (vd "chấm NguyenVanA.pdf") hoặc nói "chấm tất cả" nếu muốn chấm hết
   file đang có trong thư mục.
4. Server tự phát hiện tên file được nhắc tới, đính kèm thẳng file PDF gốc vào tin nhắn — lượt này
   tự chuyển sang model có vision (Claude Haiku 4.5) để đọc trực tiếp, không qua OCR trung gian, nên
   đọc được cả CV dạng scan/đồ họa (Canva, ảnh chụp...) không có lớp text. Các bước khác trong pipeline
   vẫn dùng DeepSeek V4 Flash như bình thường — chỉ lượt đọc CV mới đổi model. Bạn **không cần** tool
   đọc file, chỉ cần chấm điểm theo đúng rubric ở Phần B rồi lưu bằng `upsert_candidate` với `file_cv`
   là tên file đó.
5. Trường hợp hiếm khi vẫn không đọc được nội dung (file hỏng, quá mờ...), báo cho user biết để họ
   gửi bản PDF khác hoặc paste tay nội dung.

### A1. Từ Gmail (tự động — CHƯA nối thật, xem A0 ở trên)

Dùng Gmail MCP `search_threads` với query, ví dụ:

```
(has:attachment filename:pdf OR filename:doc OR filename:docx)
(subject:"ứng tuyển" OR subject:"CV" OR subject:"apply" OR subject:"<tên vị trí>")
after:<ngay_dang sớm nhất trong kenh_dang[]>
```

Với mỗi thread khớp: `get_message` → lấy tên, email, SĐT, file đính kèm, ngày nộp, nguồn (dòng "biết đến qua").

**Khuyến nghị hạ tầng — nêu với user nếu chưa có:**
- Tạo label Gmail `Tuyen-dung/<REQ-ID>` và bộ lọc tự gán → truy vấn sau này chính xác hơn nhiều.
- Dùng **một địa chỉ email tuyển dụng duy nhất** (vd `tuyendung@congty.vn`) cho mọi kênh.

### A2. Từ Facebook / Zalo OA

Không có MCP. Hai cách:
1. **Chuyển tiếp inbox về email tuyển dụng** → quay lại A1 (khuyến nghị).
2. User copy thủ công thông tin ứng viên → agent nhập vào `ung_vien[]`, đánh dấu `nguon: "facebook_inbox"`.

### A3. Lưu file

Tải CV về `hr/data/ho-so/REQ-YYYY-NNN/cv/UV-<nn>-<ten-khong-dau>.pdf`.
Mỗi ứng viên được cấp **mã `UV-nn`** — mọi báo cáo tổng hợp dùng mã này thay tên.

## Phần B — Chấm điểm

### B1. Rubric

Lấy từ `jd.tieu_chi` của requisition (3 tầng đã chốt ở B2):

| Hạng mục | Điểm tối đa | Cách chấm |
|---|---|---|
| Tiêu chí **bắt buộc** | 50 | Mỗi mục đạt = 10 đ. **Thiếu ≥ 2 mục → loại thẳng**, ghi rõ mục nào |
| Tiêu chí **nên có** | 25 | Mỗi mục đạt = 5 đ |
| Kinh nghiệm liên quan | 15 | Đúng ngành + đúng quy mô công ty tương đương |
| Tín hiệu ổn định | 10 | Trừ điểm nếu nhảy việc < 12 tháng lặp lại nhiều lần — **ghi nhận, không kết luận**, hỏi ở vòng PV |

Xếp loại: **A ≥ 75** (mời PV ngay) · **B 60–74** (dự phòng) · **C < 60** (loại).

Điểm từng hạng mục ở trên phải lưu riêng vào `diem_chi_tiet` (`bat_buoc`, `nen_co`, `kinh_nghiem`,
`on_dinh`) khi gọi `upsert_candidate` — không chỉ báo tổng `diem`. Đây là 4 cột riêng trong Excel
Pipeline, giúp người dùng truy lại vì sao ứng viên được số điểm đó mà không cần mở lại CV.

### B2. Chạy song song khi nhiều CV

- **≤ 15 CV** → tự đọc tuần tự.
- **> 15 CV** → gọi subagent `cham-diem-cv` (xem `hr/agents/cham-diem-cv.md`), mỗi lần **5 CV/subagent**,
  truyền kèm rubric đầy đủ. Subagent trả JSON, skill này gộp lại và xếp hạng.

### B3. Nguyên tắc chấm

- Chỉ chấm dựa trên **bằng chứng có trong CV**. Không suy đoán từ tên trường, tên công ty, hay quê quán.
- **Không chấm điểm dựa trên**: giới tính, tuổi, tình trạng hôn nhân, quê quán, ảnh chân dung, tôn giáo.
  Nếu user yêu cầu lọc theo các tiêu chí này, từ chối và giải thích ngắn gọn là vi phạm pháp luật lao động.
- Mọi điểm trừ phải kèm **trích dẫn nguyên văn** dòng trong CV làm căn cứ.
- Khoảng trống trong CV → gắn cờ "cần hỏi ở vòng PV", không tự trừ điểm.

## Phần C — Output

1. Cập nhật `ung_vien[]` trong requisition qua tool `upsert_candidate`: `ma_uv`, `ten`, `email`,
   `sdt`, `nguon`, `ngay_nop`, `file_cv`, `diem`, `xep_loai`, `diem_chi_tiet` (4 hạng mục rubric B1),
   `diem_manh[]`, `diem_can_hoi[]`, `trang_thai: "moi"`. Server **tự động ghi luôn dòng tương ứng** vào
   `hr/templates/Tuyen-dung-2026-Pipeline.xlsx` (sheet `Pipeline`, khóa `Ma_UV`+`REQ_ID`, đủ cột
   `File_CV`/`Diem_bat_buoc`/`Diem_nen_co`/`Diem_kinh_nghiem`/`Diem_on_dinh`/`Diem_manh`/`Diem_can_hoi`) —
   không cần xuất CSV thủ công nữa.
2. **Bảng shortlist ẩn PII** in ra chat:

| Mã | Điểm | Loại | Điểm mạnh nhất | Cần hỏi ở PV |
|---|---|---|---|---|
| UV-03 | 82 | A | 4 năm đúng mảng, có chứng chỉ X | Lý do nghỉ chỗ cũ sau 8 tháng |

3. Nếu tool báo Excel chưa đồng bộ được (thường do file đang mở trong Excel trên máy), báo lại
   cho user để họ đóng file rồi thử lại — dữ liệu trong `ung_vien[]` vẫn đã lưu đúng, chỉ riêng
   phần đồng bộ Excel bị lỡ.
4. Hỏi user duyệt danh sách mời phỏng vấn — **agent không tự quyết ai được mời**.

Sau khi user chốt: đặt `buoc_hien_tai = 5`, chốt câu *"Bước kế tiếp: `/lich-phong-van`."*
