# hr/data — Dữ liệu vận hành

> ⛔ **Thư mục này chứa dữ liệu cá nhân của ứng viên (PII).**
> `requisitions/` và `ho-so/` đã được gitignore. Kiểm tra `git status` trước mỗi lần commit.

## Cấu trúc

```
data/
├── requisitions/            ← trạng thái từng đợt tuyển — REQ-YYYY-NNN.json  [gitignored]
├── ho-so/                   ← CV, biên bản PV, offer letter                  [gitignored]
│   ├── REQ-YYYY-NNN/
│   │   ├── JD-<vi-tri>.md
│   │   ├── bai-dang/
│   │   ├── cv/
│   │   ├── phong-van/
│   │   ├── offer/
│   │   └── tong-ket.md
│   └── nhan-su/             ← hồ sơ người đã nhận việc
└── mau-cong-ty/             ← MẪU CHUẨN CỦA CÔNG TY — bạn cần đặt file vào đây
```

## `mau-cong-ty/` — cần bạn cung cấp

| File | Tên đặt chính xác | Bắt buộc |
|---|---|---|
| Mẫu offer letter (.docx còn sửa được) | `offer-letter.docx` | ✅ Thiếu là skill `offer-va-luu-ho-so` dừng ở Cổng 2 |
| Mẫu offer vị trí quản lý (nếu khác) | `offer-letter-quan-ly.docx` | Nếu có |
| Mẫu hợp đồng thử việc | `hop-dong-thu-viec.docx` | Nếu có |
| Mẫu JD chuẩn công ty | `jd-mau.docx` | Nên có |
| Logo / letterhead | `letterhead.png` | Nếu mẫu chưa nhúng sẵn |

Chi tiết cách đánh dấu chỗ điền: xem `hr/templates/offer-field-map.md`.

## Đồng bộ lên OneDrive / Google Drive

Chưa có connector Drive/OneDrive. Cách làm: đặt thư mục `ho-so/` **bên trong thư mục đồng bộ**
của OneDrive/Google Drive trên máy, hoặc tạo symbolic link:

```powershell
# Chạy PowerShell với quyền Administrator
New-Item -ItemType SymbolicLink `
  -Path "D:\Ca nhan\Claude\project\aios\hr\data\ho-so" `
  -Target "C:\Users\HP\OneDrive\HR\Ho-so-ung-vien"
```

Sau đó báo đường dẫn đó cho agent để ghi vào `duong_dan_luu_tru` của requisition.
