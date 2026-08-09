# sales/data/leads — Bản sao lưu kho Lead

Khác với `marketing/data/`, thư mục này **chứa dữ liệu cá nhân** (tên, số điện thoại, email của
người ngoài công ty) nên **không được commit** — đã loại trong `.gitignore`, giống `hr/data/`.

- `leads.json` — ảnh chụp toàn bộ kho Lead, ghi bằng nút **☁ Sao lưu** trên màn hình Lead
  (`POST /api/sales/leads`). Nút **↧ Khôi phục** đọc lại file này và gộp vào kho, bỏ qua bản trùng.
- Kho Lead "sống" nằm trong localStorage của trình duyệt (khóa `aios-work-v1`). Sao lưu là để
  không mất dữ liệu khi xóa cache hoặc đổi máy — hãy bấm sau mỗi đợt thu thập.

Nghĩa vụ khi giữ dữ liệu này: xem `sales/README.md` §5 (Nghị định 13/2023/NĐ-CP). Có yêu cầu xóa
thì xóa Lead trên giao diện **và** sao lưu lại đè lên file này.
