# Đặc tả một Lead

Nguồn sự thật của cấu trúc này: `website/js/work.js` (hàm `mergeLeads`) và `server/sales.js`.
Bản sao lưu trên máy chủ nằm ở `sales/data/leads/leads.json` — **chứa PII, không commit**.

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `id` | string | ✅ | Khóa nội bộ, sinh tự động (`l…`) |
| `ten` | string | — | Tên hiển thị người ta để. Rỗng nghĩa là chưa xác định — hiện "(chưa có tên)" |
| `sdt` | string | ⚠️ | Số điện thoại đã chuẩn hóa (`0xxxxxxxxx`). **Phải có `sdt` hoặc `email`** |
| `sdt_khac` | string[] | — | Các số khác tìm thấy trong cùng bình luận |
| `email` | string | ⚠️ | Chữ thường. Xem ràng buộc ở `sdt` |
| `nguon` | string | ✅ | URL bài viết, hoặc `"Dán tay"` |
| `nguon_loai` | enum | ✅ | `facebook` \| `thu-cong` \| `khac` — dùng cho bộ lọc Nguồn |
| `comment` | string | ✅ | **Nguyên văn** bình luận, đã bỏ nhiễu giao diện. Không viết lại |
| `nhu_cau` | string | — | Tóm tắt 1 câu: họ cần gì / họ cung cấp gì |
| `loai` | enum | ✅ | `khach` \| `partner` \| `chua_ro` |
| `dich_vu` | enum | ✅ | `xe` \| `homestay` \| `quan-an` \| `tour` \| `spa-lam-dep` \| `khac` |
| `trang_thai` | enum | ✅ | `moi` → `da_lien_he` → `da_moi` → `quan_tam` → `da_chot`, hoặc `tu_choi` |
| `kenh_moi` | object[] | — | `{ kenh, at, note }` — lịch sử mời, mỗi lần một dòng |
| `do_tin_cay` | enum | ✅ | `cao` \| `trung_binh` \| `thap` |
| `can_nguoi_xac_nhan` | bool | ✅ | `true` → hiện nhãn **cần rà** trên bảng, chưa nên đem đi mời |
| `cach_boc_tach` | enum | ✅ | `llm` \| `regex` \| `thu-cong` — truy vết chất lượng dữ liệu |
| `phu_trach` | staffId | ✅ | Nhân sự chịu trách nhiệm chăm Lead này |
| `ticket` | ticketId \| null | — | Phiếu yêu cầu đã sinh ra Lead này |
| `at` | date | ✅ | Ngày ghi nhận (YYYY-MM-DD) |
| `ghi_chu` | string | — | Ghi chú nội bộ — **không** xuất ra cho khách |

## Khử trùng

Khóa so trùng, theo thứ tự ưu tiên:

1. `sdt` sau chuẩn hóa (`+84`/`84` → `0`, bỏ dấu cách/chấm/gạch)
2. `email` viết thường
3. `ten` + 40 ký tự đầu của `comment` (chỉ dùng khi thiếu cả hai trên — hiếm, vì Lead bắt buộc
   phải có một cách liên hệ)

Bản trùng bị **bỏ qua**, không ghi đè — dữ liệu người đã chỉnh tay luôn thắng dữ liệu Agent quét về sau.

## Vòng đời trạng thái

```
moi ──liên hệ lần đầu──> da_lien_he ──gửi lời mời──> da_moi ──họ phản hồi tích cực──> quan_tam ──> da_chot
 └────────────────────────── họ nói không ───────────────────────────────────────────> tu_choi
```

`tu_choi` là trạng thái cuối — không mời lại. Người ta yêu cầu xóa dữ liệu thì **xóa hẳn** Lead
(nút 🗑 trong hồ sơ Lead), không chỉ đổi trạng thái.
