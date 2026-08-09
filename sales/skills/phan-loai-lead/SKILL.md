---
name: phan-loai-lead
description: Phân loại một Lead thành khách tiềm năng hay partner tiềm năng, và gán nhóm dịch vụ (xe, homestay, quán ăn, tour, spa - làm đẹp, khác). Được gọi bởi thu-thap-lead sau bước bóc tách, hoặc dùng trực tiếp khi user hỏi "người này là khách hay đối tác", "phân loại danh sách lead này giúp". Không chắc thì trả chua_ro chứ không đoán bừa.
---

# Phân loại Lead

Hai trục phân loại, độc lập nhau.

## Trục 1 — `loai`: họ đứng ở phía nào?

| Giá trị | Nghĩa | Dấu hiệu trong bình luận |
|---|---|---|
| `khach` | **Khách tiềm năng** — đang có nhu cầu mua/thuê | "cần thuê", "cần tìm", "muốn đặt", "cho hỏi giá", "bao nhiêu", "còn phòng/xe không", "ai có… inbox mình", hỏi về lịch trình cho đoàn của họ |
| `partner` | **Partner tiềm năng** — đang có dịch vụ để chào | "nhà mình có", "bên em có", "cho thuê", "nhận đặt", "chuyên…", "quán mình", "nhà xe", "chủ homestay", "liên hệ hợp tác", kèm mô tả năng lực (số xe, số phòng, sức chứa) |
| `chua_ro` | Không đủ căn cứ | Chỉ để lại số điện thoại trống không, hoặc câu nước đôi vừa hỏi vừa chào |

Quy tắc khi lẫn lộn: có **mô tả năng lực cung cấp** (số lượng xe/phòng/bàn, bảng giá của họ) thì
nghiêng về `partner`, kể cả khi câu có chữ "cần". Ngược lại chỉ hỏi giá → `khach`.

Không đoán theo tên, giới tính, hay ảnh đại diện. Không suy từ việc họ để số điện thoại.

## Trục 2 — `dich_vu`: họ ở nhóm nào?

| Giá trị | Bao gồm |
|---|---|
| `xe` | Thuê xe 4/7/16/29/45 chỗ, limousine, xe máy, tài xế, đưa đón sân bay, vận chuyển |
| `homestay` | Homestay, khách sạn, resort, villa, nhà nghỉ, căn hộ, bungalow — mọi thứ liên quan chỗ ở |
| `quan-an` | Quán ăn, nhà hàng, quán nhậu, hải sản, cà phê, đặt bàn đoàn, set menu, buffet |
| `tour` | Tour trọn gói, hướng dẫn viên, vé tham quan, cano/tàu, vé máy bay, combo du lịch |
| `spa-lam-dep` | Spa, massage, nail, tóc, trang điểm |
| `khac` | Không thuộc nhóm nào ở trên, hoặc nói quá chung chung |

Bình luận chạm nhiều nhóm (ví dụ "cần thuê xe và đặt phòng") → chọn nhóm **được nói kỹ hơn**,
phần còn lại đưa vào `nhu_cau`. Không tạo hai Lead cho cùng một người.

## `do_tin_cay`

| Giá trị | Khi nào |
|---|---|
| `cao` | Rõ tên, rõ vế cung/cầu, rõ nhóm dịch vụ, số điện thoại nằm ngay trong câu của họ |
| `trung_binh` | Thiếu một trong ba yếu tố trên |
| `thap` | Chỉ có số điện thoại + câu ngắn không rõ ý, hoặc phân loại chỉ dựa vào một từ khóa duy nhất |

`trung_binh` và `thap` phải bật cờ `can_nguoi_xac_nhan` — màn hình Lead sẽ hiện nhãn **cần rà**
và người phụ trách phải xác nhận trước khi đem đi mời.

## Ranh giới

Không chấm điểm Lead theo giới tính, tuổi, quê quán, hình đại diện. Không suy đoán thu nhập hay
khả năng chi trả. Phân loại chỉ dựa vào **nội dung người ta tự viết ra**.
