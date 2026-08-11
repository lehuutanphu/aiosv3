/* ============================================================
   AI OS — Điều hành công việc (Dự án · Phiếu yêu cầu · Công việc)
   ------------------------------------------------------------
   Mặt phẳng KIỂM SOÁT của AI OS: nhìn toàn cảnh ai đang làm gì,
   trễ ở đâu, ai chưa báo cáo. Mặt phẳng RA LỆNH (chat với Agent)
   vẫn nằm ở js/app.js — file này chỉ gọi sang, không chép lại.

   Nguyên tắc dữ liệu:
   - Mỗi Công việc có NGƯỜI THỰC HIỆN (executor: nhân sự hoặc AI Agent)
     và NGƯỜI CHỊU TRÁCH NHIỆM (owner: luôn là nhân sự).
   - Agent làm việc thì báo cáo vẫn ghi tên người chịu trách nhiệm,
     kèm nhãn 🤖 — đúng mô hình "mỗi Agent do 1 nhân sự phụ trách".
   - Tiến độ cuộn lên: Công việc → Phiếu yêu cầu → Dự án.

   P0 (file này): mô hình dữ liệu, lưu trữ, điều hướng, khung màn hình.
   ============================================================ */
(function () {
  "use strict";

  const STORAGE_KEY = "aios-work-v1";
  const SCHEMA_VERSION = 1;

  // Backend Proxy dùng cho P3 (giao việc cho AI Agent chạy thật).
  const WORK_PROXY_BASE = "http://localhost:8787";

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const DAY = 86400000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const today = () => iso(Date.now());
  const dOff = (n) => iso(Date.now() + n * DAY);
  const esc = (s) => (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "—");
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

  // Danh sách Agent lấy thẳng từ js/app.js — khai báo một chỗ duy nhất.
  const agentList = () => (typeof AGENTS !== "undefined" ? AGENTS : []);
  const agentById = (id) => agentList().find((a) => a.id === id) || null;

  // ---------- Dữ liệu mẫu ----------
  // 🔴 TOÀN BỘ DỮ LIỆU DƯỚI ĐÂY LÀ HƯ CẤU — tên nhân sự, tên khách hàng, tên dự án,
  // số điện thoại và email đều bịa ra để demo. Kho mã này công khai, nên KHÔNG thay
  // bằng nhân sự/khách hàng thật; muốn dùng dữ liệu thật thì nhập trên giao diện
  // (lưu ở localStorage của máy bạn) hoặc nối vào nguồn dữ liệu riêng.
  //
  // Ngày sinh theo thời điểm mở dashboard để phần trễ hạn / thiếu báo cáo
  // luôn có ý nghĩa, không bị "chết cứng" ở một mốc quá khứ.
  function seed() {
    const staff = [
      { id: "s1", name: "Nguyễn Minh An", title: "Trưởng nhóm giải pháp" },
      { id: "s2", name: "Trần Quốc Bảo", title: "Quản lý dự án" },
      { id: "s3", name: "Lê Hoàng Cường", title: "Kỹ sư phần mềm" },
      { id: "s4", name: "Phạm Tiến Dũng", title: "Kỹ sư phần mềm" },
      { id: "s5", name: "Vũ Nhật Khang", title: "Lập trình viên ứng dụng" },
      { id: "s6", name: "Đỗ Gia Lâm", title: "Lập trình viên backend" },
      { id: "s7", name: "Hoàng Bảo Nam", title: "Kỹ sư AI / NLU" },
      { id: "s8", name: "Ngô Thanh Mai", title: "Chuyên viên tư vấn" },
      { id: "s9", name: "Bùi Khánh Linh", title: "Quản lý sản phẩm" },
      { id: "s10", name: "Đặng Hải Yến", title: "Chuyên viên hỗ trợ" },
    ];

    const customers = [
      { id: "c1", name: "Công ty TNHH Giải Pháp An Khang (Nội bộ)" },
      { id: "c2", name: "CTY TNHH MTV Cấp Nước Bình Minh" },
      { id: "c3", name: "CN CTY CP Phòng Khám Mắt Ánh Dương" },
      { id: "c4", name: "CTY TNHH TM Hưng Thịnh Phát" },
      { id: "c5", name: "CTY CP Cấp Nước Sao Mai" },
    ];

    // Mỗi AI Agent được giao cho đúng 1 nhân sự chịu trách nhiệm.
    const agentOwners = {
      "sales-1": "s8", "mkt-1": "s9", "mkt-2": "s9", "mkt-3": "s8", "mkt-4": "s9",
      "mkt-5": "s8", "hr-1": "s2", "fin-1": "s1", "fin-2": "s1",
      "legal-1": "s2", "cskh-1": "s10", "cskh-2": "s10",
    };

    const projects = [
      { id: "p1", name: "Nâng cấp Trợ lý ảo 2.0", customer: "c1", pm: "s1", members: ["s1", "s3", "s7", "s5"], start: dOff(-68), deadline: dOff(54), status: "Đang thực hiện", desc: "Nâng cấp Trợ lý ảo lên phiên bản 2.0: NLU mới, tích hợp kênh Zalo/FB, dashboard giám sát.", docs: ["SRS_TroLyAo_2.0.pdf", "Wireframe_v3.fig"], public: true },
      { id: "p2", name: "Ứng dụng CRM — Mobile & Desktop", customer: "c1", pm: "s9", members: ["s9", "s5", "s3", "s6", "s7"], start: dOff(-84), deadline: dOff(24), status: "Đang thực hiện", desc: "Phát triển CRM trên Desktop và Mobile: danh sách công việc UI mới, chức năng File link, chat nội bộ.", docs: ["UI_Design_CRM.fig"], public: false },
      { id: "p3", name: "Triển khai CRM — CN Bình Minh", customer: "c2", pm: "s2", members: ["s2", "s1", "s4", "s3"], start: dOff(-37), deadline: dOff(39), status: "Đang thực hiện", desc: "Triển khai CRM cho Cấp Nước Bình Minh: tổ chức chi nhánh cha–con, phân quyền xem phiếu/chat/khách hàng theo tổ chức con.", docs: ["HopDong_BinhMinh_2026.pdf", "BienBan_KhaoSat.docx"], public: true },
      { id: "p4", name: "Bảo trì Contact Center Sao Mai", customer: "c5", pm: "s2", members: ["s2", "s10"], start: dOff(-218), deadline: dOff(146), status: "Đang thực hiện", desc: "Gói bảo trì hệ thống Contact Center cho Cấp Nước Sao Mai năm 2026.", docs: ["HD_BaoTri_SaoMai.pdf"], public: true },
      { id: "p5", name: "Tổng đài Phòng khám Ánh Dương", customer: "c3", pm: "s8", members: ["s8", "s1", "s10"], start: dOff(-28), deadline: dOff(23), status: "Mới", desc: "Tư vấn và triển khai tổng đài 1 số nhiều ext cho hệ thống Phòng Khám Mắt Ánh Dương.", docs: [], public: false },
    ];

    const tickets = [
      { id: "t1", code: 49357, title: "Các việc phát triển cho CRM CN Bình Minh", project: "p3", type: "Yêu cầu phát triển phần mềm", status: "Mới", prio: "Trung bình", deadline: dOff(3), assignees: ["s10", "s1", "s2", "s3"], desc: "Tạo tổ chức chi nhánh (cha–con); phân quyền xem phiếu yêu cầu, chat, khách hàng của các tổ chức con." },
      { id: "t2", code: 49354, title: "Chức năng File link trên Desktop", project: "p2", type: "Testing phần mềm", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(3), assignees: ["s3", "s5"], desc: "Khi người dùng gửi đường dẫn file trên desktop, hệ thống nhận diện và mở nhanh file link." },
      { id: "t3", code: 49351, title: "Phòng khám Ánh Dương — tổng đài 1 số ext", project: "p5", type: "Hỗ trợ khách hàng", status: "Mới", prio: "Trung bình", deadline: dOff(12), assignees: ["s8", "s1"], desc: "KH có nhu cầu hệ thống tổng đài 1 số nhiều máy nhánh, cần khảo sát và báo giá." },
      { id: "t4", code: 49348, title: "Điều chỉnh lại mẫu khảo sát SMS & ZNS", project: "p4", type: "Hỗ trợ khách hàng", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(-1), assignees: ["s10"], desc: "KH Hưng Thịnh Phát nhờ thay đổi nội dung mẫu khảo sát gửi qua SMS & ZNS." },
      { id: "t5", code: 49345, title: "Cập nhật màn hình danh sách công việc theo UI design mới", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Hoàn tất", prio: "Trung bình", deadline: dOff(0), assignees: ["s5"], desc: "Làm lại màn hình danh sách công việc desktop theo UI design mới." },
      { id: "t6", code: 49288, title: "Khắc phục giật màn hình khi chuyển đổi menu trong màn hình chat", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Tạm dừng", prio: "Trung bình", deadline: dOff(7), assignees: ["s5"], desc: "Giật màn hình khi chuyển đổi giữa menu chức năng, ảnh và bàn phím trong màn hình chat." },
      { id: "t7", code: 49290, title: "Chức năng kho lưu trữ chat nội bộ", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(10), assignees: ["s6", "s7"], desc: "API /internal-chat: links, files, media cho kho lưu trữ." },
      { id: "t8", code: 49120, title: "Huấn luyện intent tiếng Việt cho Trợ lý ảo", project: "p1", type: "Yêu cầu phát triển phần mềm", status: "Đang thực hiện", prio: "Cao", deadline: dOff(28), assignees: ["s7", "s1"], desc: "Bộ intent nghiệp vụ cấp nước + huấn luyện mô hình NLU." },
      { id: "t9", code: 49362, title: "Chăm sóc & truyền thông cho các dự án đang chạy", project: "p3", type: "Hỗ trợ khách hàng", status: "Đang thực hiện", prio: "Cao", deadline: dOff(5), assignees: ["s8", "s2"], desc: "Các đầu việc mềm quanh dự án: cập nhật tiến độ cho KH, nội dung giới thiệu tính năng, rà soát phụ lục hợp đồng, tổng hợp công nợ gói bảo trì." },
    ];

    // executor = ai làm (human | agent) · owner = nhân sự chịu trách nhiệm
    const H = (sid) => ({ type: "human", id: sid });
    const A = (aid) => ({ type: "agent", id: aid });
    const tasks = [
      { id: "k1", ticket: "t1", title: "Thiết kế cấu trúc tổ chức cha–con trong DB", executor: H("s3"), owner: "s3", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(2), progress: 0, reports: [] },
      { id: "k2", ticket: "t1", title: "Phân quyền xem phiếu yêu cầu theo tổ chức con", executor: H("s4"), owner: "s4", status: "Đang thực hiện", prio: "Trung bình", start: dOff(-4), deadline: dOff(3), progress: 30, reports: [{ at: dOff(-4), progress: 30, note: "Đã dựng khung API kiểm tra quyền theo cây tổ chức.", by: "s4", byType: "human", minutes: 180 }] },
      { id: "k3", ticket: "t2", title: "Cập nhật chức năng File Link", executor: H("s3"), owner: "s3", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(1), progress: 0, reports: [] },
      { id: "k4", ticket: "t5", title: "Triển khai UI phần filter trong màn hình danh sách công việc", executor: H("s5"), owner: "s5", status: "Hoàn tất", prio: "Trung bình", start: dOff(-6), deadline: dOff(-2), progress: 100, reports: [{ at: dOff(-2), progress: 100, note: "Hoàn tất filter, đã test.", by: "s5", byType: "human", minutes: 240 }] },
      { id: "k5", ticket: "t5", title: "Xây dựng bảng danh sách dữ liệu công việc", executor: H("s5"), owner: "s5", status: "Hoàn tất", prio: "Trung bình", start: dOff(-8), deadline: dOff(-3), progress: 100, reports: [{ at: dOff(-3), progress: 100, note: "Xong bảng dữ liệu, bàn giao test.", by: "s5", byType: "human", minutes: 300 }] },
      { id: "k6", ticket: "t6", title: "Khắc phục giật màn hình chat (menu ↔ ảnh ↔ bàn phím)", executor: H("s5"), owner: "s5", status: "Tạm dừng", prio: "Trung bình", start: dOff(-12), deadline: dOff(7), progress: 11, reports: [{ at: dOff(-11), progress: 11, note: "Tái hiện được lỗi trên Android 13, chờ ưu tiên lại.", by: "s5", byType: "human", minutes: 90 }] },
      { id: "k7", ticket: "t7", title: "API /internal-chat/links lấy tất cả liên kết", executor: H("s7"), owner: "s7", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(2), progress: 0, reports: [] },
      { id: "k8", ticket: "t7", title: "API /internal-chat/files lấy tất cả file/tài liệu", executor: H("s7"), owner: "s7", status: "Đang thực hiện", prio: "Trung bình", start: dOff(-6), deadline: dOff(2), progress: 40, reports: [{ at: dOff(-6), progress: 40, note: "Xong endpoint, chưa phân trang.", by: "s7", byType: "human", minutes: 150 }] },
      { id: "k9", ticket: "t7", title: "API /internal-chat/media lấy ảnh/video", executor: H("s6"), owner: "s6", status: "Đang thực hiện", prio: "Trung bình", start: dOff(-5), deadline: dOff(1), progress: 60, reports: [{ at: dOff(-1), progress: 60, note: "Xong API media, đang viết unit test.", by: "s6", byType: "human", minutes: 210 }] },
      { id: "k10", ticket: "t8", title: "Xây dựng bộ intent nghiệp vụ cấp nước", executor: H("s7"), owner: "s7", status: "Đang thực hiện", prio: "Cao", start: dOff(-20), deadline: dOff(6), progress: 45, reports: [{ at: dOff(-2), progress: 45, note: "Đã định nghĩa 120/250 intent.", by: "s7", byType: "human", minutes: 480 }] },
      { id: "k11", ticket: "t8", title: "Huấn luyện & đánh giá mô hình NLU", executor: H("s1"), owner: "s1", status: "Mới", prio: "Cao", start: dOff(5), deadline: dOff(28), progress: 0, reports: [] },
      { id: "k12", ticket: "t4", title: "Cập nhật nội dung mẫu khảo sát ZNS", executor: H("s10"), owner: "s10", status: "Đang thực hiện", prio: "Trung bình", start: dOff(-3), deadline: dOff(-1), progress: 80, reports: [{ at: dOff(-3), progress: 80, note: "Đã sửa mẫu, chờ KH duyệt.", by: "s10", byType: "human", minutes: 60 }] },
      { id: "k13", ticket: "t3", title: "Khảo sát hạ tầng tổng đài hiện tại của KH", executor: H("s8"), owner: "s8", status: "Mới", prio: "Trung bình", start: dOff(1), deadline: dOff(6), progress: 0, reports: [] },

      // Việc giao cho AI Agent — người chịu trách nhiệm vẫn là nhân sự phụ trách Agent đó
      { id: "k14", ticket: "t9", title: "Soạn email cập nhật tiến độ tuần cho CN Bình Minh", executor: A("sales-1"), owner: "s8", status: "Đang thực hiện", prio: "Cao", start: dOff(-1), deadline: dOff(1), progress: 50, reports: [{ at: dOff(-1), progress: 50, note: "Đã dựng bản nháp email theo mốc tiến độ phiếu #49357, chờ người phụ trách rà lại số liệu.", by: "s8", byType: "agent", agentId: "sales-1", minutes: 4 }] },
      { id: "k15", ticket: "t9", title: "Viết bài giới thiệu tính năng mới của Trợ lý ảo 2.0", executor: A("mkt-1"), owner: "s9", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(4), progress: 0, reports: [] },
      { id: "k16", ticket: "t9", title: "Rà soát điều khoản phụ lục gia hạn HĐ 878", executor: A("legal-1"), owner: "s2", status: "Chờ duyệt", prio: "Cao", start: dOff(-2), deadline: dOff(2), progress: 100, reports: [{ at: dOff(-2), progress: 100, note: "Phát hiện 2 điểm cần lưu ý: mốc thanh toán lệch 15 ngày so với hợp đồng gốc và thiếu điều khoản chấm dứt sớm. Đề xuất chỉnh trước khi gửi KH.", by: "s2", byType: "agent", agentId: "legal-1", minutes: 6 }] },
      { id: "k17", ticket: "t9", title: "Tổng hợp công nợ gói bảo trì Sao Mai quý 2", executor: A("fin-1"), owner: "s1", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(5), progress: 0, reports: [] },
    ];

    return { version: SCHEMA_VERSION, staff, customers, agentOwners, projects, tickets, tasks, leads: seedLeads() };
  }

  // Lead mẫu — đủ để thấy cả hai loại (khách / partner) và vài nhóm dịch vụ.
  function seedLeads() {
    return [
      { id: "l1", ten: "Trần Minh Khoa", sdt: "0900000101", sdt_khac: [], email: "", nguon: "https://www.facebook.com/groups/nhom-du-lich-mau/posts/1000000001", nguon_loai: "facebook",
        comment: "Nhà mình có 4 xe 16 chỗ và 2 xe 29 chỗ chạy tuyến Nha Trang – Đà Lạt, bao trọn gói tài xế. Ai cần thì gọi mình 0900000101 nhé.",
        nhu_cau: "Cung cấp dịch vụ thuê xe 16–29 chỗ tuyến Nha Trang – Đà Lạt",
        loai: "partner", dich_vu: "xe", trang_thai: "moi", kenh_moi: [], do_tin_cay: "cao", can_nguoi_xac_nhan: false,
        cach_boc_tach: "llm", phu_trach: "s8", ticket: null, at: dOff(-2), ghi_chu: "" },
      { id: "l2", ten: "Nguyễn Thị Hồng Vân", sdt: "0900000102", sdt_khac: [], email: "homestay.mau@example.com", nguon: "https://www.facebook.com/groups/nhom-du-lich-mau/posts/1000000001", nguon_loai: "facebook",
        comment: "Bên em có homestay 6 phòng view biển ở Hòn Chồng, muốn hợp tác với bên tour để nhận khách đoàn. Liên hệ em qua zalo 0900000102 hoặc mail homestay.mau@example.com",
        nhu_cau: "Chủ homestay 6 phòng, muốn hợp tác nhận khách đoàn",
        loai: "partner", dich_vu: "homestay", trang_thai: "da_lien_he", kenh_moi: [{ kenh: "Zalo", at: dOff(-1), note: "Đã gửi giới thiệu chương trình hợp tác partner." }],
        do_tin_cay: "cao", can_nguoi_xac_nhan: false, cach_boc_tach: "llm", phu_trach: "s8", ticket: null, at: dOff(-2), ghi_chu: "" },
      { id: "l3", ten: "Phạm Quốc Huy", sdt: "0900000103", sdt_khac: [], email: "", nguon: "https://www.facebook.com/groups/nhom-du-lich-mau/posts/1000000001", nguon_loai: "facebook",
        comment: "Cho mình hỏi đoàn 25 người đi 3 ngày 2 đêm thì thuê xe với đặt phòng khoảng bao nhiêu vậy ạ? Sđt mình 0900000103.",
        nhu_cau: "Cần báo giá tour đoàn 25 người, 3 ngày 2 đêm",
        loai: "khach", dich_vu: "tour", trang_thai: "moi", kenh_moi: [], do_tin_cay: "cao", can_nguoi_xac_nhan: false,
        cach_boc_tach: "llm", phu_trach: "s8", ticket: null, at: dOff(-2), ghi_chu: "" },
      { id: "l4", ten: "", sdt: "0900000104", sdt_khac: [], email: "", nguon: "Dán tay", nguon_loai: "thu-cong",
        comment: "Quán mình chuyên hải sản ở đường Trần Phú, nhận đặt bàn đoàn trên 30 khách, có menu set sẵn. 0900000104",
        nhu_cau: "", loai: "partner", dich_vu: "quan-an", trang_thai: "moi", kenh_moi: [], do_tin_cay: "thap", can_nguoi_xac_nhan: true,
        cach_boc_tach: "regex", phu_trach: "s8", ticket: null, at: dOff(-1), ghi_chu: "Chưa có tên người liên hệ — cần gọi xác nhận." },
    ];
  }

  /* ---------- Lưu trữ ----------
     Ba tầng, theo thứ tự ưu tiên khi ĐỌC: Firestore (qua proxy) → localStorage → dữ liệu mẫu.
     Khi GHI thì ngược lại: localStorage ghi ngay và luôn ghi, rồi mới đẩy lên proxy có
     hoãn nhịp. Giao diện không bao giờ phải chờ mạng, và mất proxy cũng không mất việc.

     Vì sao vẫn giữ localStorage khi đã có Firestore: proxy chạy trên máy người vận hành
     nên có lúc chưa bật. Trước đây localStorage là nơi DUY NHẤT — xoá cache là mất trắng,
     đã xảy ra một lần với 11 bài viết của vòng cluster đầu tiên. Giờ nó chỉ còn là đệm. */
  let S = null;
  let LOAD_SOURCE = "seed"; // "seed" | "local" | "server"

  const SYNC = { trang_thai: "cho", nhan: "Đang kiểm tra kho dữ liệu…", chi_tiet: "" };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === SCHEMA_VERSION && Array.isArray(data.tasks)) {
          LOAD_SOURCE = "local";
          return data;
        }
      }
    } catch (e) {
      console.warn("[work] Không đọc được dữ liệu đã lưu, dùng lại dữ liệu mẫu:", e);
    }
    LOAD_SOURCE = "seed";
    return seed();
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch (e) {
      console.warn("[work] Không lưu được vào localStorage:", e);
    }
  }

  function save() {
    S.cap_nhat_luc = new Date().toISOString(); // mốc để so ai mới hơn khi đồng bộ
    saveLocal();
    schedulePush();
  }

  /* Đẩy lên proxy có hoãn nhịp: một thao tác kéo-thả có thể gọi save() nhiều lần liên
     tiếp, mà mỗi lần đẩy là một lượt ghi Firestore tính vào hạn mức. */
  let pushTimer = null;
  let pushing = false;
  let pushLai = false;

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushToServer, 1500);
  }

  /* Proxy TẮT thì fetch báo lỗi ngay. Proxy TREO thì fetch chờ vô hạn — và đó mới là
     tình huống nguy hiểm: cờ `pushing` kẹt lại, mọi lần lưu sau chỉ đặt `pushLai` rồi
     thoát, huy hiệu đóng băng ở "đã lưu" trong khi thực tế không có gì được lưu.
     Người dùng yên tâm nhầm là cách chắc nhất để mất dữ liệu lần nữa. */
  const PUSH_TIMEOUT_MS = 15000;

  function fetchCoHan(url, opts, ms) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(timer));
  }

  async function pushToServer() {
    if (pushing) { pushLai = true; return; } // tránh hai lượt ghi đè chéo nhau
    pushing = true;
    try {
      const res = await fetchCoHan(`${WORK_PROXY_BASE}/api/db/work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: S }),
      }, PUSH_TIMEOUT_MS);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Proxy trả lỗi ${res.status}`);
      if (d.firestore && d.firestore.ok) {
        setSync("firestore", "Đã đồng bộ Firebase", `Ghi ${d.ghi} · xoá ${d.xoa} bản ghi`);
      } else {
        setSync("local", "Đã lưu vào đĩa máy này", (d.firestore && d.firestore.lyDo) || "");
      }
    } catch (e) {
      const treo = e && e.name === "AbortError";
      setSync("offline", "Chỉ lưu trong trình duyệt", treo
        ? `Proxy tại ${WORK_PROXY_BASE} không phản hồi sau ${PUSH_TIMEOUT_MS / 1000}s — có thể đang treo. Dữ liệu chỉ nằm ở trình duyệt này.`
        : `Không gọi được proxy tại ${WORK_PROXY_BASE} — ${e.message}`);
    } finally {
      pushing = false;
      if (pushLai) { pushLai = false; schedulePush(); }
    }
  }

  /* Nạp từ máy chủ sau khi giao diện đã hiện. Chỉ thay dữ liệu đang xem khi máy chủ
     THỰC SỰ mới hơn — không bao giờ âm thầm đè việc người dùng đang làm bằng bản cũ. */
  async function hydrateFromServer() {
    let d;
    try {
      const res = await fetchCoHan(`${WORK_PROXY_BASE}/api/db/work`, { cache: "no-store" }, PUSH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Proxy trả lỗi ${res.status}`);
      d = await res.json();
    } catch (e) {
      setSync("offline", "Chỉ lưu trong trình duyệt", `Chưa chạy proxy tại ${WORK_PROXY_BASE}. Dữ liệu chỉ nằm ở máy này và mất khi xoá cache.`);
      return;
    }

    const remote = d && d.state;
    if (!remote || !Array.isArray(remote.tasks)) {
      // Kho trên máy chủ còn trống — đẩy ngay những gì đang có để có bản sao
      await pushToServer();
      return;
    }

    const tMay = Date.parse(remote.cap_nhat_luc || "") || 0;
    const tTrinhDuyet = Date.parse(S.cap_nhat_luc || "") || 0;

    if (LOAD_SOURCE === "seed" || tMay > tTrinhDuyet) {
      S = remote;
      ensureAgentOwners();
      ensureLeads();
      ensureLeadTaskTags();
      saveLocal();
      render();
      refreshCounters();
      setSync(d.nguon === "firestore" ? "firestore" : "local",
        d.nguon === "firestore" ? "Đã nạp từ Firebase" : "Đã nạp từ đĩa máy này",
        `${remote.tasks.length} công việc · ${(remote.projects || []).length} dự án`);
    } else {
      // Trình duyệt đang giữ bản mới hơn -> đẩy lên thay vì lấy về
      await pushToServer();
    }
  }

  const SYNC_META = {
    cho:       { icon: "◌", cls: "wk-sync-cho" },
    firestore: { icon: "☁", cls: "wk-sync-ok" },
    local:     { icon: "💾", cls: "wk-sync-local" },
    offline:   { icon: "⚠", cls: "wk-sync-off" },
  };

  function setSync(trang_thai, nhan, chi_tiet) {
    SYNC.trang_thai = trang_thai;
    SYNC.nhan = nhan;
    SYNC.chi_tiet = chi_tiet || "";
    const el = document.getElementById("wkSyncBadge");
    if (el) el.outerHTML = syncBadgeHtml();
  }

  function syncBadgeHtml() {
    const m = SYNC_META[SYNC.trang_thai] || SYNC_META.cho;
    return `<span id="wkSyncBadge" class="wk-sync ${m.cls}" title="${esc(SYNC.chi_tiet || SYNC.nhan)}">${m.icon} ${esc(SYNC.nhan)}</span>`;
  }

  function reset() {
    S = seed();
    save();
    render();
    refreshCounters();
  }

  // ---------- Tra cứu ----------
  const staffById = (id) => S.staff.find((x) => x.id === id) || null;
  const staffName = (id) => (staffById(id) || {}).name || "—";
  const customerName = (id) => (S.customers.find((c) => c.id === id) || {}).name || "—";
  const projectById = (id) => S.projects.find((p) => p.id === id) || null;
  const ticketById = (id) => S.tickets.find((t) => t.id === id) || null;
  const taskById = (id) => S.tasks.find((k) => k.id === id) || null;
  const ticketTasks = (tid) => S.tasks.filter((k) => k.ticket === tid);
  const projectTickets = (pid) => S.tickets.filter((t) => t.project === pid);

  // Tên người/Agent thực hiện một công việc
  function executorLabel(task) {
    if (task.executor && task.executor.type === "agent") {
      const a = agentById(task.executor.id);
      return a ? a.name : task.executor.id;
    }
    return staffName(task.executor ? task.executor.id : task.owner);
  }
  const isAgentTask = (task) => !!task.executor && task.executor.type === "agent";

  // ---------- Chỉ số ----------
  const DONE = "Hoàn tất";
  const isDone = (st) => st === DONE || st === "Hoàn thành";
  const isLate = (deadline, status) => !!deadline && deadline < today() && !isDone(status);

  function ticketProgress(tid) {
    const ks = ticketTasks(tid);
    if (!ks.length) return isDone((ticketById(tid) || {}).status) ? 100 : 0;
    return Math.round(ks.reduce((s, k) => s + (k.progress || 0), 0) / ks.length);
  }
  function projectProgress(pid) {
    const ts = projectTickets(pid);
    if (!ts.length) return 0;
    return Math.round(ts.reduce((s, t) => s + ticketProgress(t.id), 0) / ts.length);
  }

  // "Đang làm mà im lặng" — quá 2 ngày không có báo cáo nào
  const REPORT_GRACE_DAYS = 2;
  function lastReportDate(task) {
    if (!task.reports || !task.reports.length) return null;
    return task.reports[task.reports.length - 1].at;
  }
  function needsReport(task) {
    if (task.status !== "Đang thực hiện") return false;
    const last = lastReportDate(task) || task.start;
    if (!last) return true;
    return daysBetween(last, today()) > REPORT_GRACE_DAYS;
  }

  function metrics() {
    const openTasks = S.tasks.filter((k) => !isDone(k.status));
    return {
      projects: S.projects.length,
      projectsDoing: S.projects.filter((p) => p.status === "Đang thực hiện").length,
      tickets: S.tickets.length,
      ticketsOpen: S.tickets.filter((t) => !isDone(t.status)).length,
      tasks: S.tasks.length,
      tasksOpen: openTasks.length,
      late: openTasks.filter((k) => isLate(k.deadline, k.status)).length,
      silent: S.tasks.filter(needsReport).length,
      review: S.tasks.filter((k) => k.status === "Chờ duyệt").length,
      byAgent: openTasks.filter(isAgentTask).length,
      avgProgress: S.projects.length
        ? Math.round(S.projects.reduce((s, p) => s + projectProgress(p.id), 0) / S.projects.length)
        : 0,
    };
  }

  // ---------- Thành phần giao diện dùng lại ----------
  const STATUS_LIST = ["Mới", "Đang thực hiện", "Chờ duyệt", "Tạm dừng", "Hoàn tất"];
  const PRIO_LIST = ["Cao", "Trung bình", "Thấp"];
  const TYPE_LIST = ["Yêu cầu phát triển phần mềm", "Hỗ trợ khách hàng", "Testing phần mềm", "Tư vấn & khảo sát"];

  const stClass = (st) => ({ "Mới": "new", "Đang thực hiện": "doing", "Chờ duyệt": "review", "Tạm dừng": "pause", "Hoàn tất": "done", "Hoàn thành": "done" }[st] || "new");
  const pill = (st) => `<span class="wk-pill ${stClass(st)}">${esc(st)}</span>`;
  const prioTag = (p) => `<span class="wk-prio ${p === "Cao" ? "hi" : p === "Thấp" ? "lo" : "md"}">⚑ ${esc(p)}</span>`;
  const bar = (p) => `<div class="wk-bar ${p >= 100 ? "full" : ""}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i><b>${p}%</b></div>`;
  const initials = (name) => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase();

  function avatars(ids) {
    const shown = ids.slice(0, 5);
    const rest = ids.length - shown.length;
    return `<span class="wk-avts">${shown.map((id) => `<span class="wk-avt" title="${esc(staffName(id))}">${esc(initials(staffName(id)))}</span>`).join("")}${rest > 0 ? `<span class="wk-avt">+${rest}</span>` : ""}</span>`;
  }

  const dlCell = (date, status) =>
    !date ? '<span class="wk-muted">—</span>'
      : isLate(date, status) ? `<span class="wk-late" title="Đã quá hạn">${fmtD(date)}</span>`
      : `<span>${fmtD(date)}</span>`;

  function whoBadge(k) {
    if (isAgentTask(k)) {
      const a = agentById(k.executor.id);
      return `<span class="wk-who agent" title="AI Agent · nhân sự chịu trách nhiệm: ${esc(staffName(k.owner))}">🤖 ${esc(a ? a.name : k.executor.id)}</span>`;
    }
    return `<span class="wk-who human">${esc(staffName(k.executor.id))}</span>`;
  }
  const ownerLine = (k) => (isAgentTask(k) ? `<span class="wk-sub">chịu trách nhiệm: ${esc(staffName(k.owner))}</span>` : "");

  // Nút ra lệnh cho AI Agent ngay trên dòng công việc
  function runBtn(k) {
    if (isAgentTask(k)) {
      const chat = `<button class="wk-minibtn" data-act="task-chat" data-id="${k.id}" title="Trao đổi trực tiếp với Agent về công việc này">💬</button>`;
      const ran = k.run && k.run.status === "done";
      // Việc đã hoàn tất vẫn cho chạy lại: đây là đường soát tay khi người thấy kết quả chưa đạt.
      // Lượt chạy lại KHÔNG tự duyệt — kết quả dừng ở "Chờ duyệt" để người xem rồi mới đóng.
      const title = isDone(k.status)
        ? "Kết quả chưa đạt? Chạy lại — lượt này sẽ dừng ở Chờ duyệt để bạn soát tay"
        : "Cho Agent thực thi trọn công việc này";
      return `<button class="wk-minibtn go" data-act="run-agent" data-id="${k.id}" title="${title}">▶ ${ran ? "Chạy lại" : "Chạy Agent"}</button>${chat}`;
    }
    if (isDone(k.status)) return "";
    return `<button class="wk-minibtn" data-act="assign-agent" data-id="${k.id}" title="Giao công việc này cho AI Agent">🤖 Giao Agent</button>`;
  }

  const opts = (list, selected) => list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
  const staffOpts = (selected) => S.staff.map((s) => `<option value="${s.id}"${s.id === selected ? " selected" : ""}>${esc(s.name)}</option>`).join("");
  const projectOpts = (selected) => S.projects.map((p) => `<option value="${p.id}"${p.id === selected ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  const customerOpts = (selected) => S.customers.map((c) => `<option value="${c.id}"${c.id === selected ? " selected" : ""}>${esc(c.name)}</option>`).join("");

  function ticketOpts(selected) {
    return S.projects.map((p) => {
      const ts = projectTickets(p.id);
      if (!ts.length) return "";
      return `<optgroup label="${esc(p.name)}">${ts.map((t) => `<option value="${t.id}"${t.id === selected ? " selected" : ""}>#${t.code} — ${esc(t.title)}</option>`).join("")}</optgroup>`;
    }).join("");
  }

  // Người thực hiện: nhân sự hoặc AI Agent — giá trị dạng "human:s3" / "agent:sales-1"
  const executorValue = (k) => `${k.executor.type}:${k.executor.id}`;
  function executorOpts(selected) {
    const humans = S.staff.map((s) => `<option value="human:${s.id}"${`human:${s.id}` === selected ? " selected" : ""}>${esc(s.name)}</option>`).join("");
    const agents = agentList().map((a) => `<option value="agent:${a.id}"${`agent:${a.id}` === selected ? " selected" : ""}>${esc(a.icon || "🤖")} ${esc(a.name)} — ${esc(a.model)}</option>`).join("");
    return `<optgroup label="👤 Nhân sự">${humans}</optgroup><optgroup label="🤖 AI Agent">${agents || '<option disabled>Chưa nạp được danh sách Agent</option>'}</optgroup>`;
  }
  function parseExecutor(value) {
    const [type, id] = String(value).split(":");
    return { type: type === "agent" ? "agent" : "human", id };
  }
  // Agent làm việc thì người chịu trách nhiệm mặc định là nhân sự phụ trách Agent đó
  function defaultOwner(executor) {
    if (executor.type === "agent") return S.agentOwners[executor.id] || S.staff[0].id;
    return executor.id;
  }

  const panel = (title, actions, body) => `
    <div class="wk-panel">
      <div class="wk-panel-head"><h3>${title}</h3><span class="spacer"></span>${actions || ""}</div>
      ${body}
    </div>`;

  const table = (headHtml, rowsHtml, emptyText, cols) => `
    <div class="wk-table-wrap"><table class="wk-table">
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${rowsHtml || `<tr><td class="empty" colspan="${cols}">${esc(emptyText)}</td></tr>`}</tbody>
    </table></div>`;

  const crumb = (parts) =>
    `<div class="wk-crumb">${parts.map((p, i) =>
      (p.view ? `<button data-act="go" data-view="${p.view}"${p.id ? ` data-id="${p.id}"` : ""}>${esc(p.label)}</button>` : `<b>${esc(p.label)}</b>`) +
      (i < parts.length - 1 ? '<span class="sep">/</span>' : "")).join("")}</div>`;

  // ---------- Bộ lọc (giữ giữa các lần render) ----------
  const TF = { kw: "", project: "", customer: "", status: "" };
  const KF = { kw: "", executor: "", project: "", status: "", showDone: false, sortKey: "", sortDir: 1, mode: "table" };
  const QA = {}; // ticketId -> đang mở hàng thêm nhanh

  // ---------- Điều hướng ----------
  const VIEW_META = {
    control: { icon: "🛰️", title: "Phòng điều hành", desc: "Toàn cảnh dự án, công việc, trễ hạn và tình trạng báo cáo của cả người lẫn AI Agent." },
    projects: { icon: "📁", title: "Dự án", desc: "Mỗi dự án gắn 1 khách hàng, 1 PM và nhóm nhân sự. Tiến độ cuộn lên từ công việc → phiếu → dự án." },
    tickets: { icon: "🎫", title: "Phiếu yêu cầu", desc: "Yêu cầu từ khách hàng hoặc nội bộ, luôn thuộc về đúng một dự án." },
    tasks: { icon: "✅", title: "Công việc", desc: "Đơn vị nhỏ nhất để giao việc — cho nhân sự hoặc cho AI Agent." },
    staff: { icon: "👥", title: "Nhân sự & Agent", desc: "Khối lượng việc của từng người, kèm các AI Agent mà người đó chịu trách nhiệm." },
    reports: { icon: "📈", title: "Báo cáo", desc: "Nhật ký báo cáo tiến độ. Người tự nhập, Agent tự sinh — cùng một dòng thời gian." },
    leads: { icon: "🧲", title: "Lead — Khách & Partner tiềm năng", desc: "Kho liên hệ do Lead Hunter Agent thu thập từ mạng xã hội, phân loại theo khách/partner và nhóm dịch vụ để mời qua các kênh khác." },
    portal: { icon: "🌐", title: "Portal khách hàng", desc: "Trang khách hàng nhìn thấy: tiến độ và mốc thời gian, không lộ nhân sự hay ghi chú nội bộ." },
    flow: { icon: "🔄", title: "Luồng nghiệp vụ", desc: "Mô hình dữ liệu và luồng vận hành, bao gồm cả nhánh giao việc cho AI Agent." },
  };

  const PARENT_VIEW = { projectDetail: "projects", ticketDetail: "tickets" };

  let VIEW = "control";
  let CTX = null;

  function show(view, ctx) {
    VIEW = (VIEW_META[view] || PARENT_VIEW[view]) ? view : "control";
    CTX = ctx == null ? null : ctx;
    render();
  }

  function setSidebarActive() {
    const key = PARENT_VIEW[VIEW] || VIEW;
    document.querySelectorAll(".dash-sidebar .side-link").forEach((x) => x.classList.remove("active"));
    const link = document.querySelector(`[data-work="${key}"]`);
    if (link) link.classList.add("active");
  }

  // ---------- Render ----------
  function kpiStrip() {
    const m = metrics();
    return `
    <div class="wk-kpis">
      <div class="wk-kpi"><div class="lbl">Dự án</div><div class="val">${m.projectsDoing}/${m.projects}</div><div class="sub">đang thực hiện</div></div>
      <div class="wk-kpi"><div class="lbl">Phiếu yêu cầu</div><div class="val">${m.ticketsOpen}</div><div class="sub">chưa đóng / ${m.tickets} tổng</div></div>
      <div class="wk-kpi ${m.late ? "danger" : "ok"}"><div class="lbl">Trễ hạn</div><div class="val">${m.late}</div><div class="sub">công việc quá hạn</div></div>
      <div class="wk-kpi ${m.silent ? "warn" : ""}"><div class="lbl">Thiếu báo cáo</div><div class="val">${m.silent}</div><div class="sub">im lặng &gt; ${REPORT_GRACE_DAYS} ngày</div></div>
      <div class="wk-kpi agent"><div class="lbl">AI Agent đảm nhiệm</div><div class="val">${m.byAgent}</div><div class="sub">việc đang mở · ${m.review} chờ duyệt</div></div>
    </div>`;
  }

  /* ================= 1. DỰ ÁN ================= */
  function vProjects() {
    const rows = S.projects.map((p) => {
      const pr = projectProgress(p.id);
      return `<tr class="clickable" data-act="go" data-view="projectDetail" data-id="${p.id}">
        <td><span class="wk-link">${esc(p.name)}</span><span class="wk-sub">${esc(p.desc.slice(0, 64))}…</span></td>
        <td>${esc(customerName(p.customer))}</td>
        <td><span class="wk-who human">${esc(staffName(p.pm))}</span></td>
        <td>${avatars(p.members)}</td>
        <td>${dlCell(p.deadline, p.status)}</td>
        <td style="text-align:center">${projectTickets(p.id).length}</td>
        <td>${bar(pr)}</td>
        <td>${pill(p.status)}</td>
        <td>${p.public ? '<span class="wk-pill done">🌐 Có</span>' : '<span class="wk-muted">—</span>'}</td>
      </tr>`;
    }).join("");

    return kpiStrip() + panel(
      "📁 Danh sách dự án",
      '<button class="btn btn-primary btn-sm" data-act="new-project">＋ Tạo dự án</button>',
      table(
        "<th>Dự án</th><th>Khách hàng</th><th>PM</th><th>Nhân sự</th><th>Thời hạn</th><th>Phiếu</th><th>Tiến độ</th><th>Trạng thái</th><th>Public</th>",
        rows, "Chưa có dự án nào.", 9)
    );
  }

  function vProjectDetail() {
    const p = projectById(CTX);
    if (!p) return vProjects();
    const pr = projectProgress(p.id);
    const ts = projectTickets(p.id);

    const head = `
    <div class="wk-panel">
      <div class="wk-panel-head">
        <h3>${esc(p.name)}</h3>
        ${pill(p.status)}
        ${p.public ? '<span class="wk-pill review">🌐 Public cho KH</span>' : ""}
        <span class="spacer"></span>
        <button class="wk-minibtn" data-act="toggle-public" data-id="${p.id}">${p.public ? "Tắt public" : "Bật public cho KH"}</button>
      </div>
      <div class="wk-info">
        <div class="cell"><div class="lbl">Khách hàng</div><div class="val">${esc(customerName(p.customer))}</div></div>
        <div class="cell"><div class="lbl">PM phụ trách</div><div class="val">👤 ${esc(staffName(p.pm))}</div></div>
        <div class="cell"><div class="lbl">Thời gian</div><div class="val">${fmtD(p.start)} → ${dlCell(p.deadline, p.status)}</div></div>
        <div class="cell"><div class="lbl">Mức độ hoàn thành</div><div class="val">${bar(pr)}</div></div>
        <div class="cell full"><div class="lbl">Nội dung dự án</div><div class="val normal">${esc(p.desc)}</div></div>
        <div class="cell full"><div class="lbl">Nhân sự trong dự án</div><div class="val">${p.members.map((m) => `<span class="wk-chip">${esc(staffName(m))}</span>`).join("")}</div></div>
        <div class="cell full"><div class="lbl">Tài liệu đính kèm</div><div class="val">${p.docs.length ? p.docs.map((d) => `<span class="wk-chip doc">📎 ${esc(d)}</span>`).join("") : '<span class="wk-muted">Chưa có tài liệu</span>'}</div></div>
      </div>
    </div>`;

    return crumb([{ label: "Dự án", view: "projects" }, { label: p.name }]) + head + panel(
      `🎫 Phiếu yêu cầu trong dự án <span class="wk-pill new">${ts.length}</span>`,
      `<button class="btn btn-primary btn-sm" data-act="new-ticket" data-project="${p.id}">＋ Tạo phiếu yêu cầu</button>`,
      ts.length ? ts.map(ticketBlock).join("") : '<div class="wk-panel-body wk-muted">Chưa có phiếu yêu cầu nào trong dự án này.</div>'
    );
  }

  // Một phiếu yêu cầu kèm bảng công việc bên trong + hàng thêm nhanh
  function ticketBlock(t) {
    const ks = ticketTasks(t.id);
    const rows = ks.map((k) => `<tr>
      <td>${esc(k.title)}${ownerLine(k)}</td>
      <td>${whoBadge(k)}</td>
      <td>${pill(k.status)}</td>
      <td>${bar(k.progress)}</td>
      <td>${dlCell(k.deadline, k.status)}</td>
      <td><button class="wk-minibtn" data-act="report" data-id="${k.id}">Báo cáo</button></td>
    </tr>`).join("");

    const qaRow = QA[t.id] ? `<tr class="wk-qa">
      <td><input class="wk-input" data-qa-title="${t.id}" placeholder="Nhập tên công việc rồi nhấn Enter…"></td>
      <td><select class="wk-input" data-qa-exec="${t.id}">${executorOpts(`human:${t.assignees[0] || S.staff[0].id}`)}</select></td>
      <td>${pill("Mới")}</td>
      <td>${bar(0)}</td>
      <td><input type="date" class="wk-date" data-qa-dl="${t.id}" value="${t.deadline || ""}"></td>
      <td><div class="wk-cellflex">
        <button class="wk-iconbtn ok" title="Lưu" data-act="qa-save" data-ticket="${t.id}">✓</button>
        <button class="wk-iconbtn no" title="Hủy" data-act="qa-cancel" data-ticket="${t.id}">✕</button>
      </div></td>
    </tr>` : "";

    return `<div class="wk-tic">
      <div class="wk-tic-head" data-act="go" data-view="ticketDetail" data-id="${t.id}">
        <span class="code">#${t.code}</span>
        <span class="name">${esc(t.title)}</span>
        ${pill(t.status)}
        ${avatars(t.assignees)}
        <span style="min-width:110px">${bar(ticketProgress(t.id))}</span>
        <span style="font-size:.78rem">⏱ ${dlCell(t.deadline, t.status)}</span>
      </div>
      ${table(
        `<th>Công việc <button class="wk-iconbtn" title="Thêm công việc nhanh" data-act="qa-toggle" data-ticket="${t.id}">＋</button></th><th>Người thực hiện</th><th>Trạng thái</th><th>Tiến độ</th><th>Thời hạn</th><th></th>`,
        qaRow + rows,
        'Chưa có công việc — bấm ＋ ở cột "Công việc" để thêm nhanh.', 6)}
    </div>`;
  }

  /* ================= 2. PHIẾU YÊU CẦU ================= */
  function vTickets() {
    const kw = TF.kw.toLowerCase();
    const list = S.tickets.filter((t) => {
      const p = projectById(t.project);
      return (!TF.project || t.project === TF.project)
        && (!TF.customer || (p && p.customer === TF.customer))
        && (!TF.status || t.status === TF.status)
        && (!kw || t.title.toLowerCase().includes(kw) || String(t.code).includes(kw));
    });

    const rows = list.map((t) => {
      const p = projectById(t.project);
      const ks = ticketTasks(t.id);
      return `<tr class="clickable" data-act="go" data-view="ticketDetail" data-id="${t.id}">
        <td><span class="wk-link">#${t.code}</span> ${esc(t.title)}<span class="wk-sub">${esc(t.type)} · ${prioTag(t.prio)}</span></td>
        <td>${p ? `<span class="wk-link" data-act="go" data-view="projectDetail" data-id="${p.id}">${esc(p.name)}</span>` : "—"}</td>
        <td>${esc(p ? customerName(p.customer) : "—")}</td>
        <td>${avatars(t.assignees)}</td>
        <td style="text-align:center">${ks.filter((k) => isDone(k.status)).length}/${ks.length}</td>
        <td>${bar(ticketProgress(t.id))}</td>
        <td>${dlCell(t.deadline, t.status)}</td>
        <td>${pill(t.status)}</td>
      </tr>`;
    }).join("");

    const filters = `
    <div class="wk-filters">
      <div class="wk-search">🔍<input placeholder="Tìm theo tên hoặc mã phiếu…" value="${esc(TF.kw)}" data-filter="t.kw"></div>
      <select class="wk-select" data-filter="t.project"><option value="">— Tất cả dự án —</option>${projectOpts(TF.project)}</select>
      <select class="wk-select" data-filter="t.customer"><option value="">— Tất cả khách hàng —</option>${customerOpts(TF.customer)}</select>
      <select class="wk-select" data-filter="t.status"><option value="">— Trạng thái —</option>${opts(STATUS_LIST, TF.status)}</select>
    </div>`;

    return panel(
      `🎫 Danh sách phiếu yêu cầu <span class="wk-pill new">${list.length}/${S.tickets.length}</span>`,
      '<button class="btn btn-primary btn-sm" data-act="new-ticket">＋ Tạo phiếu yêu cầu</button>',
      filters + table(
        "<th>Phiếu yêu cầu</th><th>Dự án</th><th>Khách hàng</th><th>Người xử lý</th><th>Việc</th><th>Tiến độ</th><th>Thời hạn</th><th>Trạng thái</th>",
        rows, "Không có phiếu nào khớp bộ lọc.", 8)
    );
  }

  function vTicketDetail() {
    const t = ticketById(CTX);
    if (!t) return vTickets();
    const p = projectById(t.project);
    const ks = ticketTasks(t.id);

    const rows = ks.map((k) => {
      const last = k.reports.length ? k.reports[k.reports.length - 1] : null;
      return `<tr>
        <td>${esc(k.title)}${ownerLine(k)}</td>
        <td>${whoBadge(k)}</td>
        <td>${fmtD(k.start)}</td>
        <td>${dlCell(k.deadline, k.status)}</td>
        <td>${pill(k.status)}${needsReport(k) ? ' <span class="wk-pill late" title="Đang làm nhưng không có báo cáo mới">im lặng</span>' : ""}</td>
        <td>${bar(k.progress)}</td>
        <td class="wk-muted" style="max-width:220px">${last ? esc(last.note.slice(0, 70)) : "—"}</td>
        <td><div class="wk-cellflex">
          ${k.status === "Chờ duyệt" ? `<button class="wk-minibtn go" data-act="approve" data-id="${k.id}">Duyệt</button><button class="wk-minibtn" data-act="reject" data-id="${k.id}">Trả lại</button>` : ""}
          ${runBtn(k)}
          <button class="wk-minibtn" data-act="report" data-id="${k.id}">Báo cáo</button>
        </div></td>
      </tr>`;
    }).join("");

    const head = `
    <div class="wk-panel">
      <div class="wk-panel-head">
        <h3>#${t.code} — ${esc(t.title)}</h3>${pill(t.status)}${prioTag(t.prio)}
      </div>
      <div class="wk-info">
        <div class="cell"><div class="lbl">Thuộc dự án</div><div class="val">${p ? `<span class="wk-link" data-act="go" data-view="projectDetail" data-id="${p.id}">${esc(p.name)}</span>` : "—"}</div></div>
        <div class="cell"><div class="lbl">Khách hàng</div><div class="val">${esc(p ? customerName(p.customer) : "—")}</div></div>
        <div class="cell"><div class="lbl">Loại phiếu</div><div class="val">${esc(t.type)}</div></div>
        <div class="cell"><div class="lbl">Thời hạn</div><div class="val">${dlCell(t.deadline, t.status)}</div></div>
        <div class="cell"><div class="lbl">Tiến độ (TB các công việc)</div><div class="val">${bar(ticketProgress(t.id))}</div></div>
        <div class="cell full"><div class="lbl">Nội dung yêu cầu</div><div class="val normal">${esc(t.desc)}</div></div>
        <div class="cell full"><div class="lbl">Người xử lý</div><div class="val">${t.assignees.map((a) => `<span class="wk-chip">${esc(staffName(a))}</span>`).join("")}</div></div>
      </div>
    </div>`;

    return crumb([
      { label: "Dự án", view: "projects" },
      ...(p ? [{ label: p.name, view: "projectDetail", id: p.id }] : []),
      { label: `Phiếu #${t.code}` },
    ]) + head + panel(
      `✅ Công việc trong phiếu <span class="wk-pill new">${ks.length}</span>`,
      `<button class="btn btn-primary btn-sm" data-act="new-task" data-ticket="${t.id}">＋ Giao công việc</button>`,
      table(
        "<th>Công việc</th><th>Người thực hiện</th><th>Bắt đầu</th><th>Thời hạn</th><th>Trạng thái</th><th>Tiến độ</th><th>Báo cáo gần nhất</th><th></th>",
        rows, "Chưa có công việc nào trong phiếu này.", 8)
    );
  }

  /* ================= 3. CÔNG VIỆC ================= */
  const SORT_ACCESSOR = {
    title: (k) => k.title,
    executor: (k) => executorLabel(k),
    project: (k) => { const t = ticketById(k.ticket); const p = t && projectById(t.project); return p ? p.name : ""; },
    deadline: (k) => k.deadline || "9999",
    status: (k) => STATUS_LIST.indexOf(k.status),
    progress: (k) => k.progress,
  };

  function filteredTasks() {
    const kw = KF.kw.toLowerCase();
    let list = S.tasks.filter((k) => {
      const t = ticketById(k.ticket);
      return (!KF.executor || executorValue(k) === KF.executor)
        && (!KF.status || k.status === KF.status)
        && (!KF.project || (t && t.project === KF.project))
        && (KF.showDone || !isDone(k.status))
        && (!kw || k.title.toLowerCase().includes(kw));
    });
    if (KF.sortKey && SORT_ACCESSOR[KF.sortKey]) {
      const acc = SORT_ACCESSOR[KF.sortKey];
      list = list.slice().sort((a, b) => {
        const av = acc(a), bv = acc(b);
        const cmp = typeof av === "string" ? av.localeCompare(bv, "vi") : av - bv;
        return cmp * KF.sortDir;
      });
    }
    return list;
  }

  const sortTh = (label, key) =>
    `<th class="sortable" data-act="sort" data-key="${key}">${label}${KF.sortKey === key ? `<span style="color:var(--brand-2)">${KF.sortDir === 1 ? " ▲" : " ▼"}</span>` : ""}</th>`;

  function vTasks() {
    const list = filteredTasks();

    const filters = `
    <div class="wk-filters">
      <div class="wk-search">🔍<input placeholder="Tìm theo tên công việc…" value="${esc(KF.kw)}" data-filter="k.kw"></div>
      <select class="wk-select" data-filter="k.executor"><option value="">— Người thực hiện / Agent —</option>${executorOpts(KF.executor)}</select>
      <select class="wk-select" data-filter="k.project"><option value="">— Tất cả dự án —</option>${projectOpts(KF.project)}</select>
      <select class="wk-select" data-filter="k.status"><option value="">— Trạng thái —</option>${opts(STATUS_LIST, KF.status)}</select>
      <label class="wk-check"><input type="checkbox" data-filter="k.showDone"${KF.showDone ? " checked" : ""}> Hiện việc đã hoàn tất</label>
      <span class="spacer" style="flex:1"></span>
      <span class="wk-seg">
        <button class="${KF.mode === "table" ? "on" : ""}" data-act="mode" data-mode="table">▤ Bảng</button>
        <button class="${KF.mode === "kanban" ? "on" : ""}" data-act="mode" data-mode="kanban">▦ Kanban</button>
      </span>
    </div>`;

    const body = KF.mode === "kanban" ? kanban(list) : table(
      `${sortTh("Công việc", "title")}<th>Phiếu yêu cầu</th>${sortTh("Dự án", "project")}${sortTh("Người thực hiện", "executor")}${sortTh("Thời hạn", "deadline")}${sortTh("Trạng thái", "status")}${sortTh("Tiến độ", "progress")}<th></th>`,
      list.map((k) => {
        const t = ticketById(k.ticket);
        const p = t && projectById(t.project);
        return `<tr>
          <td>${esc(k.title)}${ownerLine(k)}</td>
          <td>${t ? `<span class="wk-link" data-act="go" data-view="ticketDetail" data-id="${t.id}">#${t.code}</span>` : "—"}</td>
          <td>${p ? `<span class="wk-link" data-act="go" data-view="projectDetail" data-id="${p.id}">${esc(p.name)}</span>` : "—"}</td>
          <td>${whoBadge(k)}</td>
          <td>${dlCell(k.deadline, k.status)}</td>
          <td>${pill(k.status)}${needsReport(k) ? ' <span class="wk-pill late" title="Đang làm nhưng không có báo cáo mới">im lặng</span>' : ""}</td>
          <td>${bar(k.progress)}</td>
          <td><div class="wk-cellflex">
            ${k.status === "Chờ duyệt" ? `<button class="wk-minibtn go" data-act="approve" data-id="${k.id}">Duyệt</button>` : ""}
            ${runBtn(k)}
            <button class="wk-minibtn" data-act="report" data-id="${k.id}">Báo cáo</button>
          </div></td>
        </tr>`;
      }).join(""), "Không có công việc nào khớp bộ lọc.", 8);

    return kpiStrip() + panel(
      `✅ Danh sách công việc <span class="wk-pill new">${list.length}/${S.tasks.length}</span>`,
      '<button class="btn btn-primary btn-sm" data-act="new-task">＋ Giao công việc</button>',
      filters + body
    );
  }

  function kanban(list) {
    return `<div class="wk-kanban">${STATUS_LIST.map((st) => {
      const ks = list.filter((k) => k.status === st);
      return `<div class="wk-col" data-col="${esc(st)}">
        <h5>${pill(st)}<span class="n">${ks.length}</span></h5>
        ${ks.map((k) => {
          const t = ticketById(k.ticket);
          return `<div class="wk-card ${isAgentTask(k) ? "agent" : "human"}" draggable="true" data-task="${k.id}" data-act="report" data-id="${k.id}">
            <div class="t">${esc(k.title)}</div>
            <div class="m">${whoBadge(k)}${t ? `<span>#${t.code}</span>` : ""}</div>
            <div class="m">${dlCell(k.deadline, k.status)}<span style="flex:1">${bar(k.progress)}</span></div>
          </div>`;
        }).join("") || '<div class="empty">Trống</div>'}
      </div>`;
    }).join("")}</div>`;
  }

  /* ================= 4. PHÒNG ĐIỀU HÀNH ================= */
  // Một dòng công việc gọn, bấm vào là mở báo cáo
  function taskLi(k, cls) {
    const t = ticketById(k.ticket);
    const p = t && projectById(t.project);
    return `<button class="wk-li ${cls || ""}" data-act="report" data-id="${k.id}">
      <span class="li-main">
        <span class="li-t">${esc(k.title)}</span>
        <span class="li-m">${whoBadge(k)}${p ? `<span>${esc(p.name)}</span>` : ""}${t ? `<span>#${t.code}</span>` : ""}<span>⏱ ${fmtD(k.deadline)}</span></span>
      </span>
      ${bar(k.progress)}
    </button>`;
  }

  const listPanel = (title, items, emptyMsg, cls) =>
    panel(title, "", items.length
      ? `<div class="wk-list">${items.map((k) => taskLi(k, cls)).join("")}</div>`
      : `<div class="wk-empty-ok">✓ ${esc(emptyMsg)}</div>`);

  // Tải công việc: việc người đó tự làm + việc do Agent của họ đảm nhiệm
  function workload() {
    const open = S.tasks.filter((k) => !isDone(k.status));
    return S.staff.map((s) => {
      const own = open.filter((k) => !isAgentTask(k) && k.executor.id === s.id).length;
      const viaAgent = open.filter((k) => isAgentTask(k) && k.owner === s.id).length;
      return { s, own, viaAgent, total: own + viaAgent };
    }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }

  function allReports() {
    const out = [];
    S.tasks.forEach((k) => (k.reports || []).forEach((r, i) => out.push({ k, r, i })));
    return out.sort((a, b) => (a.r.at === b.r.at ? b.i - a.i : (a.r.at < b.r.at ? 1 : -1)));
  }

  function reportLine(entry) {
    const { k, r } = entry;
    const t = ticketById(k.ticket);
    const who = r.byType === "agent"
      ? `🤖 ${esc((agentById(r.agentId) || {}).name || r.agentId)} <span class="wk-owner">(chịu trách nhiệm: ${esc(staffName(r.by))})</span>`
      : esc(staffName(r.by));
    return `<div class="wk-report ${r.byType === "agent" ? "agent" : ""}">
      <b style="font-size:.8rem">${esc(k.title)}</b>${t ? ` <span class="wk-muted" style="font-size:.74rem">#${t.code}</span>` : ""}
      <div>${esc(r.note.length > 320 ? r.note.slice(0, 320) + "…" : r.note)}</div>
      <div class="meta">${fmtD(r.at)} · ${r.progress}%${r.minutes ? ` · ⏱ ${r.minutes} phút` : ""} · ${who}</div>
    </div>`;
  }

  function vControl() {
    const late = S.tasks.filter((k) => isLate(k.deadline, k.status));
    const silent = S.tasks.filter(needsReport);
    const review = S.tasks.filter((k) => k.status === "Chờ duyệt");
    const load = workload();
    const maxLoad = Math.max(1, ...load.map((r) => r.total));
    const recent = allReports().slice(0, 8);

    const loadRows = load.map((r) => `
      <div class="wk-load">
        <span class="nm" title="${esc(r.s.name)}">${esc(r.s.name)}</span>
        <span class="track">
          <i class="human" style="width:${(r.own / maxLoad) * 100}%"></i>
          <i class="agent" style="width:${(r.viaAgent / maxLoad) * 100}%"></i>
        </span>
        <span class="num">${r.total} việc${r.viaAgent ? ` · ${r.viaAgent} qua Agent` : ""}</span>
      </div>`).join("");

    const projRows = S.projects.map((p) => `
      <div class="wk-load">
        <span class="nm" title="${esc(p.name)}">${esc(p.name)}</span>
        <span>${bar(projectProgress(p.id))}</span>
        <span class="num">${projectTickets(p.id).length} phiếu · ${fmtD(p.deadline)}</span>
      </div>`).join("");

    return kpiStrip() + `
      <div class="wk-grid3">
        ${listPanel(`🔴 Trễ hạn <span class="wk-pill late">${late.length}</span>`, late, "Không có việc nào trễ hạn.", "late")}
        ${listPanel(`🟡 Thiếu báo cáo <span class="wk-pill doing">${silent.length}</span>`, silent, "Mọi việc đang chạy đều có báo cáo mới.", "silent")}
        ${listPanel(`🟣 Chờ duyệt <span class="wk-pill review">${review.length}</span>`, review, "Không có kết quả nào chờ duyệt.", "review")}
      </div>
      <div class="wk-grid2">
        ${panel("📊 Tải công việc theo nhân sự", "", `<div class="wk-panel-body">
          <div class="wk-legend"><span><i style="background:var(--brand)"></i>Tự làm</span><span><i style="background:var(--accent)"></i>Giao AI Agent</span></div>
          ${loadRows || '<div class="wk-muted">Chưa có việc nào đang mở.</div>'}
        </div>`)}
        ${panel("📈 Tiến độ dự án", "", `<div class="wk-panel-body">${projRows || '<div class="wk-muted">Chưa có dự án.</div>'}</div>`)}
      </div>
      ${panel("🗒️ Báo cáo gần nhất (người + AI Agent)",
        '<button class="wk-minibtn" data-act="go" data-view="reports">Xem tất cả ›</button>',
        `<div class="wk-panel-body">${recent.length ? recent.map(reportLine).join("") : '<div class="wk-muted">Chưa có báo cáo nào.</div>'}</div>`)}`;
  }

  /* ================= 5. NHÂN SỰ & AGENT ================= */
  let SF = ""; // nhân sự đang chọn

  const agentsOf = (staffId) => agentList().filter((a) => S.agentOwners[a.id] === staffId);
  const agentTasks = (agentId, openOnly) =>
    S.tasks.filter((k) => isAgentTask(k) && k.executor.id === agentId && (!openOnly || !isDone(k.status)));

  function agentCard(a) {
    const open = agentTasks(a.id, true).length;
    return `<div class="wk-agentcard">
      <div class="top">
        <span class="ic">${esc(a.icon || "🤖")}</span>
        <span style="flex:1;min-width:0"><b>${esc(a.name)}</b><span class="mdl">${esc(a.model)}</span></span>
        <span class="wk-pill ${open ? "doing" : "pause"}">${open} việc</span>
      </div>
      <div class="maturity" style="margin-top:.5rem"><span class="bar"><i style="width:${a.maturity}%"></i></span><span>${a.stage} · ${a.maturity}%</span></div>
      <div class="acts">
        <button class="wk-minibtn" data-act="agent-chat" data-agent="${a.id}">💬 Chat</button>
        <button class="wk-minibtn" data-act="agent-profile" data-agent="${a.id}">Hồ sơ & KWSR</button>
      </div>
    </div>`;
  }

  function vStaff() {
    const load = workload();
    const rows = S.staff.map((s) => {
      const open = S.tasks.filter((k) => !isDone(k.status) && (isAgentTask(k) ? k.owner === s.id : k.executor.id === s.id));
      const l = load.find((x) => x.s.id === s.id) || { own: 0, viaAgent: 0 };
      return `<tr class="clickable" data-act="pick-staff" data-id="${s.id}">
        <td><span class="wk-avt" style="margin:0 .5rem 0 0">${esc(initials(s.name))}</span><b>${esc(s.name)}</b><span class="wk-sub">${esc(s.title)}</span></td>
        <td style="text-align:center">${l.own}</td>
        <td style="text-align:center">${l.viaAgent ? `<span class="wk-pill review">${l.viaAgent}</span>` : '<span class="wk-muted">—</span>'}</td>
        <td style="text-align:center">${(() => { const n = open.filter((k) => isLate(k.deadline, k.status)).length; return n ? `<span class="wk-late">${n}</span>` : '<span class="wk-muted">—</span>'; })()}</td>
        <td style="text-align:center">${(() => { const n = open.filter(needsReport).length; return n ? `<span class="wk-pill doing">${n}</span>` : '<span class="wk-muted">—</span>'; })()}</td>
        <td>${agentsOf(s.id).map((a) => `<span class="wk-chip">${esc(a.icon || "🤖")} ${esc(a.name)}</span>`).join("") || '<span class="wk-muted">—</span>'}</td>
        <td><span class="wk-link">Xem chi tiết ›</span></td>
      </tr>`;
    }).join("");

    const table1 = panel("👥 Khối lượng công việc theo nhân sự", "",
      table("<th>Nhân sự</th><th>Tự làm</th><th>Qua Agent</th><th>Trễ</th><th>Im lặng</th><th>Agent chịu trách nhiệm</th><th></th>",
        rows, "Chưa có nhân sự.", 7));

    let detail = "";
    if (SF) {
      const s = staffById(SF);
      const mine = S.tasks.filter((k) => !isDone(k.status) && (isAgentTask(k) ? k.owner === SF : k.executor.id === SF));
      const ags = agentsOf(SF);
      detail = panel(
        `📋 ${esc(s ? s.name : "")} — việc chưa hoàn tất <span class="wk-pill new">${mine.length}</span>`,
        '<button class="wk-minibtn" data-act="pick-staff" data-id="">Đóng</button>',
        (mine.length ? `<div class="wk-list" style="max-height:none">${mine.map((k) => taskLi(k, isLate(k.deadline, k.status) ? "late" : needsReport(k) ? "silent" : "")).join("")}</div>`
          : '<div class="wk-empty-ok">✓ Không còn việc nào đang mở.</div>')
        + `<div class="wk-panel-head" style="border-top:1px solid var(--line)"><h3>🤖 AI Agent do ${esc(s ? s.name : "")} chịu trách nhiệm</h3></div>`
        + (ags.length ? `<div class="wk-agents">${ags.map(agentCard).join("")}</div>`
          : '<div class="wk-panel-body wk-muted">Nhân sự này chưa được giao Agent nào. Khi giao, mọi việc Agent làm sẽ tính vào trách nhiệm của họ.</div>')
      );
    }

    const agentRows = agentList().map((a) => {
      const owner = S.agentOwners[a.id];
      const open = agentTasks(a.id, true);
      return `<tr>
        <td><b>${esc(a.icon || "🤖")} ${esc(a.name)}</b><span class="wk-sub">${esc(a.role)}</span></td>
        <td><span class="badge model">${esc(a.model)}</span></td>
        <td><span class="badge ${a.stage === "Chuyên gia" ? "stage-chuyengia" : a.stage === "Thạo việc" ? "stage-thaoviec" : "stage-hocviec"}">${esc(a.stage)} · ${a.maturity}%</span></td>
        <td>${owner ? `<span class="wk-who human">${esc(staffName(owner))}</span>` : '<span class="wk-late">chưa gán</span>'}</td>
        <td style="text-align:center">${open.length}</td>
        <td><div class="wk-cellflex">
          <button class="wk-minibtn" data-act="agent-chat" data-agent="${a.id}">💬 Chat</button>
          <button class="wk-minibtn" data-act="agent-profile" data-agent="${a.id}">Hồ sơ</button>
        </div></td>
      </tr>`;
    }).join("");

    const table2 = panel("🤖 Đội AI Agent — ai chịu trách nhiệm cho ai", "",
      `<div class="wk-note">Mỗi Agent phải có đúng một nhân sự chịu trách nhiệm. Kết quả Agent làm ra <b>chỉ được đóng khi người đó duyệt</b> — Agent không tự đóng việc của mình.</div>`.replace('class="wk-note"', 'class="wk-note" style="margin:1.1rem 1.1rem 0"')
      + table("<th>Agent</th><th>Model</th><th>Trưởng thành (KWSR)</th><th>Nhân sự chịu trách nhiệm</th><th>Việc đang làm</th><th></th>",
        agentRows, "Chưa nạp được danh sách Agent từ Dashboard.", 6));

    return table1 + detail + table2;
  }

  /* ================= 6. BÁO CÁO ================= */
  const RF = { who: "", project: "", range: "30", type: "" };

  function vReports() {
    const from = RF.range === "all" ? "0000-00-00" : dOff(-Number(RF.range));
    const entries = allReports().filter(({ k, r }) => {
      const t = ticketById(k.ticket);
      return r.at >= from
        && (!RF.type || r.byType === RF.type)
        && (!RF.who || (r.byType === "agent" ? `agent:${r.agentId}` === RF.who : `human:${r.by}` === RF.who))
        && (!RF.project || (t && t.project === RF.project));
    });

    const minutes = entries.reduce((s, e) => s + (e.r.minutes || 0), 0);
    const byAgent = entries.filter((e) => e.r.byType === "agent").length;
    const silent = S.tasks.filter(needsReport);

    const summary = `
    <div class="wk-kpis">
      <div class="wk-kpi"><div class="lbl">Báo cáo</div><div class="val">${entries.length}</div><div class="sub">${RF.range === "all" ? "toàn bộ" : `${RF.range} ngày gần nhất`}</div></div>
      <div class="wk-kpi"><div class="lbl">Thời gian ghi nhận</div><div class="val">${(minutes / 60).toFixed(1)}h</div><div class="sub">${minutes} phút</div></div>
      <div class="wk-kpi agent"><div class="lbl">Do AI Agent</div><div class="val">${byAgent}</div><div class="sub">${entries.length ? Math.round((byAgent / entries.length) * 100) : 0}% số báo cáo</div></div>
      <div class="wk-kpi ${silent.length ? "warn" : "ok"}"><div class="lbl">Việc im lặng</div><div class="val">${silent.length}</div><div class="sub">quá ${REPORT_GRACE_DAYS} ngày không báo cáo</div></div>
      <div class="wk-kpi"><div class="lbl">Người báo cáo</div><div class="val">${new Set(entries.map((e) => e.r.by)).size}</div><div class="sub">có phát sinh báo cáo</div></div>
    </div>`;

    const filters = `
    <div class="wk-filters">
      <select class="wk-select" data-filter="r.who"><option value="">— Tất cả người & Agent —</option>${executorOpts(RF.who)}</select>
      <select class="wk-select" data-filter="r.project"><option value="">— Tất cả dự án —</option>${projectOpts(RF.project)}</select>
      <select class="wk-select" data-filter="r.type"><option value="">— Người & AI —</option><option value="human"${RF.type === "human" ? " selected" : ""}>Chỉ người</option><option value="agent"${RF.type === "agent" ? " selected" : ""}>Chỉ AI Agent</option></select>
      <select class="wk-select" data-filter="r.range">
        <option value="7"${RF.range === "7" ? " selected" : ""}>7 ngày gần nhất</option>
        <option value="30"${RF.range === "30" ? " selected" : ""}>30 ngày gần nhất</option>
        <option value="all"${RF.range === "all" ? " selected" : ""}>Toàn bộ</option>
      </select>
    </div>`;

    // Gom theo ngày
    const days = [];
    entries.forEach((e) => {
      const d = days.find((x) => x.at === e.r.at);
      if (d) d.items.push(e); else days.push({ at: e.r.at, items: [e] });
    });
    const timeline = days.map((d) => `<div class="wk-day"><div class="d">${fmtD(d.at)}${d.at === today() ? " · hôm nay" : ""} — ${d.items.length} báo cáo</div>${d.items.map(reportLine).join("")}</div>`).join("");

    const silentPanel = silent.length ? panel(
      `⚠️ Đang chạy nhưng không có báo cáo <span class="wk-pill doing">${silent.length}</span>`, "",
      `<div class="wk-note warn"><b>Quy ước:</b> việc ở trạng thái "Đang thực hiện" mà quá ${REPORT_GRACE_DAYS} ngày không có báo cáo mới sẽ nằm ở đây — áp dụng cho cả người lẫn AI Agent.</div>`.replace('class="wk-note warn"', 'class="wk-note warn" style="margin:1.1rem 1.1rem 0"')
      + `<div class="wk-list" style="max-height:none">${silent.map((k) => taskLi(k, "silent")).join("")}</div>`) : "";

    return summary + silentPanel + panel(
      `🗒️ Nhật ký báo cáo <span class="wk-pill new">${entries.length}</span>`, "",
      filters + (timeline ? `<div style="padding-bottom:1rem">${timeline}</div>` : '<div class="wk-panel-body wk-muted">Không có báo cáo nào khớp bộ lọc.</div>')
    );
  }

  /* ================= 7. PORTAL KHÁCH HÀNG ================= */
  let PC = ""; // khách hàng đang xem (giả lập)

  function vPortal() {
    if (!PC) {
      const firstPublic = S.projects.find((p) => p.public);
      PC = firstPublic ? firstPublic.customer : (S.customers[0] || {}).id || "";
    }
    const pubs = S.projects.filter((p) => p.customer === PC && p.public);
    const avg = pubs.length ? Math.round(pubs.reduce((s, p) => s + projectProgress(p.id), 0) / pubs.length) : 0;

    const note = `
    <div class="wk-note">
      🌐 <b>Đây là những gì khách hàng nhìn thấy</b> — trang riêng theo đường dẫn cấp cho từng khách, không cần đăng nhập nội bộ.
      Khách chỉ thấy dự án đã bật public, tiến độ và các mốc; <b>không</b> thấy nhân sự nội bộ, không thấy Agent nào chạy, không thấy ghi chú nội bộ hay chi phí.
      &nbsp;Giả lập khách hàng: <select class="wk-select" data-filter="c.pc">${customerOpts(PC)}</select>
    </div>`;

    const body = pubs.length ? pubs.map((p) => {
      const ts = projectTickets(p.id);
      return `<div class="wk-panel">
        <div class="wk-panel-head">
          <h3>${esc(p.name)}</h3>${pill(p.status)}
          <span class="spacer"></span>
          <span style="font-size:.82rem;color:var(--muted)">Dự kiến hoàn thành: <b style="color:var(--text)">${fmtD(p.deadline)}</b></span>
        </div>
        <div class="wk-panel-body">
          <div style="max-width:340px;margin-bottom:.7rem">${bar(projectProgress(p.id))}</div>
          <p style="color:var(--muted);font-size:.86rem;line-height:1.6">${esc(p.desc)}</p>
          <div class="lbl" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:1rem 0 .7rem">Các hạng mục (${ts.length})</div>
          ${ts.map((t) => {
            const tp = ticketProgress(t.id);
            return `<div class="wk-milestone ${tp >= 100 ? "done" : tp > 0 ? "doing" : ""}">
              <div class="dot"></div>
              <div class="line">
                <b>${esc(t.title)}</b> ${pill(t.status)}
                <div style="max-width:260px;margin-top:.45rem">${bar(tp)}</div>
                <span class="sub">Dự kiến: ${fmtD(t.deadline)}</span>
              </div>
            </div>`;
          }).join("") || '<div class="wk-muted">Chưa có hạng mục nào.</div>'}
        </div>
      </div>`;
    }).join("") : `<div class="wk-panel"><div class="wk-panel-body wk-muted">Khách hàng này chưa có dự án nào được bật public. Bật ở trang chi tiết dự án.</div></div>`;

    return note + `
      <div class="wk-hero">
        <h2>Kính gửi ${esc(customerName(PC))}</h2>
        <p>Tiến độ các dự án đang thực hiện cho Quý khách — cập nhật ngày ${fmtD(today())}</p>
        <div class="stats">
          <div><b>${pubs.length}</b><span>Dự án đang theo dõi</span></div>
          <div><b>${pubs.reduce((s, p) => s + projectTickets(p.id).length, 0)}</b><span>Hạng mục công việc</span></div>
          <div><b style="color:var(--ok)">${avg}%</b><span>Mức độ hoàn thành</span></div>
        </div>
      </div>` + body;
  }

  /* ================= 8. LUỒNG NGHIỆP VỤ ================= */
  function vFlow() {
    const model = panel("🧩 Mô hình dữ liệu & người thực hiện", "", `
      <div class="wk-flow">
        <div class="wk-fbox p"><b>📁 Dự án</b><span>Khách hàng · PM · nhân sự · thời hạn · tài liệu</span></div>
        <span class="wk-farr">1 ⟶ n</span>
        <div class="wk-fbox t"><b>🎫 Phiếu yêu cầu</b><span>Nội dung · người xử lý · độ ưu tiên · thời hạn</span></div>
        <span class="wk-farr">1 ⟶ n</span>
        <div class="wk-fbox k"><b>✅ Công việc</b><span>Người thực hiện · tiến độ % · báo cáo</span></div>
      </div>
      <div class="wk-flow" style="padding-top:0">
        <div class="wk-fbox"><b>👤 Nhân sự thực hiện</b><span>Tự làm và tự báo cáo tiến độ</span></div>
        <span class="wk-farr">hoặc</span>
        <div class="wk-fbox a"><b>🤖 AI Agent thực hiện</b><span>Chạy qua Backend Proxy, kết quả thành báo cáo</span></div>
        <span class="wk-farr">⟶</span>
        <div class="wk-fbox"><b>🙋 Nhân sự chịu trách nhiệm</b><span>Luôn là người — duyệt kết quả và đóng việc</span></div>
      </div>
      <div class="wk-panel-body" style="padding-top:0">
        <div class="wk-note"><b>Tiến độ cuộn lên:</b> % công việc → trung bình thành % phiếu yêu cầu → trung bình thành % dự án. Mọi con số trên Phòng điều hành đều tính ngược từ báo cáo thật của từng công việc, không nhập tay ở cấp trên.</div>
      </div>`);

    const steps = [
      ["Khởi tạo dự án", "PM tạo dự án: chọn khách hàng, nhập nội dung, thời hạn, gán PM và nhân sự, đính kèm hợp đồng/SRS/design."],
      ["Tiếp nhận yêu cầu", "Yêu cầu từ khách hàng hoặc nội bộ được lập thành phiếu và gắn vào đúng dự án. Khách hàng được kế thừa từ dự án cha."],
      ["Tách việc & giao người", "Người xử lý phiếu tách thành các công việc, giao cho từng nhân sự với thời hạn riêng. Nhiều việc chạy song song trong một phiếu."],
      ["Hoặc giao cho AI Agent", "Việc nào Agent làm được thì bấm “🤖 Giao Agent”. Hệ thống gợi ý Agent theo từ khóa nghiệp vụ và tự gán nhân sự chịu trách nhiệm theo bảng phân công Agent."],
      ["Agent thực thi", "Ngữ cảnh (dự án · phiếu · việc · Global Rule · Rule riêng của Agent) được gửi tới Agent qua Backend Proxy. Kết quả trả về được ghi thành báo cáo, việc chuyển “Chờ duyệt”."],
      ["Báo cáo tiến độ", "Người tự nhập % và ghi chú; Agent sinh báo cáo tự động. Cùng một dòng thời gian, cùng định dạng. Việc đang chạy mà quá " + REPORT_GRACE_DAYS + " ngày không có báo cáo bị gắn nhãn “im lặng”."],
      ["Nghiệm thu & đóng việc", "Người chịu trách nhiệm duyệt kết quả mới đóng được việc. Agent không bao giờ tự đóng việc của mình."],
      ["Giám sát & công khai", "PM theo dõi roll-up ở Phòng điều hành, phát hiện quá tải và trễ hạn. Dự án bật public sinh trang riêng cho khách hàng xem tiến độ."],
    ];

    const flowSteps = panel("🔄 Luồng vận hành", "", `<div class="wk-steps-num">${steps.map(([t, d]) => `<div class="wk-stepitem"><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join("")}</div>`);

    const matrix = panel("📐 Ma trận trạng thái", "", table(
      "<th>Đối tượng</th><th>Trạng thái</th><th>Điều kiện chuyển</th>",
      `<tr><td><b>Dự án</b></td><td>${["Mới", "Đang thực hiện", "Tạm dừng", "Hoàn tất"].map(pill).join(" ")}</td><td>Hoàn tất khi mọi phiếu đã đóng và PM xác nhận nghiệm thu</td></tr>
       <tr><td><b>Phiếu yêu cầu</b></td><td>${["Mới", "Đang thực hiện", "Tạm dừng", "Hoàn tất"].map(pill).join(" ")}</td><td>Hoàn tất khi mọi công việc đạt 100% và người xử lý đóng phiếu</td></tr>
       <tr><td><b>Công việc</b></td><td>${STATUS_LIST.map(pill).join(" ")}</td><td><b>Chờ duyệt</b> chỉ dành cho kết quả cần nghiệm thu — thường là việc do AI Agent làm. Hoàn tất khi người chịu trách nhiệm bấm Duyệt</td></tr>`,
      "", 3));

    const rules = panel("🛡️ Quy ước kiểm soát", "", `<div class="wk-panel-body">
      <div class="wk-stepitem" style="grid-template-columns:1fr;border:0;padding-top:0"><div><b>Agent không tự đóng việc</b><p>Mọi kết quả Agent trả về đều dừng ở “Chờ duyệt”. Người chịu trách nhiệm là chốt chặn cuối cùng — đây là lý do mỗi Agent bắt buộc có đúng một nhân sự phụ trách.</p></div></div>
      <div class="wk-stepitem" style="grid-template-columns:1fr;border:0"><div><b>Báo cáo áp dụng cho cả người lẫn máy</b><p>Không có ngoại lệ. Agent chạy xong ghi báo cáo; người làm tay cũng phải ghi. Việc im lặng quá ${REPORT_GRACE_DAYS} ngày hiện ở Phòng điều hành và trang Báo cáo.</p></div></div>
      <div class="wk-stepitem" style="grid-template-columns:1fr;border:0"><div><b>Rule đi theo Agent vào từng lệnh</b><p>Global Rule toàn công ty và Rule riêng của Agent được nhét vào ngữ cảnh mỗi lần chạy — xem trước được toàn văn trước khi bấm chạy.</p></div></div>
      <div class="wk-stepitem" style="grid-template-columns:1fr;border:0;padding-bottom:0"><div><b>Khách hàng chỉ thấy phần được mở</b><p>Portal khách hàng hiện tên dự án, nội dung, tiến độ và mốc thời gian. Không lộ nhân sự, không lộ việc Agent nào đã chạy, không lộ ghi chú nội bộ.</p></div></div>
    </div>`);

    return model + flowSteps + matrix + rules;
  }

  /* ================= 9. LEAD — KHÁCH & PARTNER TIỀM NĂNG =================
     Kho liên hệ thu được từ mạng xã hội. Một Lead luôn phải có ít nhất một cách
     liên hệ (số điện thoại hoặc email) — không có thì không phải Lead.
  ========================================================================= */

  const LEAD_TYPES = { khach: "Khách tiềm năng", partner: "Partner tiềm năng", chua_ro: "Chưa rõ" };
  const LEAD_SERVICES = {
    xe: "🚐 Xe & vận chuyển", homestay: "🏡 Homestay & lưu trú", "quan-an": "🍜 Quán ăn & nhà hàng",
    tour: "🧭 Tour & vé", "spa-lam-dep": "💆 Spa & làm đẹp", khac: "📦 Khác",
  };
  const LEAD_STATUS = { moi: "Mới", da_lien_he: "Đã liên hệ", da_moi: "Đã mời", quan_tam: "Quan tâm", tu_choi: "Từ chối", da_chot: "Đã chốt" };
  const LEAD_STCLASS = { moi: "new", da_lien_he: "doing", da_moi: "review", quan_tam: "doing", tu_choi: "pause", da_chot: "done" };
  const LEAD_CHANNELS = ["Zalo", "Gọi điện", "SMS", "Email", "Messenger", "Gặp trực tiếp"];

  const leadById = (id) => S.leads.find((l) => l.id === id) || null;
  const leadStPill = (st) => `<span class="wk-pill ${LEAD_STCLASS[st] || "new"}">${esc(LEAD_STATUS[st] || st)}</span>`;
  const leadTypeTag = (t) => `<span class="wk-tag ${t === "partner" ? "partner" : t === "khach" ? "khach" : ""}">${esc(LEAD_TYPES[t] || t)}</span>`;
  const leadSvcTag = (s) => `<span class="wk-tag svc">${esc(LEAD_SERVICES[s] || s)}</span>`;

  // Chuẩn hóa số Việt Nam để so trùng: +84/84 → 0, bỏ mọi ký tự ngăn cách.
  function normPhone(raw) {
    let d = String(raw || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+84")) d = "0" + d.slice(3);
    else if (/^84\d{9,10}$/.test(d)) d = "0" + d.slice(2);
    return /^0\d{8,10}$/.test(d) ? d : "";
  }
  const leadKey = (l) => normPhone(l.sdt) || String(l.email || "").toLowerCase().trim() || (String(l.ten || "") + "|" + String(l.comment || "").slice(0, 40)).toLowerCase();

  // Gộp danh sách lead mới vào kho, bỏ qua bản trùng (cùng số điện thoại / email).
  function mergeLeads(list, meta) {
    const existing = new Set(S.leads.map(leadKey));
    let added = 0, dup = 0;
    list.forEach((raw) => {
      const l = {
        id: newId("l"),
        ten: String(raw.ten || "").trim(),
        sdt: normPhone(raw.sdt),
        sdt_khac: (raw.sdt_khac || []).map(normPhone).filter(Boolean),
        email: String(raw.email || "").toLowerCase().trim(),
        nguon: raw.nguon || (meta && meta.nguon) || "",
        nguon_loai: /facebook\.com/i.test(raw.nguon || (meta && meta.nguon) || "") ? "facebook" : (meta && meta.nguon_loai) || "khac",
        comment: String(raw.comment || "").trim(),
        nhu_cau: String(raw.nhu_cau || "").trim(),
        loai: LEAD_TYPES[raw.loai] ? raw.loai : "chua_ro",
        dich_vu: LEAD_SERVICES[raw.dich_vu] ? raw.dich_vu : "khac",
        trang_thai: "moi",
        kenh_moi: [],
        do_tin_cay: raw.do_tin_cay || "thap",
        can_nguoi_xac_nhan: raw.can_nguoi_xac_nhan !== false,
        cach_boc_tach: raw.cach_boc_tach || "regex",
        phu_trach: (meta && meta.phu_trach) || S.agentOwners[LEAD_AGENT] || S.staff[0].id,
        ticket: (meta && meta.ticket) || null,
        at: today(),
        ghi_chu: "",
      };
      if (!l.sdt && !l.email) return; // không có cách liên hệ → bỏ
      const key = leadKey(l);
      if (existing.has(key)) { dup++; return; }
      existing.add(key);
      S.leads.push(l);
      added++;
    });
    save();
    return { added, dup };
  }

  const LF = { kw: "", loai: "", dich_vu: "", trang_thai: "", nguon: "" };

  function filteredLeads() {
    const kw = LF.kw.toLowerCase();
    return S.leads.filter((l) =>
      (!LF.loai || l.loai === LF.loai)
      && (!LF.dich_vu || l.dich_vu === LF.dich_vu)
      && (!LF.trang_thai || l.trang_thai === LF.trang_thai)
      && (!LF.nguon || (l.nguon_loai || "khac") === LF.nguon)
      && (!kw || [l.ten, l.sdt, l.email, l.comment, l.nhu_cau].join(" ").toLowerCase().includes(kw))
    );
  }

  function vLeads() {
    const list = filteredLeads();
    const khach = S.leads.filter((l) => l.loai === "khach").length;
    const partner = S.leads.filter((l) => l.loai === "partner").length;
    const chuaMoi = S.leads.filter((l) => l.trang_thai === "moi").length;
    const canRa = S.leads.filter((l) => l.can_nguoi_xac_nhan).length;

    const kpis = `
    <div class="wk-kpis">
      <div class="wk-kpi"><div class="lbl">Tổng Lead</div><div class="val">${S.leads.length}</div><div class="sub">${list.length} khớp bộ lọc</div></div>
      <div class="wk-kpi"><div class="lbl">Khách tiềm năng</div><div class="val">${khach}</div><div class="sub">đang có nhu cầu</div></div>
      <div class="wk-kpi agent"><div class="lbl">Partner tiềm năng</div><div class="val">${partner}</div><div class="sub">có dịch vụ để mời hợp tác</div></div>
      <div class="wk-kpi ${chuaMoi ? "warn" : "ok"}"><div class="lbl">Chưa liên hệ</div><div class="val">${chuaMoi}</div><div class="sub">còn ở trạng thái "Mới"</div></div>
      <div class="wk-kpi ${canRa ? "warn" : "ok"}"><div class="lbl">Cần người rà lại</div><div class="val">${canRa}</div><div class="sub">Agent bóc tách độ tin cậy thấp</div></div>
    </div>`;

    const rows = list.map((l) => `
      <tr class="clickable" data-act="lead-detail" data-id="${l.id}">
        <td><b>${esc(l.ten || "(chưa có tên)")}</b>${l.can_nguoi_xac_nhan ? ' <span class="wk-pill late" title="Agent chưa chắc chắn — cần người xác nhận">cần rà</span>' : ""}<span class="wk-sub">${fmtD(l.at)} · ${esc(staffName(l.phu_trach))}</span></td>
        <td>${l.sdt ? `<span class="wk-mono">${esc(l.sdt)}</span>` : '<span class="wk-muted">—</span>'}${l.sdt_khac && l.sdt_khac.length ? `<span class="wk-sub">+${l.sdt_khac.length} số khác</span>` : ""}</td>
        <td>${l.email ? esc(l.email) : '<span class="wk-muted">—</span>'}</td>
        <td>${l.nguon ? (/^https?:/i.test(l.nguon)
          ? `<a class="wk-link" href="${esc(l.nguon)}" target="_blank" rel="noopener" title="${esc(l.nguon)}">${l.nguon_loai === "facebook" ? "Facebook" : "Link nguồn"} ↗</a>`
          : esc(l.nguon)) : '<span class="wk-muted">—</span>'}</td>
        <td class="wk-cmt" title="${esc(l.comment)}">${esc(l.comment.slice(0, 110))}${l.comment.length > 110 ? "…" : ""}${l.nhu_cau ? `<span class="wk-sub">→ ${esc(l.nhu_cau)}</span>` : ""}</td>
        <td>${leadTypeTag(l.loai)}</td>
        <td>${leadSvcTag(l.dich_vu)}</td>
        <td>${leadStPill(l.trang_thai)}${l.kenh_moi && l.kenh_moi.length ? `<span class="wk-sub">${esc(l.kenh_moi[l.kenh_moi.length - 1].kenh)}</span>` : ""}</td>
        <td><div class="wk-cellflex">
          <button class="wk-minibtn go" data-act="lead-invite" data-id="${l.id}" title="Ghi nhận đã mời qua một kênh">✉ Mời</button>
          <button class="wk-minibtn" data-act="lead-detail" data-id="${l.id}">Sửa</button>
        </div></td>
      </tr>`).join("");

    const filters = `
    <div class="wk-filters">
      <div class="wk-search">🔍<input placeholder="Tìm theo tên, số điện thoại, nội dung…" value="${esc(LF.kw)}" data-filter="l.kw"></div>
      <select class="wk-select" data-filter="l.loai"><option value="">— Tất cả loại —</option>${Object.entries(LEAD_TYPES).map(([k, v]) => `<option value="${k}"${LF.loai === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <select class="wk-select" data-filter="l.dich_vu"><option value="">— Tất cả dịch vụ —</option>${Object.entries(LEAD_SERVICES).map(([k, v]) => `<option value="${k}"${LF.dich_vu === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <select class="wk-select" data-filter="l.trang_thai"><option value="">— Trạng thái —</option>${Object.entries(LEAD_STATUS).map(([k, v]) => `<option value="${k}"${LF.trang_thai === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <select class="wk-select" data-filter="l.nguon"><option value="">— Nguồn —</option><option value="facebook"${LF.nguon === "facebook" ? " selected" : ""}>Facebook</option><option value="thu-cong"${LF.nguon === "thu-cong" ? " selected" : ""}>Nhập/dán tay</option><option value="khac"${LF.nguon === "khac" ? " selected" : ""}>Khác</option></select>
    </div>`;

    const note = `<div class="wk-note" style="margin:1.1rem 1.1rem 0">
      <b>Lead vào kho bằng hai đường:</b> Agent <b>🧲 Lead Hunter</b> bóc tách từ link bài viết/bình luận, hoặc người nhập tay.
      Số điện thoại và email chỉ được ghi khi <b>xuất hiện nguyên văn trong nguồn</b> — Agent không được suy đoán.
      Lead gắn nhãn <span class="wk-pill late">cần rà</span> là những bản Agent chưa chắc chắn, phải có người xác nhận trước khi đem đi mời.
    </div>`;

    const acts = `
      <button class="btn btn-primary btn-sm" data-act="lead-harvest">🧲 Thu thập từ link</button>
      <button class="btn btn-ghost btn-sm" data-act="lead-new">＋ Thêm Lead</button>
      <button class="btn btn-ghost btn-sm" data-act="lead-csv" title="Tải file CSV mở được bằng Excel">⬇ CSV</button>
      <button class="btn btn-ghost btn-sm" data-act="lead-backup" title="Ghi danh sách Lead xuống sales/data/leads/leads.json trên máy chủ">☁ Sao lưu</button>
      <button class="btn btn-ghost btn-sm" data-act="lead-restore" title="Nạp lại danh sách Lead đã sao lưu trên máy chủ">↧ Khôi phục</button>`;

    return kpis + panel(
      `🧲 Kho Lead <span class="wk-pill new">${list.length}/${S.leads.length}</span>`, acts,
      note + filters + table(
        "<th>Tên khách hàng</th><th>Số điện thoại</th><th>Email</th><th>Nguồn</th><th>Nội dung comment</th><th>Loại</th><th>Phân loại dịch vụ</th><th>Trạng thái</th><th></th>",
        rows, "Chưa có Lead nào khớp bộ lọc. Bấm “🧲 Thu thập từ link” để Agent quét bình luận.", 9)
    );
  }

  // ---- Thêm / sửa một Lead ----
  function leadForm(l) {
    const sel = (id, map, cur) => `<select id="${id}">${Object.entries(map).map(([k, v]) => `<option value="${k}"${cur === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
    return `
      <div class="hr-intake-form"><div class="hr-grid">
        <label>Tên khách hàng<input type="text" id="wk_l_ten" value="${esc(l.ten || "")}" placeholder="VD: Trần Minh Khoa"></label>
        <label>Số điện thoại<input type="text" id="wk_l_sdt" value="${esc(l.sdt || "")}" placeholder="09xxxxxxxx"></label>
        <label>Email<input type="text" id="wk_l_email" value="${esc(l.email || "")}" placeholder="ten@email.com"></label>
        <label>Người phụ trách<select id="wk_l_ph">${staffOpts(l.phu_trach || S.agentOwners[LEAD_AGENT])}</select></label>
        <label class="span2">Nguồn<input type="text" id="wk_l_nguon" value="${esc(l.nguon || "")}" placeholder="Dán link bài viết Facebook hoặc ghi nguồn"></label>
        <label class="span2">Nội dung comment<textarea id="wk_l_cmt" placeholder="Nguyên văn bình luận của người này">${esc(l.comment || "")}</textarea></label>
        <label class="span2">Nhu cầu / dịch vụ họ cung cấp<input type="text" id="wk_l_nc" value="${esc(l.nhu_cau || "")}" placeholder="Tóm tắt một câu"></label>
        <label>Loại${sel("wk_l_loai", LEAD_TYPES, l.loai || "chua_ro")}</label>
        <label>Phân loại dịch vụ${sel("wk_l_dv", LEAD_SERVICES, l.dich_vu || "khac")}</label>
        <label>Trạng thái${sel("wk_l_st", LEAD_STATUS, l.trang_thai || "moi")}</label>
        <label class="wk-check-cell">Đã người xác nhận<select id="wk_l_ok"><option value="1"${l.can_nguoi_xac_nhan ? "" : " selected"}>Đã xác nhận</option><option value="0"${l.can_nguoi_xac_nhan ? " selected" : ""}>Chưa — cần rà lại</option></select></label>
        <label class="span2">Ghi chú nội bộ<textarea id="wk_l_note" placeholder="Ghi chú khi gọi, kết quả trao đổi…">${esc(l.ghi_chu || "")}</textarea></label>
      </div>`;
  }

  function mNewLead() {
    openModal(modalHead("🧲", "Thêm Lead thủ công", "Dùng khi bạn có số điện thoại từ nguồn khác (gọi đến, danh thiếp, hội chợ). Phải có ít nhất số điện thoại hoặc email.")
      + leadForm({ nguon: "Dán tay", can_nguoi_xac_nhan: false }) + modalFoot("lead-save", "Lưu Lead") + "</div>");
  }

  function mLeadDetail(id) {
    const l = leadById(id);
    if (!l) return;
    const history = (l.kenh_moi || []).length
      ? `<h4 style="margin-top:1rem">Lịch sử mời</h4>` + l.kenh_moi.slice().reverse().map((m) => `
          <div class="wk-report">${esc(m.note || "(không ghi chú)")}<div class="meta">${fmtD(m.at)} · kênh ${esc(m.kenh)}</div></div>`).join("")
      : "";
    const meta = `<div class="wk-note">Bóc tách bằng <b>${l.cach_boc_tach === "llm" ? "mô hình ngôn ngữ + đối chiếu regex" : l.cach_boc_tach === "regex" ? "regex tất định" : "nhập tay"}</b> · độ tin cậy <b>${esc(l.do_tin_cay || "—")}</b>${l.ticket ? ` · từ phiếu <b>#${(ticketById(l.ticket) || {}).code || "?"}</b>` : ""}</div>`;
    openModal(modalHead("🧲", l.ten || "Lead chưa có tên", `${esc(l.sdt || l.email || "—")} · ${esc(LEAD_TYPES[l.loai] || "")}`)
      + meta.replace('class="wk-note"', 'class="wk-note" style="margin:0 0 1rem"')
      + leadForm(l) + history + `
      <div class="bf-actions" style="margin-top:1.2rem">
        <button class="btn btn-ghost btn-sm" type="button" data-act="lead-delete" data-id="${l.id}" style="margin-right:auto;color:var(--danger)">🗑 Xóa Lead</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Hủy</button>
        <button class="btn btn-primary btn-sm" type="button" data-act="lead-save" data-id="${l.id}">Lưu thay đổi</button>
      </div></div>`);
  }

  function saveLead(id) {
    const sdt = normPhone(val("wk_l_sdt"));
    const rawSdt = val("wk_l_sdt");
    const email = val("wk_l_email").toLowerCase();
    if (rawSdt && !sdt) return say("Số điện thoại không đúng định dạng Việt Nam");
    if (!sdt && !email) return say("Lead phải có ít nhất số điện thoại hoặc email");
    const patch = {
      ten: val("wk_l_ten"), sdt, email,
      nguon: val("wk_l_nguon"), comment: val("wk_l_cmt"), nhu_cau: val("wk_l_nc"),
      loai: val("wk_l_loai"), dich_vu: val("wk_l_dv"), trang_thai: val("wk_l_st"),
      phu_trach: val("wk_l_ph"), ghi_chu: val("wk_l_note"),
      can_nguoi_xac_nhan: val("wk_l_ok") === "0",
    };
    patch.nguon_loai = /facebook\.com/i.test(patch.nguon) ? "facebook" : patch.nguon === "Dán tay" ? "thu-cong" : "khac";
    const cur = id ? leadById(id) : null;
    if (cur) Object.assign(cur, patch);
    else S.leads.push(Object.assign({ id: newId("l"), sdt_khac: [], kenh_moi: [], do_tin_cay: "cao", cach_boc_tach: "thu-cong", ticket: null, at: today() }, patch));
    save(); closeModal(); render();
    say(cur ? "Đã cập nhật Lead ✓" : "Đã thêm Lead ✓");
  }

  function deleteLead(id) {
    const l = leadById(id);
    if (!l) return;
    if (!confirm(`Xóa Lead "${l.ten || l.sdt || l.email}"? Thao tác này không hoàn tác được.`)) return;
    S.leads = S.leads.filter((x) => x.id !== id);
    save(); closeModal(); render(); say("Đã xóa Lead");
  }

  // ---- Ghi nhận đã mời qua một kênh ----
  function mLeadInvite(id) {
    const l = leadById(id);
    if (!l) return;
    const goi = l.loai === "partner"
      ? "Mời hợp tác: giới thiệu chương trình partner, chính sách hoa hồng, cách đưa dịch vụ lên hệ thống."
      : "Mời sử dụng dịch vụ: báo giá theo đúng nhu cầu họ nêu trong bình luận, kèm ưu đãi nếu có.";
    openModal(modalHead("✉️", "Ghi nhận đã mời", `${esc(l.ten || l.sdt || l.email)} · ${esc(LEAD_TYPES[l.loai] || "")}`) + `
      <div class="hr-intake-form">
        <div class="wk-note"><b>Gợi ý nội dung:</b> ${esc(goi)}<br>Nguyên văn bình luận: “${esc(l.comment.slice(0, 200))}${l.comment.length > 200 ? "…" : ""}”</div>
        <div class="hr-grid">
          <label>Kênh đã mời <span class="req">*</span><select id="wk_li_kenh">${LEAD_CHANNELS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></label>
          <label>Trạng thái sau khi mời<select id="wk_li_st">${Object.entries(LEAD_STATUS).map(([k, v]) => `<option value="${k}"${k === "da_moi" ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
          <label class="span2">Ghi chú<textarea id="wk_li_note" placeholder="Nội dung đã gửi, phản hồi của họ…"></textarea></label>
        </div>
        <p class="bf-hint" style="margin:.7rem 0 0">AI OS <b>không tự nhắn tin cho Lead</b>. Bạn gửi bằng kênh của mình rồi ghi nhận lại ở đây để không mời trùng.</p>`
      + modalFoot("lead-invite-save", "Ghi nhận") + `<input type="hidden" id="wk_li_id" value="${l.id}"></div>`);
  }

  function saveLeadInvite() {
    const l = leadById(val("wk_li_id"));
    if (!l) return;
    l.kenh_moi = l.kenh_moi || [];
    l.kenh_moi.push({ kenh: val("wk_li_kenh"), at: today(), note: val("wk_li_note") });
    l.trang_thai = val("wk_li_st");
    save(); closeModal(); render(); say(`Đã ghi nhận mời qua ${l.kenh_moi[l.kenh_moi.length - 1].kenh} ✓`);
  }

  // ---- Xuất CSV (BOM để Excel đọc đúng tiếng Việt) ----
  function exportLeadsCsv() {
    const list = filteredLeads();
    if (!list.length) return say("Không có Lead nào để xuất");
    const cols = ["Tên khách hàng", "Số điện thoại", "Email", "Nguồn", "Nội dung comment", "Nhu cầu", "Loại", "Phân loại dịch vụ", "Trạng thái", "Kênh đã mời", "Người phụ trách", "Ngày ghi nhận", "Ghi chú"];
    const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [cols.map(cell).join(",")].concat(list.map((l) => [
      l.ten, l.sdt ? `'${l.sdt}` : "", l.email, l.nguon, l.comment, l.nhu_cau,
      LEAD_TYPES[l.loai] || l.loai, LEAD_SERVICES[l.dich_vu] || l.dich_vu, LEAD_STATUS[l.trang_thai] || l.trang_thai,
      (l.kenh_moi || []).map((m) => m.kenh).join(" / "), staffName(l.phu_trach), fmtD(l.at), l.ghi_chu,
    ].map(cell).join(",")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lead-aios-${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say(`Đã xuất ${list.length} Lead ra CSV ✓`);
  }

  // ---- Sao lưu / khôi phục qua Backend Proxy ----
  async function backupLeads() {
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/sales/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: S.leads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Máy chủ trả lỗi ${res.status}`);
      say(`Đã sao lưu ${data.count} Lead vào ${data.file} ✓`);
    } catch (e) {
      say(`Không sao lưu được: ${e.message}. Backend Proxy đã chạy chưa (server/server.js)?`);
    }
  }

  async function restoreLeads() {
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/sales/leads`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Máy chủ trả lỗi ${res.status}`);
      if (!data.leads || !data.leads.length) return say("Trên máy chủ chưa có bản sao lưu Lead nào");
      const { added, dup } = mergeLeads(data.leads, { nguon_loai: "khac" });
      render();
      say(`Khôi phục: thêm ${added} Lead mới, bỏ qua ${dup} bản đã có`);
    } catch (e) {
      say(`Không khôi phục được: ${e.message}`);
    }
  }

  /* ========== PIPELINE THU THẬP LEAD (Agent sales-2) ==========
     S1 tải nội dung nguồn (deterministic, qua Backend Proxy vì trình duyệt bị CORS chặn)
     S2 bóc tách & phân loại → ghi thẳng vào kho Lead.
     Nguồn bị chặn hoặc không bóc được thì DỪNG và nói rõ, không tự bịa Lead.
  ============================================================== */

  const LEAD_AGENT = "sales-2";
  const LEAD_PROJECT_NAME = "Kinh doanh — Thu thập Lead";

  function ensureLeadProject() {
    let p = S.projects.find((x) => x.name === LEAD_PROJECT_NAME);
    if (p) return p;
    const pm = S.agentOwners[LEAD_AGENT] || S.staff[0].id;
    p = {
      id: newId("p"), name: LEAD_PROJECT_NAME,
      customer: (S.customers[0] || {}).id, pm, members: [pm],
      start: today(), deadline: dOff(90), status: "Đang thực hiện",
      desc: "Dự án thường trực chứa các phiếu thu thập Lead từ mạng xã hội do Lead Hunter Agent thực hiện.",
      docs: [], public: false,
    };
    S.projects.push(p);
    return p;
  }

  // Ghi kết quả một bước deterministic thành báo cáo của Agent (không qua LLM).
  function agentStepReport(k, ok, note, progress, minutes) {
    k.progress = progress;
    k.status = ok ? "Chờ duyệt" : "Tạm dừng";
    k.run = { status: ok ? "done" : "failed", agentId: k.executor.id, output: note, endedAt: new Date().toISOString() };
    k.reports.push({ at: today(), progress, note, by: k.owner, byType: "agent", agentId: k.executor.id, minutes: minutes || 1 });
    save();
  }

  async function startLeadHarvest(url, rawText) {
    const src = String(url || "").trim();
    const pasted = String(rawText || "").trim();
    if (!src && !pasted) return say("Cần link nguồn hoặc nội dung dán tay");
    PIPE_LOG.length = 0;

    const p = ensureLeadProject();
    const maxCode = S.tickets.reduce((m, t) => Math.max(m, t.code || 0), 49000);
    const owner = S.agentOwners[LEAD_AGENT] || S.staff[0].id;
    const ticket = {
      id: newId("t"), code: maxCode + 1,
      title: `Thu thập Lead: ${(src || "nội dung dán tay").slice(0, 80)}`,
      project: p.id, type: "Tư vấn & khảo sát",
      status: "Đang thực hiện", prio: "Cao", deadline: dOff(2), assignees: [owner],
      desc: `Quét bình luận từ nguồn: ${src || "(người dùng dán nội dung trực tiếp)"}\nBóc tách tên · số điện thoại · email · nội dung bình luận, phân loại khách/partner tiềm năng và nhóm dịch vụ, ghi vào kho Lead.`,
    };
    S.tickets.push(ticket);
    save(); render();
    if (typeof addFeed === "function") addFeed(`<b>Orches</b> mở phiếu <b>#${ticket.code}</b> "Thu thập Lead" và giao Lead Hunter Agent.`, "f-orches");

    openModal(modalHead("🧲", `Thu thập Lead — phiếu #${ticket.code}`, esc((src || "nội dung dán tay").slice(0, 120))) + `
      <div class="hr-intake-form">
        <div class="wk-note">Agent chỉ ghi số điện thoại/email <b>có nguyên văn trong nguồn</b>. Nguồn bị chặn thì dừng và báo rõ — không suy đoán bình luận.</div>
        <div id="wk_pipe_log" class="wk-steps" style="max-height:320px;overflow-y:auto"></div>
        <div class="bf-actions" style="margin-top:1rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Đóng</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="go" data-view="ticketDetail" data-id="${ticket.id}">Mở phiếu #${ticket.code}</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="go" data-view="leads">Xem kho Lead</button>
        </div>
      </div>`);
    pipeLog("📋", `Đã tạo phiếu #${ticket.code} trong dự án "${p.name}"`);

    // Nguồn được gắn vào từng công việc để chạy lại đúng đầu vào cũ, không phải nhớ lại.
    // Cắt bớt phần dán tay cho vừa localStorage — vẫn đủ dài cho một trang bình luận.
    const leadSrc = { url: src, pasted: pasted.slice(0, 20000) };
    const tagLead = (k) => { k.engine = "lead-harvest"; k.leadSrc = leadSrc; return k; };

    // ---- S1: lấy nội dung nguồn ----
    const k1 = tagLead(addAgentTask(ticket.id, "S1 · Tải nội dung nguồn", LEAD_AGENT));
    save(); render();
    let text = pasted;
    if (pasted) {
      pipeLog("📄", `Dùng nội dung bạn dán (${pasted.length} ký tự) — không cần gọi mạng`);
      agentStepReport(k1, true, `Dùng nội dung người dùng dán trực tiếp: ${pasted.length} ký tự. Không gọi ra ngoài mạng.`, 100);
    } else {
      pipeLog("🌐", `Đang tải nguồn: ${src}`);
      try {
        const res = await fetch(`${WORK_PROXY_BASE}/api/sales/fetch`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: src }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Máy chủ trả lỗi ${res.status}`);
        if (!data.ok) {
          const note = `⚠️ Không lấy được nội dung từ ${src}.\n${data.note || ""}\nĐã thử: ${(data.tried || []).map((t) => `${t.url} → ${t.error || t.status}`).join(" | ")}`;
          agentStepReport(k1, false, note, 40);
          pipeLog("⛔", "Nguồn bị chặn — dừng lại, không bịa dữ liệu");
          const kx = tagLead(addAgentTask(ticket.id, "⚠️ Cần người dán nội dung bình luận", LEAD_AGENT, "Cao"));
          kx.status = "Chờ duyệt";
          kx.reports.push({
            at: today(), progress: 0, by: kx.owner, byType: "agent", agentId: LEAD_AGENT,
            note: "Mở bài viết bằng tài khoản của bạn → bấm 'Xem thêm bình luận' cho hết → bôi đen toàn bộ phần bình luận → chạy lại '🧲 Thu thập từ link' và dán vào ô 'Nội dung dán tay'.",
          });
          ticket.status = "Tạm dừng";
          ticket.desc += `\n\n— Dừng ở S1 ${fmtD(today())}: nguồn không tải được. ${data.note || ""}`;
          save(); render();
          say("Nguồn bị chặn — xem hướng dẫn trong phiếu");
          return ticket;
        }
        text = data.text;
        agentStepReport(k1, true, `Tải được ${data.chars} ký tự từ ${data.url}.` + (data.note ? `\n⚠️ ${data.note}` : ""), 100);
        pipeLog("✅", `Tải xong ${data.chars} ký tự`);
        if (data.note) pipeLog("⚠️", data.note);
      } catch (e) {
        agentStepReport(k1, false, `⚠️ Không gọi được Backend Proxy: ${e.message}. Chạy "node server/server.js" rồi thử lại, hoặc dán nội dung bình luận trực tiếp.`, 10);
        pipeLog("⛔", `Lỗi kết nối máy chủ: ${e.message}`);
        ticket.status = "Tạm dừng";
        save(); render();
        say("Không gọi được Backend Proxy");
        return ticket;
      }
    }

    // ---- S2: bóc tách & phân loại ----
    const k2 = tagLead(addAgentTask(ticket.id, "S2 · Bóc tách & phân loại Lead", LEAD_AGENT));
    save(); render();
    pipeLog("🔎", `Đang bóc tách bằng ${agentById(LEAD_AGENT) ? agentById(LEAD_AGENT).name : LEAD_AGENT}…`);
    let out;
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/sales/extract`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url: src }),
      });
      out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Máy chủ trả lỗi ${res.status}`);
    } catch (e) {
      agentStepReport(k2, false, `⚠️ Bóc tách lỗi: ${e.message}`, 20);
      pipeLog("⛔", `Bóc tách lỗi: ${e.message}`);
      ticket.status = "Tạm dừng";
      save(); render();
      return ticket;
    }

    const { added, dup } = mergeLeads(out.leads || [], { nguon: src || "Dán tay", nguon_loai: src ? (/facebook\.com/i.test(src) ? "facebook" : "khac") : "thu-cong", phu_trach: owner, ticket: ticket.id });
    const canRa = (out.leads || []).filter((l) => l.can_nguoi_xac_nhan !== false).length;
    const note = [
      `Bóc tách bằng: ${out.method === "llm+regex" ? "mô hình ngôn ngữ + đối chiếu regex" : "regex tất định (chưa nối mô hình)"}.`,
      `Quét ${out.stats ? out.stats.blocks : "?"} khối bình luận, thấy ${out.stats ? out.stats.phones : "?"} số điện thoại và ${out.stats ? out.stats.emails : "?"} email hợp lệ.`,
      `Ghi vào kho Lead: ${added} bản mới, bỏ qua ${dup} bản trùng. ${canRa} bản cần người rà lại trước khi đem đi mời.`,
      ...(out.warnings || []).map((w) => `⚠️ ${w}`),
    ].join("\n");
    agentStepReport(k2, true, note, 100, 2);
    pipeLog(added || dup ? "✅" : "⚠️", added
      ? `Ghi ${added} Lead mới (bỏ ${dup} trùng)`
      : dup ? `Không có Lead mới — cả ${dup} liên hệ trong nguồn đều đã có trong kho`
      : "Nguồn không chứa số điện thoại hay email nào");
    (out.warnings || []).forEach((w) => pipeLog("⚠️", w));

    // Trùng hết cũng là một lượt chạy thành công — nguồn này đã khai thác xong.
    // Chỉ khi nguồn không có nổi một cách liên hệ nào mới cần người xem lại.
    ticket.status = (added || dup) ? "Hoàn tất" : "Tạm dừng";
    ticket.desc += `\n\n— Kết thúc ${fmtD(today())}: ${added} Lead mới, ${dup} trùng, ${canRa} cần rà lại.`
      + (added ? " Kết quả chờ người chịu trách nhiệm duyệt."
        : dup ? " Không có Lead mới — mọi liên hệ trong nguồn đều đã có sẵn trong kho."
        : " Nguồn không chứa số điện thoại hay email nào — để Tạm dừng để người kiểm tra lại nguồn.");
    save(); render();
    if (typeof addFeed === "function") addFeed(`Phiếu <b>#${ticket.code}</b> thu thập Lead kết thúc — <b>${added}</b> Lead mới vào kho.`, added ? "f-done" : "f-rule");
    say(added ? `Đã ghi ${added} Lead vào kho ✓` : dup ? `${dup} liên hệ trong nguồn đều đã có sẵn trong kho` : "Nguồn không có liên hệ nào để ghi");
    return ticket;
  }

  /* Việc S1/S2 của pipeline Lead không chạy được bằng khung chat Agent: nó là chuỗi
     tải nguồn → bóc tách → đối chiếu số, không phải một lượt hỏi đáp. Nút "▶ Chạy Agent"
     trên những việc này mở đúng cửa này thay vì gửi prompt sang Hermes. */
  function mRunLeadTask(k) {
    const src = k.leadSrc || {};
    const t = ticketById(k.ticket);
    const nguon = src.url
      ? `<code>${esc(src.url)}</code>`
      : src.pasted ? `nội dung dán tay (${src.pasted.length} ký tự)` : "<i>không còn lưu nguồn gốc</i>";
    openModal(modalHead("🧲", "Việc này chạy bằng pipeline thu thập Lead", esc(k.title)) + `
      <div class="hr-intake-form">
        <div class="wk-note"><b>Không chạy qua khung chat Agent.</b> Hai bước của pipeline là tất định:
          <code>/api/sales/fetch</code> tải nguồn, rồi <code>/api/sales/extract</code> bóc tách và
          <b>đối chiếu từng số điện thoại với văn bản nguồn</b>. Gửi việc này sang khung chat chỉ nhận lại
          một đoạn văn — không Lead nào được ghi vào kho.</div>
        <div class="wk-info">
          <div class="cell"><div class="lbl">Nguồn của lần chạy này</div><div class="val normal">${nguon}</div></div>
          <div class="cell"><div class="lbl">Phiếu</div><div class="val">${t ? `#${t.code}` : "—"} · ${esc(staffName(k.owner))} chịu trách nhiệm</div></div>
        </div>
        <p class="bf-hint" style="margin:.8rem 0 0">Chạy lại sẽ tạo <b>một phiếu mới</b> và chỉ ghi thêm Lead chưa có trong kho — bản trùng số điện thoại bị bỏ qua, không đè lên dữ liệu bạn đã sửa tay.</p>
        <div class="bf-actions" style="margin-top:1.2rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Đóng</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="go" data-view="leads">Xem kho Lead</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="lead-harvest" data-id="${k.id}">▶ Chạy lại thu thập</button>
        </div>
      </div>`);
  }

  function mLeadHarvest(prefill) {
    const a = agentById(LEAD_AGENT);
    const pre = prefill || {};
    openModal(modalHead("🧲", "Thu thập Lead từ link", "Agent tải nội dung nguồn, bóc tách tên · số điện thoại · email · bình luận, phân loại rồi ghi vào kho Lead.") + `
      <div class="hr-intake-form">
        <div class="hr-grid">
          <label class="span2">Link bài viết / bình luận <input type="text" id="wk_lh_url" value="${esc(pre.url || "")}" placeholder="https://www.facebook.com/groups/.../posts/..."></label>
          <label class="span2">Hoặc dán trực tiếp nội dung bình luận
            <textarea id="wk_lh_text" rows="6" placeholder="Bôi đen phần bình luận trên Facebook rồi dán vào đây — cách chắc ăn nhất, không phụ thuộc việc Facebook có cho tải hay không.">${esc(pre.pasted || "")}</textarea></label>
        </div>
        <div class="wk-note warn"><b>Về Facebook:</b> bài viết công khai vẫn thường bị chặn với máy chủ chưa đăng nhập.
          Nếu link không tải được, Agent sẽ dừng và báo rõ — lúc đó dùng ô dán tay. Xem <b>sales/README.md</b> mục Giới hạn công cụ.</div>
        <div>${a ? `<span class="wk-chip">${esc(a.icon || "🤖")} ${esc(a.name)} <span class="wk-owner">· ${esc(staffName(S.agentOwners[LEAD_AGENT]))}</span></span>` : ""}</div>
        <p class="bf-hint" style="margin:.7rem 0 0">Thu thập xong sẽ có một phiếu yêu cầu kèm hai công việc có báo cáo. Lead vào kho ở trạng thái <b>Mới</b> — chưa mời ai cả.</p>
        <div class="bf-actions" style="margin-top:1.2rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Hủy</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="lead-harvest-run">▶ Tạo phiếu &amp; chạy</button>
        </div>
      </div>`);
  }

  /* ================= RENDER ================= */
  const VIEW_RENDER = {
    control: vControl,
    projects: vProjects,
    projectDetail: vProjectDetail,
    tickets: vTickets,
    ticketDetail: vTicketDetail,
    tasks: vTasks,
    staff: vStaff,
    reports: vReports,
    leads: vLeads,
    portal: vPortal,
    flow: vFlow,
  };

  function render() {
    const host = $("#workView");
    if (!host) return;
    const isDetail = !!PARENT_VIEW[VIEW];
    const meta = VIEW_META[PARENT_VIEW[VIEW] || VIEW];
    const renderer = VIEW_RENDER[VIEW];

    const header = isDetail ? "" : `
      <div class="wk-head">
        <div class="wk-head-main">
          <h1>${meta.icon} ${esc(meta.title)}</h1>
          <p>${esc(meta.desc)}</p>
        </div>
        <div class="wk-head-actions">
          ${syncBadgeHtml()}
          <button class="btn btn-primary btn-sm" data-act="new-cluster" title="Tạo phiếu và chạy vòng lặp 4 Agent sản xuất Topic Cluster">🔁 Chạy Content Cluster</button>
          <button class="btn btn-primary btn-sm" data-act="lead-harvest" title="Giao Lead Hunter Agent quét bình luận từ một link và ghi vào kho Lead">🧲 Thu thập Lead</button>
          <button class="btn btn-ghost btn-sm" data-act="reset" title="Xóa dữ liệu đã lưu trên trình duyệt và nạp lại dữ liệu mẫu">↺ Nạp lại dữ liệu mẫu</button>
        </div>
      </div>`;

    host.innerHTML = header + (renderer ? renderer() : kpiStrip());
    setSidebarActive();
    refreshCounters();
    bindKanbanDnd(host);
  }

  // Bộ đếm trên sidebar
  function refreshCounters() {
    const m = metrics();
    const set = (key, val) => {
      const el = document.querySelector(`[data-work-cnt="${key}"]`);
      if (el) el.textContent = val;
    };
    set("projects", m.projectsDoing);
    set("tickets", m.ticketsOpen);
    set("tasks", m.tasksOpen);
    set("reports", m.silent);
    set("leads", (S.leads || []).filter((l) => l.trang_thai === "moi").length);
  }

  /* ================= MODAL ================= */
  function ensureModalHost() {
    let m = document.getElementById("wkModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "wkModal";
      m.className = "modal-backdrop";
      m.innerHTML = '<div class="modal"></div>';
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });
    }
    return m;
  }
  function openModal(html) {
    const m = ensureModalHost();
    m.querySelector(".modal").innerHTML = html;
    m.classList.add("open");
    const first = m.querySelector("input, select, textarea");
    if (first) setTimeout(() => first.focus(), 0);
  }
  function closeModal() {
    const m = document.getElementById("wkModal");
    if (m) m.classList.remove("open");
  }
  const modalHead = (icon, title, desc) => `
    <div class="modal-head">
      <div class="avatar">${icon}</div>
      <div>
        <h2 style="font-family:inherit;color:var(--text);font-size:1.1rem">${esc(title)}</h2>
        <p>${desc}</p>
      </div>
      <button class="drawer-close" data-act="modal-close" style="margin-left:auto" aria-label="Đóng">✕</button>
    </div>`;
  const modalFoot = (saveAct, saveLabel) => `
    <div class="bf-actions" style="margin-top:1.2rem">
      <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Hủy</button>
      <button class="btn btn-primary btn-sm" type="button" data-act="${saveAct}">${saveLabel}</button>
    </div>`;

  const fld = (id) => document.getElementById(id);
  const val = (id) => { const e = fld(id); return e ? e.value.trim() : ""; };
  const say = (msg) => { if (typeof toast === "function") toast(msg); };
  const newId = (prefix) => prefix + Date.now().toString(36) + Math.floor(Math.random() * 100);

  // ---- Tạo dự án ----
  function mNewProject() {
    openModal(modalHead("📁", "Tạo dự án mới", "Dự án là cấp cao nhất — gắn khách hàng, PM và nhóm nhân sự. Tiến độ tự cuộn lên từ các phiếu bên dưới.") + `
      <div class="hr-intake-form"><div class="hr-grid">
        <label class="span2">Tên dự án <span class="req">*</span><input type="text" id="wk_p_name" placeholder="VD: Triển khai CRM — CN Bến Tre"></label>
        <label>Khách hàng <span class="req">*</span><select id="wk_p_cus">${customerOpts()}</select></label>
        <label>PM phụ trách <span class="req">*</span><select id="wk_p_pm">${staffOpts()}</select></label>
        <label>Ngày bắt đầu<input type="date" id="wk_p_start" value="${today()}"></label>
        <label>Thời hạn<input type="date" id="wk_p_dl"></label>
        <label class="span2">Nhân sự tham gia (giữ Ctrl để chọn nhiều)<select id="wk_p_mem" multiple size="5">${staffOpts()}</select></label>
        <label class="span2">Nội dung dự án<textarea id="wk_p_desc" placeholder="Phạm vi, mục tiêu…"></textarea></label>
        <label class="span2">Tài liệu đính kèm<input type="text" id="wk_p_docs" placeholder="Tên file, cách nhau bằng dấu phẩy"></label>
      </div>` + modalFoot("save-project", "Lưu dự án") + "</div>");
  }
  function saveProject() {
    const name = val("wk_p_name");
    if (!name) return say("Vui lòng nhập tên dự án");
    const pm = val("wk_p_pm");
    const mem = [...fld("wk_p_mem").selectedOptions].map((o) => o.value);
    const id = newId("p");
    S.projects.push({
      id, name, customer: val("wk_p_cus"), pm,
      members: [...new Set([pm, ...mem])],
      start: val("wk_p_start"), deadline: val("wk_p_dl"),
      status: "Mới", desc: val("wk_p_desc"),
      docs: val("wk_p_docs") ? val("wk_p_docs").split(",").map((s) => s.trim()).filter(Boolean) : [],
      public: false,
    });
    save(); closeModal(); say("Đã tạo dự án ✓"); show("projectDetail", id);
  }

  // ---- Tạo phiếu yêu cầu ----
  function mNewTicket(projectId) {
    openModal(modalHead("🎫", "Tạo phiếu yêu cầu", "Phiếu luôn thuộc đúng một dự án. Khách hàng được kế thừa từ dự án cha.") + `
      <div class="hr-intake-form"><div class="hr-grid">
        <label class="span2">Thuộc dự án <span class="req">*</span><select id="wk_t_proj">${projectOpts(projectId)}</select></label>
        <label class="span2">Tiêu đề <span class="req">*</span><input type="text" id="wk_t_title" placeholder="VD: Phân quyền theo tổ chức chi nhánh"></label>
        <label class="span2">Nội dung yêu cầu<textarea id="wk_t_desc"></textarea></label>
        <label>Loại phiếu<select id="wk_t_type">${opts(TYPE_LIST)}</select></label>
        <label>Độ ưu tiên<select id="wk_t_prio">${opts(PRIO_LIST, "Trung bình")}</select></label>
        <label>Thời hạn<input type="date" id="wk_t_dl"></label>
        <label>Trạng thái<select id="wk_t_st">${opts(STATUS_LIST, "Mới")}</select></label>
        <label class="span2">Người xử lý (giữ Ctrl để chọn nhiều)<select id="wk_t_asg" multiple size="5">${staffOpts()}</select></label>
      </div>` + modalFoot("save-ticket", "Lưu phiếu") + "</div>");
  }
  function saveTicket() {
    const title = val("wk_t_title");
    if (!title) return say("Vui lòng nhập tiêu đề phiếu");
    const id = newId("t");
    const maxCode = S.tickets.reduce((m, t) => Math.max(m, t.code || 0), 49000);
    S.tickets.push({
      id, code: maxCode + 1, title, project: val("wk_t_proj"),
      type: val("wk_t_type"), status: val("wk_t_st"), prio: val("wk_t_prio"),
      deadline: val("wk_t_dl"),
      assignees: [...fld("wk_t_asg").selectedOptions].map((o) => o.value),
      desc: val("wk_t_desc"),
    });
    save(); closeModal(); say("Đã tạo phiếu yêu cầu ✓"); show("ticketDetail", id);
  }

  // ---- Giao công việc ----
  function mNewTask(ticketId) {
    const firstExec = `human:${S.staff[0].id}`;
    openModal(modalHead("✅", "Giao công việc", "Người thực hiện có thể là <b>nhân sự</b> hoặc <b>AI Agent</b>. Chọn Agent thì người chịu trách nhiệm tự điền theo nhân sự phụ trách Agent đó.") + `
      <div class="hr-intake-form"><div class="hr-grid">
        <label class="span2">Thuộc phiếu yêu cầu <span class="req">*</span><select id="wk_k_tick">${ticketOpts(ticketId)}</select></label>
        <label class="span2">Tên công việc <span class="req">*</span><input type="text" id="wk_k_title" placeholder="VD: Soạn email cập nhật tiến độ cho khách hàng"></label>
        <label>Người thực hiện <span class="req">*</span><select id="wk_k_exec">${executorOpts(firstExec)}</select></label>
        <label>Người chịu trách nhiệm <span class="req">*</span><select id="wk_k_owner">${staffOpts(S.staff[0].id)}</select></label>
        <label>Độ ưu tiên<select id="wk_k_prio">${opts(PRIO_LIST, "Trung bình")}</select></label>
        <label>Trạng thái<select id="wk_k_st">${opts(STATUS_LIST, "Mới")}</select></label>
        <label>Bắt đầu<input type="date" id="wk_k_start" value="${today()}"></label>
        <label>Thời hạn<input type="date" id="wk_k_dl"></label>
      </div>
      <p class="bf-hint" style="margin:.7rem 0 0">Dù ai làm, <b>báo cáo tiến độ vẫn là bắt buộc</b> — việc đang chạy mà quá ${REPORT_GRACE_DAYS} ngày không có báo cáo sẽ bị đánh dấu "im lặng".</p>`
      + modalFoot("save-task", "Giao việc") + "</div>");

    const exec = fld("wk_k_exec");
    if (exec) exec.addEventListener("change", () => {
      const o = fld("wk_k_owner");
      if (o) o.value = defaultOwner(parseExecutor(exec.value));
    });
  }
  function saveTask() {
    const title = val("wk_k_title");
    if (!title) return say("Vui lòng nhập tên công việc");
    const tid = val("wk_k_tick");
    if (!tid) return say("Vui lòng chọn phiếu yêu cầu");
    const executor = parseExecutor(val("wk_k_exec"));
    S.tasks.push({
      id: newId("k"), ticket: tid, title, executor,
      owner: val("wk_k_owner") || defaultOwner(executor),
      status: val("wk_k_st"), prio: val("wk_k_prio"),
      start: val("wk_k_start"), deadline: val("wk_k_dl") || ticketById(tid).deadline,
      progress: 0, reports: [],
    });
    save(); closeModal(); say("Đã giao công việc ✓"); render();
  }

  // ---- Báo cáo tiến độ ----
  let CURRENT_REPORT = null; // công việc đang mở modal báo cáo
  function mReport(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    CURRENT_REPORT = taskId;
    const t = ticketById(k.ticket);
    const reporter = isAgentTask(k) ? k.owner : k.executor.id;
    const history = k.reports.slice().reverse().map((r) => `
      <div class="wk-report ${r.byType === "agent" ? "agent" : ""}">
        ${esc(r.note)}
        <div class="meta">${fmtD(r.at)} · ${r.progress}%${r.minutes ? ` · ⏱ ${r.minutes} phút` : ""} · ${r.byType === "agent" ? `🤖 ${esc((agentById(r.agentId) || {}).name || r.agentId)} (chịu trách nhiệm: ${esc(staffName(r.by))})` : esc(staffName(r.by))}</div>
      </div>`).join("");

    openModal(modalHead("📈", "Báo cáo tiến độ", `${esc(k.title)}${t ? ` · phiếu #${t.code}` : ""}`) + `
      <div class="hr-intake-form">
        <div class="wk-note">Người ghi báo cáo: <b>${esc(staffName(reporter))}</b>${isAgentTask(k) ? ` — việc do <b>🤖 ${esc((agentById(k.executor.id) || {}).name || k.executor.id)}</b> thực hiện, bạn là người chịu trách nhiệm xác nhận.` : ""}</div>
        <div class="hr-grid">
          <label>Ngày bắt đầu<input type="date" id="wk_r_start" value="${k.start || ""}"></label>
          <label>Thời hạn<input type="date" id="wk_r_dl" value="${k.deadline || ""}"></label>
          <label class="span2">Tiến độ hiện tại: <b id="wk_r_pv" style="color:var(--brand-2)">${k.progress}%</b>
            <input type="range" class="wk-range" id="wk_r_prog" min="0" max="100" step="5" value="${k.progress}">
          </label>
          <label>Trạng thái<select id="wk_r_st">${opts(STATUS_LIST, k.status)}</select></label>
          <label>Thời gian thực hiện (phút)<input type="number" id="wk_r_min" min="0" step="5" placeholder="VD: 120"></label>
          <label class="span2">Nội dung báo cáo<textarea id="wk_r_note" placeholder="Đã làm gì, còn vướng gì, cần ai hỗ trợ…"></textarea></label>
        </div>
        ${history ? `<h4>Lịch sử báo cáo (${k.reports.length})</h4>${history}` : '<p class="bf-hint" style="margin-top:.8rem">Công việc này chưa có báo cáo nào.</p>'}
      ` + modalFoot("save-report", "Lưu báo cáo") + `</div>`);

    const range = fld("wk_r_prog");
    if (range) range.addEventListener("input", () => { fld("wk_r_pv").textContent = range.value + "%"; });
  }
  function saveReport(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    k.start = val("wk_r_start") || k.start;
    k.deadline = val("wk_r_dl") || k.deadline;
    k.progress = Number(val("wk_r_prog"));
    k.status = val("wk_r_st");
    // Giữ trạng thái nhất quán với tiến độ vừa báo cáo
    if (k.progress === 100 && k.status !== "Chờ duyệt") k.status = DONE;
    else if (k.progress > 0 && k.status === "Mới") k.status = "Đang thực hiện";
    if (isDone(k.status)) k.progress = 100;
    const minutes = Number(val("wk_r_min")) || 0;
    k.reports.push({
      at: today(), progress: k.progress,
      note: val("wk_r_note") || "(cập nhật tiến độ)",
      by: isAgentTask(k) ? k.owner : k.executor.id,
      byType: "human",
      minutes: minutes || undefined,
    });
    save(); closeModal(); say("Đã lưu báo cáo — tiến độ phiếu & dự án tự cập nhật ✓"); render();
  }

  // ---- Duyệt / trả lại kết quả ----
  function approveTask(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    k.status = DONE; k.progress = 100;
    k.reports.push({ at: today(), progress: 100, note: `Đã duyệt kết quả${isAgentTask(k) ? ` do ${(agentById(k.executor.id) || {}).name || k.executor.id} thực hiện` : ""} và đóng công việc.`, by: k.owner, byType: "human" });
    save(); closeModal(); say("Đã duyệt và đóng công việc ✓"); render();
  }
  function rejectTask(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    k.status = "Đang thực hiện";
    k.reports.push({ at: today(), progress: k.progress, note: "Trả lại để chỉnh sửa — xem ghi chú của người chịu trách nhiệm.", by: k.owner, byType: "human" });
    save(); say("Đã trả lại công việc"); render(); mReport(taskId);
  }

  // ---- Thêm nhanh công việc trong block phiếu ----
  function qaSave(ticketId) {
    const titleEl = document.querySelector(`[data-qa-title="${ticketId}"]`);
    const title = titleEl ? titleEl.value.trim() : "";
    if (!title) { say("Vui lòng nhập tên công việc"); if (titleEl) titleEl.focus(); return; }
    const executor = parseExecutor(document.querySelector(`[data-qa-exec="${ticketId}"]`).value);
    const dlEl = document.querySelector(`[data-qa-dl="${ticketId}"]`);
    S.tasks.push({
      id: newId("k"), ticket: ticketId, title, executor, owner: defaultOwner(executor),
      status: "Mới", prio: "Trung bình", start: today(),
      deadline: (dlEl && dlEl.value) || ticketById(ticketId).deadline,
      progress: 0, reports: [],
    });
    save(); say("Đã thêm công việc ✓");
    QA[ticketId] = true; // giữ mở để thêm tiếp
    render();
    const next = document.querySelector(`[data-qa-title="${ticketId}"]`);
    if (next) next.focus();
  }

  /* ================= GIAO VIỆC CHO AI AGENT (chạy thật qua Proxy) =================
     Luồng: chọn Agent → dựng ngữ cảnh (dự án + phiếu + việc + rule) → gọi
     POST /api/agents/:id/chat của Backend Proxy → kết quả trở thành BÁO CÁO,
     công việc chuyển "Chờ duyệt" để người chịu trách nhiệm xác nhận.
     Agent không bao giờ tự đóng việc của mình.
  ============================================================================= */

  /* Gợi ý Agent — dùng chung bộ từ khóa nghiệp vụ của Orches (AGENTS[].keywords),
     nhưng chấm điểm chặt hơn: từ khóa trúng trong TÊN CÔNG VIỆC mới được coi là
     nhận diện chắc chắn; trúng trong mô tả phiếu chỉ tính điểm phụ. Tránh trường hợp
     một việc kỹ thuật bị đẩy sang Sales chỉ vì mô tả phiếu có chữ "khách hàng". */
  function scoreAgents(k) {
    const t = ticketById(k.ticket);
    const title = (k.title || "").toLowerCase();
    const ctx = (t ? `${t.title} ${t.desc}` : "").toLowerCase();
    return agentList().map((a) => {
      let score = 0, titleHit = false;
      (a.keywords || []).forEach((kw) => {
        const w = String(kw).toLowerCase();
        if (title.includes(w)) { score += w.length * 3; titleHit = true; }
        else if (ctx.includes(w)) score += w.length;
      });
      return { agent: a, score, titleHit };
    }).sort((x, y) => y.score - x.score);
  }
  function suggestAgent(k) {
    const ranked = scoreAgents(k).filter((r) => r.score > 0);
    const top = ranked[0];
    return {
      agent: top ? top.agent : (agentList()[0] || null),
      matched: !!(top && top.titleHit),   // chỉ "chắc chắn" khi trúng từ khóa ngay trong tên việc
      ranked: ranked.slice(0, 3),
    };
  }

  // Khối bối cảnh dùng chung cho cả lệnh chạy và khung chat theo công việc
  function contextLines(k, agent) {
    const t = ticketById(k.ticket);
    const p = t && projectById(t.project);
    const globals = (typeof GLOBAL_RULES !== "undefined" && Array.isArray(GLOBAL_RULES)) ? GLOBAL_RULES : [];
    const rules = [...globals, ...((agent && agent.rules) || [])];
    return [
      `## BỐI CẢNH`,
      p ? `- Dự án: ${p.name} (khách hàng: ${customerName(p.customer)})` : "- Dự án: (không rõ)",
      p ? `- Mục tiêu dự án: ${p.desc}` : "",
      t ? `- Phiếu yêu cầu #${t.code}: ${t.title}` : "",
      t ? `- Nội dung yêu cầu: ${t.desc}` : "",
      `- Công việc: ${k.title}`,
      `- Thời hạn: ${fmtD(k.deadline)} · độ ưu tiên: ${k.prio}`,
      `- Người chịu trách nhiệm nghiệm thu: ${staffName(k.owner)}`,
      k.reports.length ? `- Diễn biến trước đó: ${k.reports.slice(-2).map((r) => `${fmtD(r.at)} (${r.progress}%): ${r.note.slice(0, 200)}`).join(" | ")}` : "",
      "",
      rules.length ? `## RULE BẮT BUỘC TUÂN THỦ\n${rules.map((r) => `- ${r}`).join("\n")}` : "",
    ].filter((l) => l !== "").join("\n");
  }

  function buildPrompt(k, agent) {
    return [
      `Bạn là ${agent.name} — ${agent.role} của công ty. Hãy thực hiện nhiệm vụ dưới đây và trả về KẾT QUẢ BÀN GIAO ĐƯỢC, không hỏi lại.`,
      "",
      `## NHIỆM VỤ`,
      k.title,
      "",
      contextLines(k, agent),
      "",
      `## YÊU CẦU ĐẦU RA`,
      `- Mở đầu bằng 2-3 dòng tóm tắt việc đã làm.`,
      `- Sau đó là nội dung kết quả đầy đủ, dùng được ngay.`,
      `- Cuối cùng nêu rõ điểm cần ${staffName(k.owner)} kiểm tra trước khi duyệt.`,
    ].join("\n");
  }

  /* ---- Chat theo ngữ cảnh công việc: nơi ra lệnh từng tác vụ cụ thể ----
     Khác với nút "Chạy Agent" (giao trọn nhiệm vụ), khung này để trao đổi
     qua lại: chỉnh lại kết quả, hỏi thêm, yêu cầu làm gọn hơn… Lượt trả lời
     nào ưng ý thì bấm ghi thẳng thành báo cáo của công việc. */
  function chatBoxHtml(k) {
    const a = agentById(k.executor.id);
    const msgs = k.chat || [];
    if (!msgs.length) {
      return `<div class="empty">Chưa có trao đổi nào.<br>Nhắn cho ${esc(a ? a.name : "Agent")} yêu cầu cụ thể cho công việc này — ví dụ “rút gọn còn 150 chữ”, “thêm mốc thời gian vào email”, “giải thích vì sao chọn phương án này”.</div>`;
    }
    return msgs.map((m, i) => {
      const isAgent = m.role === "agent";
      const last = i === msgs.length - 1;
      return `<div class="msg ${isAgent ? "agent" : "user"}">${isAgent ? `<div class="m-from">${esc(a ? a.name : "Agent")}${m.mock ? " · MOCK" : ""}</div>` : ""}${esc(m.text)}</div>`
        + (isAgent && last && !m.error ? `<div class="wk-msgact"><button class="wk-minibtn go" data-act="chat-to-report" data-id="${k.id}">＋ Ghi lượt trả lời này thành báo cáo</button></div>` : "");
    }).join("");
  }

  function refreshChatBox(k, typing) {
    const box = fld("wk_chat_box");
    if (!box) return;
    box.innerHTML = chatBoxHtml(k) + (typing ? `<div class="msg agent typing">${esc((agentById(k.executor.id) || {}).name || "Agent")} đang soạn…</div>` : "");
    box.scrollTop = box.scrollHeight;
  }

  function mTaskChat(taskId) {
    const k = taskById(taskId);
    if (!k || !isAgentTask(k)) return;
    const a = agentById(k.executor.id);

    openModal(modalHead("💬", `Trao đổi với ${a ? a.name : k.executor.id}`, `${esc(k.title)}`) + `
      <div class="hr-intake-form">
        <div class="wk-note">Khung này để <b>ra lệnh từng tác vụ cụ thể</b> cho Agent. Bối cảnh dự án · phiếu · công việc · rule được gửi kèm ở lượt đầu, những lượt sau chỉ cần nói ngắn gọn.</div>
        <div class="wk-chatbox" id="wk_chat_box">${chatBoxHtml(k)}</div>
        <div class="wk-chatrow">
          <textarea id="wk_chat_input" rows="2" placeholder="Nhắn cho Agent… (Enter để gửi, Shift+Enter xuống dòng)"></textarea>
          <button class="btn btn-primary btn-sm" type="button" data-act="chat-send" data-id="${k.id}">Gửi</button>
        </div>
        <div class="bf-actions" style="margin-top:1rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Đóng</button>
          ${k.status === "Chờ duyệt" ? `<button class="btn btn-primary btn-sm" type="button" data-act="approve" data-id="${k.id}">✓ Duyệt &amp; đóng việc</button>` : ""}
        </div>
      </div>`);

    const ta = fld("wk_chat_input");
    if (ta) {
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(taskId); }
      });
      setTimeout(() => ta.focus(), 0);
    }
    refreshChatBox(k);
  }

  async function sendChat(taskId) {
    const k = taskById(taskId);
    if (!k || !isAgentTask(k)) return;
    const a = agentById(k.executor.id);
    const ta = fld("wk_chat_input");
    const text = ta ? ta.value.trim() : "";
    if (!text) return;

    k.chat = k.chat || [];
    const first = k.chat.length === 0;
    k.chat.push({ role: "user", text, at: new Date().toISOString() });
    if (ta) ta.value = "";
    save();
    refreshChatBox(k, true);

    const history = k.chat.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "agent", text: m.text }));
    const message = first
      ? `Bạn là ${a.name} — ${a.role} của công ty. Dưới đây là bối cảnh công việc, sau đó là yêu cầu cụ thể.\n\n${contextLines(k, a)}\n\n## YÊU CẦU CỤ THỂ\n${text}`
      : text;

    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/agents/${encodeURIComponent(k.executor.id)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Proxy trả lỗi ${res.status}`);
      if (!data.reply) throw new Error("Agent không trả về nội dung");
      k.chat.push({ role: "agent", text: data.reply, at: new Date().toISOString(), mock: !!data.mock });
    } catch (e) {
      k.chat.push({ role: "agent", text: `⚠️ Không gọi được Agent: ${e.message}. Backend Proxy có đang chạy tại ${WORK_PROXY_BASE} không?`, at: new Date().toISOString(), error: true });
    }
    save();
    refreshChatBox(k);
  }

  function chatToReport(taskId) {
    const k = taskById(taskId);
    if (!k || !k.chat || !k.chat.length) return;
    const last = [...k.chat].reverse().find((m) => m.role === "agent" && !m.error);
    if (!last) return say("Chưa có lượt trả lời nào của Agent để ghi");
    k.reports.push({
      at: today(), progress: k.progress,
      note: (last.mock ? "🧪 [MOCK_MODE] " : "") + last.text,
      by: k.owner, byType: "agent", agentId: k.executor.id, minutes: 1,
    });
    if (k.status === "Mới") k.status = "Đang thực hiện";
    save(); say("Đã ghi lượt trả lời thành báo cáo ✓"); refreshChatBox(k); render();
  }

  async function proxyHealth() {
    const res = await fetch(`${WORK_PROXY_BASE}/api/health`, { method: "GET" });
    if (!res.ok) throw new Error(`Proxy trả lỗi ${res.status}`);
    return res.json();
  }

  // ---- Modal: giao việc cho Agent ----
  function mAssignAgent(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    const { agent, matched, ranked } = suggestAgent(k);
    const sel = agentList().map((a) => `<option value="${a.id}"${agent && a.id === agent.id ? " selected" : ""}>${esc(a.icon || "🤖")} ${esc(a.name)} — ${esc(a.model)}</option>`).join("");

    openModal(modalHead("🤖", "Giao công việc cho AI Agent", "Agent thực thi, nhưng <b>nhân sự chịu trách nhiệm mới là người duyệt kết quả</b>.") + `
      <div class="hr-intake-form">
        <div class="wk-note">Công việc: <b>${esc(k.title)}</b></div>
        <div class="hr-grid">
          <label class="span2">Chọn Agent thực thi <span class="req">*</span><select id="wk_a_agent">${sel}</select></label>
          <label class="span2">Người chịu trách nhiệm <span class="req">*</span><select id="wk_a_owner">${staffOpts(agent ? (S.agentOwners[agent.id] || k.owner) : k.owner)}</select></label>
        </div>
        <p class="bf-hint" style="margin:.6rem 0 0">${matched
          ? `🧭 Gợi ý <b>${esc(agent.name)}</b> — trúng từ khóa nghiệp vụ ngay trong tên công việc.${ranked.length > 1 ? ` Ứng viên khác: ${ranked.slice(1).map((r) => esc(r.agent.name)).join(", ")}.` : ""}`
          : `⚠️ Chưa nhận diện chắc chắn nghiệp vụ từ tên công việc — <b>hãy tự chọn Agent</b>. ${ranked.length ? `Gần đúng nhất theo mô tả phiếu: ${ranked.map((r) => esc(r.agent.name)).join(", ")}.` : "Không có Agent nào khớp từ khóa."}`}</p>
        <h4>Ngữ cảnh sẽ gửi cho Agent</h4>
        <div class="wk-output" id="wk_a_prompt">${esc(agent ? buildPrompt(k, agent) : "")}</div>
        <div class="bf-actions" style="margin-top:1.2rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Hủy</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="confirm-assign" data-id="${k.id}">Chỉ giao, chưa chạy</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="confirm-assign-run" data-id="${k.id}">Giao &amp; chạy ngay ▶</button>
        </div>
      </div>`);

    const agentSel = fld("wk_a_agent");
    if (agentSel) agentSel.addEventListener("change", () => {
      const a = agentById(agentSel.value);
      if (!a) return;
      fld("wk_a_owner").value = S.agentOwners[a.id] || k.owner;
      fld("wk_a_prompt").textContent = buildPrompt(k, a);
    });
  }

  function confirmAssign(taskId, runNow) {
    const k = taskById(taskId);
    if (!k) return;
    const agentId = val("wk_a_agent");
    if (!agentId) return say("Vui lòng chọn Agent");
    k.executor = { type: "agent", id: agentId };
    k.owner = val("wk_a_owner") || defaultOwner(k.executor);
    save();
    const a = agentById(agentId);
    say(`Đã giao cho ${a ? a.name : agentId} ✓`);
    if (typeof addFeed === "function") addFeed(`<b>${esc(a ? a.name : agentId)}</b> được giao công việc "${esc(k.title)}" — chịu trách nhiệm: ${esc(staffName(k.owner))}.`, "f-orches");
    closeModal();
    render();
    if (runNow) mRunAgent(taskId);
  }

  function unassignAgent(taskId) {
    const k = taskById(taskId);
    if (!k) return;
    k.executor = { type: "human", id: k.owner };
    save(); say("Đã chuyển lại cho nhân sự thực hiện"); render();
  }

  // ---- Modal: chạy Agent ----
  const RUN_STEPS = [
    { id: "health", title: "Kiểm tra Backend Proxy", desc: `${WORK_PROXY_BASE}/api/health` },
    { id: "context", title: "Dựng ngữ cảnh công việc", desc: "Dự án · phiếu yêu cầu · công việc · rule" },
    { id: "call", title: "Gửi nhiệm vụ cho Agent", desc: "POST /api/agents/:id/chat" },
    { id: "report", title: "Ghi kết quả thành báo cáo", desc: "Chuyển sang Chờ duyệt cho người chịu trách nhiệm" },
  ];

  function runStepsHtml(state) {
    return `<div class="wk-steps">${RUN_STEPS.map((s, i) => {
      const st = state[s.id] || {};
      const cls = st.status === "ok" ? "ok" : st.status === "fail" ? "fail" : st.status === "doing" ? "on" : "";
      const ic = st.status === "ok" ? "✓" : st.status === "fail" ? "✕" : st.status === "doing" ? '<span class="wk-spin"></span>' : i + 1;
      return `<div class="wk-step ${cls}"><span class="ic">${ic}</span><span class="tx"><b>${esc(s.title)}</b><span>${st.note ? esc(st.note) : esc(s.desc)}</span></span></div>`;
    }).join("")}</div>`;
  }

  let RUN_STATE = {};

  function mRunAgent(taskId) {
    const k = taskById(taskId);
    if (!k || !isAgentTask(k)) return;
    // Việc do pipeline tất định sinh ra thì phải chạy lại bằng chính pipeline đó —
    // đẩy qua khung chat Agent chỉ ra một đoạn văn, không ghi được Lead nào.
    if (k.engine === "lead-harvest") return mRunLeadTask(k);
    const a = agentById(k.executor.id);
    RUN_STATE = {};
    openModal(modalHead("▶", `Chạy ${a ? a.name : k.executor.id}`, `${esc(k.title)}`) + `
      <div class="hr-intake-form">
        <div class="wk-note">Kết quả Agent trả về sẽ được ghi thành báo cáo và chuyển công việc sang <b>Chờ duyệt</b> — <b>${esc(staffName(k.owner))}</b> là người xác nhận cuối cùng.</div>
        <div id="wk_run_steps">${runStepsHtml(RUN_STATE)}</div>
        <div id="wk_run_out"></div>
        <div class="bf-actions" style="margin-top:1.2rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Đóng</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="start-run" data-id="${k.id}" id="wk_run_btn">▶ Bắt đầu chạy</button>
        </div>
      </div>`);
  }

  function setStep(id, status, note) {
    RUN_STATE[id] = { status, note };
    const box = fld("wk_run_steps");
    if (box) box.innerHTML = runStepsHtml(RUN_STATE);
  }

  async function startRun(taskId) {
    const k = taskById(taskId);
    if (!k || !isAgentTask(k)) return;
    const a = agentById(k.executor.id);
    const btn = fld("wk_run_btn");
    if (btn) { btn.disabled = true; btn.textContent = "Đang chạy…"; }
    const out = fld("wk_run_out");
    const started = Date.now();
    k.run = { status: "running", agentId: k.executor.id, startedAt: new Date().toISOString() };

    const fail = (stepId, msg, hint) => {
      setStep(stepId, "fail", msg);
      k.run = { status: "failed", agentId: k.executor.id, error: msg, endedAt: new Date().toISOString() };
      k.reports.push({ at: today(), progress: k.progress, note: `⚠️ Không chạy được ${a ? a.name : k.executor.id}: ${msg}`, by: k.owner, byType: "agent", agentId: k.executor.id });
      save();
      // hint là HTML do chính file này dựng (các giá trị động bên trong đã được esc)
      if (out) out.innerHTML = `<div class="wk-note warn"><b>Chạy thất bại.</b> ${hint || ""}</div>`;
      if (btn) { btn.disabled = false; btn.textContent = "▶ Chạy lại"; }
      render();
    };

    // 1. Proxy
    setStep("health", "doing");
    let health;
    try {
      health = await proxyHealth();
      setStep("health", "ok", `Proxy sống · MOCK_MODE=${health.mockMode} · ${(health.agents || []).length} agent`);
    } catch (e) {
      return fail("health", e.message,
        `Backend Proxy chưa chạy hoặc origin bị chặn CORS. Chạy <code>node server/server.js</code> trong thư mục <code>project/aios/server</code>, và thêm <code>${location.origin}</code> vào <code>ALLOWED_ORIGIN</code> trong <code>server/.env</code>.`);
    }

    // Proxy sống nhưng là tiến trình cũ: agents.config.json đã thêm Agent mới mà proxy
    // chưa nạp lại. Bắt ở đây thay vì để bước gọi trả 404 khó hiểu.
    if (Array.isArray(health.agents) && !health.agents.includes(k.executor.id)) {
      return fail("health", `Proxy đang chạy không biết agent "${k.executor.id}"`,
        `Proxy sống nhưng là <b>tiến trình cũ</b> — nó nạp <code>agents.config.json</code> một lần lúc khởi động, mà <code>${esc(k.executor.id)}</code> được thêm sau đó. Hãy <b>tắt và chạy lại</b> <code>node server/server.js</code>. Agent proxy đang biết: <code>${esc((health.agents || []).join(", "))}</code>.`);
    }

    // 2. Ngữ cảnh — việc thuộc phiếu Content Cluster thì dùng đúng SKILL.md của chặng đó,
    //    để lượt chạy lại không lệch so với lượt chạy tự động ban đầu.
    setStep("context", "doing");
    const stageKey = Object.keys(CLUSTER_AGENTS).find((s) => CLUSTER_AGENTS[s] === k.executor.id);
    const tk = ticketById(k.ticket);
    const laCluster = !!(stageKey && tk && /^Content Cluster:/.test(tk.title));
    const prompt = laCluster
      ? await stagePrompt(stageKey, `Chạy lại công việc: ${k.title}\n\nBối cảnh phiếu #${tk.code}: ${tk.desc}`)
      : buildPrompt(k, a);
    setStep("context", "ok", laCluster
      ? `${prompt.length} ký tự · theo skill ${STAGE_SKILL[stageKey]}/SKILL.md`
      : `${prompt.length} ký tự ngữ cảnh · ${(a.rules || []).length} rule của Agent`);

    // 3. Gọi Agent
    setStep("call", "doing", `Đang chờ ${a.name} (${a.model})…`);
    let data;
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/agents/${encodeURIComponent(k.executor.id)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Proxy trả lỗi ${res.status}`);
      if (!data.reply) throw new Error("Agent không trả về nội dung");
    } catch (e) {
      return fail("call", e.message,
        `Agent <b>${esc(a.name)}</b> chưa phản hồi được. Nếu <code>MOCK_MODE=false</code>, kiểm tra Hermes Profile <code>${esc(k.executor.id)}</code> đã bật gateway và đã điền <code>HERMES_KEY_*</code> chưa.`);
    }
    const mock = !!data.mock;
    setStep("call", "ok", mock ? "Đã nhận phản hồi — MOCK_MODE, chưa phải Hermes thật" : `Đã nhận phản hồi thật từ ${a.name}`);

    // 4. Ghi báo cáo
    setStep("report", "doing");
    const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
    k.run = { status: "done", agentId: k.executor.id, mock, output: data.reply, endedAt: new Date().toISOString() };
    k.progress = 100;
    k.status = "Chờ duyệt";
    k.reports.push({
      at: today(), progress: 100,
      note: (mock ? "🧪 [MOCK_MODE — chưa nối Hermes thật] " : "") + data.reply,
      by: k.owner, byType: "agent", agentId: k.executor.id, minutes,
    });
    save();
    setStep("report", "ok", `Đã ghi báo cáo · chờ ${staffName(k.owner)} duyệt`);

    if (out) out.innerHTML = `
      <h4>Kết quả Agent trả về ${mock ? '<span class="badge wk-badge-mock">MOCK_MODE</span>' : '<span class="badge model">Hermes thật</span>'}</h4>
      <div class="wk-output">${esc(data.reply)}</div>
      <div class="bf-actions" style="margin-top:.9rem">
        <button class="btn btn-ghost btn-sm" type="button" data-act="task-chat" data-id="${k.id}">💬 Trao đổi thêm</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="reject" data-id="${k.id}">Trả lại Agent làm tiếp</button>
        <button class="btn btn-primary btn-sm" type="button" data-act="approve" data-id="${k.id}">✓ Duyệt &amp; đóng việc</button>
      </div>`;
    if (btn) { btn.disabled = false; btn.textContent = "▶ Chạy lại"; }
    if (typeof addFeed === "function") addFeed(`<b>${esc(a.name)}</b> hoàn thành "${esc(k.title)}" — chờ ${esc(staffName(k.owner))} duyệt.`, "f-done");
    say("Agent đã trả kết quả — công việc chuyển sang Chờ duyệt ✓");
    render();
  }

  /* ================= VÒNG LẶP CONTENT CLUSTER =================
     Orches nhận một chủ đề → tạo NGAY một Phiếu yêu cầu giao cho AI, rồi chạy
     lần lượt 4 Agent. Mỗi Agent thực thi = một Công việc trong phiếu đó; xong
     mục nào ghi báo cáo mục đó; xong hết thì đóng phiếu kèm ghi chú.

     Bốn vai: mkt-3 nghiên cứu → mkt-4 kiến trúc SEO → mkt-1 viết bài → mkt-5 prompt ảnh.
  ============================================================================ */

  const CLUSTER_AGENTS = { research: "mkt-3", seo: "mkt-4", writer: "mkt-1", visual: "mkt-5" };
  const CLUSTER_PROJECT_NAME = "Marketing — Content Cluster";

  // Mỗi chặng chạy theo đúng file SKILL.md trong marketing/skills/ — không nhúng lại
  // hướng dẫn trong code, để sửa skill là engine đổi theo ngay, hai bên không lệch nhau.
  const STAGE_SKILL = {
    research: "nghien-cuu-chu-de",
    seo: "kien-truc-seo-cluster",
    writer: "viet-bai-chuan-seo",
    visual: "prompt-anh-ai",
  };
  // SKILL.md trỏ sang template nào thì phải gửi kèm template đó, nếu không agent
  // không biết khung đầu ra (đã từng thiếu hẳn frontmatter SEO của bài viết).
  const STAGE_TEMPLATE = {
    seo: "seo-blueprint-schema.md",
    writer: "bai-viet.template.md",
    visual: "image-prompt-schema.md",
  };
  const SKILL_CACHE = {};
  const TPL_CACHE = {};

  async function loadTemplate(tplId) {
    if (!tplId) return null;
    if (TPL_CACHE[tplId] !== undefined) return TPL_CACHE[tplId];
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/marketing/templates/${encodeURIComponent(tplId)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.content) throw new Error(d.error || `Proxy trả lỗi ${res.status}`);
      TPL_CACHE[tplId] = d.content;
      return d.content;
    } catch (e) {
      TPL_CACHE[tplId] = null;
      console.warn(`[work] Không đọc được template "${tplId}":`, e.message);
      return null;
    }
  }

  async function loadSkill(skillId) {
    if (SKILL_CACHE[skillId] !== undefined) return SKILL_CACHE[skillId];
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/marketing/skills/${encodeURIComponent(skillId)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.markdown) throw new Error(d.error || `Proxy trả lỗi ${res.status}`);
      SKILL_CACHE[skillId] = d.markdown;
      return d.markdown;
    } catch (e) {
      SKILL_CACHE[skillId] = null; // nhớ là hỏng, không gọi lại liên tục
      console.warn(`[work] Không đọc được SKILL.md "${skillId}":`, e.message);
      return null;
    }
  }

  /* SKILL.md viết cho runtime CÓ tool (đọc web, ghi file, hỏi lại người dùng). Đường chạy
     này là LLM trần qua OpenRouter — không tool, không file, không hỏi lại được. Không nói rõ
     điều đó thì model sẽ phát ra lệnh gọi WebFetch rồi dừng, hoặc hỏi ngược lại và không ra
     sản phẩm nào. Nên mọi prompt đều mở đầu bằng khung điều kiện thực thi này. */
  const EXEC_CONTEXT = [
    `## ĐIỀU KIỆN THỰC THI (ưu tiên cao hơn mọi hướng dẫn trong SKILL.md bên dưới)`,
    `- Bạn đang chạy KHÔNG CÓ TOOL: không WebFetch, không WebSearch, không đọc/ghi file.`,
    `  Tuyệt đối không phát ra lệnh gọi tool dưới bất kỳ dạng nào — chúng sẽ không được thực thi.`,
    `- Không hỏi lại người dùng. Không có ai trả lời. Thiếu thông tin thì nêu rõ là thiếu rồi làm tiếp`,
    `  phần làm được, hoặc ghi "chưa kiểm chứng" thay vì bịa.`,
    `- Mọi bước trong skill yêu cầu tạo/ghi file: BỎ QUA phần ghi file, thay bằng in nội dung ra trả lời.`,
    `- Chỉ dùng dữ kiện có trong phần NGUỒN được cung cấp bên dưới (nếu có). Không có nguồn thì`,
    `  không được khẳng định số liệu cụ thể (giá, giờ mở cửa, khoảng cách) — ghi rõ là cần kiểm chứng.`,
  ].join("\n");

  // Prompt = điều kiện thực thi + toàn văn SKILL.md thật + nhiệm vụ của lượt chạy này
  async function stagePrompt(stageKey, nhiemVu) {
    const skillId = STAGE_SKILL[stageKey];
    const md = await loadSkill(skillId);
    if (!md) {
      return `${EXEC_CONTEXT}\n\n⚠️ Không đọc được marketing/skills/${skillId}/SKILL.md.\n\n${nhiemVu}`;
    }
    const tplId = STAGE_TEMPLATE[stageKey];
    const tpl = await loadTemplate(tplId);
    return [
      EXEC_CONTEXT, ``,
      `Bạn đang thực thi skill \`${skillId}\` của AI OS. Toàn văn skill:`,
      ``, `--- BẮT ĐẦU SKILL.md ---`, md, `--- HẾT SKILL.md ---`, ``,
      tpl ? `Skill có nhắc tới file \`${tplId}\`. Toàn văn file đó:\n\n--- BẮT ĐẦU ${tplId} ---\n${tpl}\n--- HẾT ${tplId} ---\n` : "",
      `Làm đúng theo skill trên (trong giới hạn điều kiện thực thi) cho nhiệm vụ sau:`, ``, nhiemVu,
    ].filter(Boolean).join("\n");
  }

  // Proxy đọc hộ trang nguồn — trả về { text, ngay_truy_cap, truncated } hoặc null
  async function fetchSourceText(url) {
    if (!url || !/^https?:\/\//i.test(url)) return null;
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/marketing/fetch?url=${encodeURIComponent(url)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.text) throw new Error(d.error || `Proxy trả lỗi ${res.status}`);
      return d;
    } catch (e) {
      console.warn("[work] Không đọc được trang nguồn:", e.message);
      return null;
    }
  }

  // Dự án chứa mọi phiếu content cluster; tạo một lần rồi dùng lại
  function ensureClusterProject() {
    let p = S.projects.find((x) => x.name === CLUSTER_PROJECT_NAME);
    if (p) return p;
    const pm = S.agentOwners[CLUSTER_AGENTS.writer] || S.staff[0].id;
    p = {
      id: newId("p"), name: CLUSTER_PROJECT_NAME,
      customer: (S.customers[0] || {}).id, pm,
      members: [...new Set(Object.values(CLUSTER_AGENTS).map((a) => S.agentOwners[a]).filter(Boolean))],
      start: today(), deadline: dOff(30), status: "Đang thực hiện",
      desc: "Dự án thường trực chứa các phiếu sản xuất Topic Cluster do đội AI Agent marketing thực hiện.",
      docs: [], public: false,
    };
    S.projects.push(p);
    return p;
  }

  // Tạo một công việc đã gán sẵn cho Agent
  function addAgentTask(ticketId, title, agentId, prio) {
    const executor = { type: "agent", id: agentId };
    const k = {
      id: newId("k"), ticket: ticketId, title, executor,
      owner: defaultOwner(executor), status: "Mới", prio: prio || "Cao",
      start: today(), deadline: ticketById(ticketId).deadline,
      progress: 0, reports: [],
    };
    S.tasks.push(k);
    return k;
  }

  /* Chạy một Agent trên một công việc, ghi kết quả thành báo cáo. Trả về text hoặc null.
     autoApprove = true  → công việc đóng luôn ở "Hoàn tất" (chế độ chạy tự động cả cluster).
     autoApprove = false → dừng ở "Chờ duyệt" để người soát tay (dùng khi bấm Chạy lại). */
  async function runTaskViaProxy(k, promptOverride, opts) {
    const autoApprove = !opts || opts.autoApprove !== false;
    const a = agentById(k.executor.id);
    if (!a) return null;
    const started = Date.now();
    k.status = "Đang thực hiện"; k.progress = 10; save();
    const prompt = promptOverride || buildPrompt(k, a);
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/agents/${encodeURIComponent(k.executor.id)}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Proxy trả lỗi ${res.status}`);
      if (!data.reply) throw new Error("Agent không trả về nội dung");
      const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
      k.run = { status: "done", agentId: k.executor.id, mock: !!data.mock, model: data.model || null, output: data.reply, endedAt: new Date().toISOString() };
      k.progress = 100;
      k.status = autoApprove ? DONE : "Chờ duyệt";
      k.reports.push({
        at: today(), progress: 100,
        note: (data.mock ? "🧪 [MOCK_MODE] " : "")
          + (autoApprove ? "[Tự động duyệt theo rule chạy liền mạch] " : "[Chạy lại — chờ soát tay] ")
          + data.reply,
        by: k.owner, byType: "agent", agentId: k.executor.id, minutes,
      });
      save();
      if (typeof addFeed === "function") addFeed(
        `<b>${esc(a.name)}</b> hoàn thành "${esc(k.title)}"${autoApprove ? " — tự động duyệt" : ` — chờ ${esc(staffName(k.owner))} soát`}.`, "f-done");
      return data.reply;
    } catch (e) {
      k.run = { status: "failed", agentId: k.executor.id, error: e.message, endedAt: new Date().toISOString() };
      // Để "Đang thực hiện" thì việc hỏng trông y hệt việc đang chạy và sẽ trôi mất trong
      // bảng. Đặt Tạm dừng để nó nổi lên rõ, người soát bấm "Chạy lại" đúng mục này.
      k.status = "Tạm dừng";
      k.reports.push({
        at: today(), progress: k.progress,
        note: `⚠️ Không chạy được ${a.name}: ${e.message}`,
        by: k.owner, byType: "agent", agentId: k.executor.id,
      });
      save();
      if (typeof addFeed === "function") addFeed(`<b>${esc(a.name)}</b> lỗi ở "${esc(k.title)}" — cần soát tay.`, "f-rule");
      return null;
    }
  }

  // Tách danh sách bài từ blueprint của mkt-4. Không parse được thì trả mảng rỗng —
  // KHÔNG bịa ra danh sách bài, vì như vậy sẽ sinh công việc cho những bài không có thật.
  function parseBlueprint(text) {
    if (!text) return [];

    // Lấy phần JSON: ưu tiên khối có rào đóng; nếu phản hồi bị cắt giữa chừng thì
    // lấy từ rào mở tới hết chuỗi. Không có rào thì tìm object thô chứa "pillar".
    let raw = null;
    const closed = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (closed) raw = closed[1];
    else {
      const open = text.match(/```(?:json)?\s*([\s\S]*)$/i);
      if (open) raw = open[1];
      else {
        const i = text.indexOf('{"pillar"') >= 0 ? text.indexOf('{"pillar"') : text.search(/\{\s*"pillar"/);
        if (i >= 0) raw = text.slice(i);
      }
    }
    if (!raw) return [];

    const build = (d) => {
      const list = [];
      if (d.pillar && d.pillar.tieu_de) list.push({ ma_bai: "P-00", tieu_de: d.pillar.tieu_de, tu_khoa: d.pillar.tu_khoa_chinh || "" });
      (d.cluster || []).forEach((c, i) => {
        if (!c || !c.tieu_de) return;
        list.push({ ma_bai: c.ma_bai || `C-${String(i + 1).padStart(2, "0")}`, tieu_de: c.tieu_de, tu_khoa: c.tu_khoa_chinh || "" });
      });
      return list;
    };

    try { return build(JSON.parse(raw)); } catch (e) { /* rơi xuống nhánh cứu JSON cụt */ }

    /* Phản hồi bị cắt → JSON không đóng ngoặc. Vớt lại các phần tử ĐÃ hoàn chỉnh
       thay vì bỏ cả blueprint: chỉ nhận object nào có đủ tieu_de, không đoán phần dở dang. */
    const salvage = [];
    const pill = raw.match(/"pillar"\s*:\s*\{[\s\S]*?"tieu_de"\s*:\s*"([^"]+)"[\s\S]*?"tu_khoa_chinh"\s*:\s*"([^"]*)"/);
    if (pill) salvage.push({ ma_bai: "P-00", tieu_de: pill[1], tu_khoa: pill[2] });
    const re = /"ma_bai"\s*:\s*"([^"]+)"\s*,\s*"tieu_de"\s*:\s*"([^"]+)"\s*,\s*"tu_khoa_chinh"\s*:\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(raw)) !== null) salvage.push({ ma_bai: m[1], tieu_de: m[2], tu_khoa: m[3] });
    if (salvage.length) console.warn(`[work] Blueprint S2 bị cắt — vớt được ${salvage.length} bài hoàn chỉnh.`);
    return salvage;
  }

  const PIPE_LOG = [];
  function pipeLog(icon, text) {
    PIPE_LOG.push({ icon, text, at: new Date().toLocaleTimeString("vi-VN") });
    const box = fld("wk_pipe_log");
    if (box) {
      box.innerHTML = PIPE_LOG.map((l) => `<div class="wk-step ok"><span class="ic">${l.icon}</span><span class="tx">${esc(l.text)}<span>${l.at}</span></span></div>`).join("");
      box.scrollTop = box.scrollHeight;
    }
  }

  function mNewCluster() {
    const ags = Object.entries(CLUSTER_AGENTS).map(([vai, id]) => {
      const a = agentById(id);
      return `<span class="wk-chip">${esc(a ? a.icon || "🤖" : "")} ${esc(a ? a.name : id)} <span class="wk-owner">· ${esc(staffName(S.agentOwners[id]))}</span></span>`;
    }).join("");
    openModal(modalHead("🔁", "Chạy vòng lặp Content Cluster", "Orches giao chủ đề → tạo phiếu → 4 Agent chạy lần lượt, mỗi Agent một công việc + một báo cáo.") + `
      <div class="hr-intake-form">
        <div class="hr-grid">
          <label class="span2">Chủ đề hoặc tiêu đề nguồn <span class="req">*</span><input type="text" id="wk_cl_topic" placeholder="VD: Cẩm nang du lịch Nha Trang từ A đến Z"></label>
          <label class="span2">Link nguồn (nếu có)<input type="text" id="wk_cl_url" placeholder="https://..."></label>
        </div>
        <h4>Đội thực thi</h4>
        <div>${ags}</div>
        <p class="bf-hint" style="margin:.7rem 0 0">Mỗi Agent chạy xong tạo một công việc kèm báo cáo trong phiếu. Kết quả dừng ở <b>Chờ duyệt</b> — Agent không tự đóng việc của mình.</p>
        <div class="bf-actions" style="margin-top:1.2rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Hủy</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="start-cluster">▶ Tạo phiếu &amp; chạy</button>
        </div>
      </div>`);
  }

  /* ---------- Đưa bài viết ra kho thật ----------
     Engine chạy trong trình duyệt nên KHÔNG ghi được đĩa. Trước đây bài viết chỉ nằm
     trong task.run.output ở localStorage — xoá cache là mất sạch, đã mất 11 bài một lần.
     Giờ mỗi bài xong là đẩy ngay qua proxy để có file .md trên đĩa + bản Firestore. */
  async function nextClusterId() {
    const nam = new Date().getFullYear();
    try {
      const res = await fetch(`${WORK_PROXY_BASE}/api/db/clusters`);
      if (res.ok) {
        const d = await res.json();
        const re = new RegExp(`^CLS-${nam}-(\\d+)$`);
        const max = (d.clusters || [])
          .map((c) => (String(c.cluster).match(re) || [])[1])
          .filter(Boolean).map(Number)
          .reduce((m, n) => Math.max(m, n), 0);
        return `CLS-${nam}-${String(max + 1).padStart(3, "0")}`;
      }
    } catch (e) { /* proxy chưa chạy — rơi xuống mã theo thời điểm bên dưới */ }
    return `CLS-${nam}-T${String(Date.now()).slice(-6)}`;
  }

  async function saveArticleToStore(payload) {
    try {
      // Có hạn giờ: proxy treo ở đây sẽ đứng cả vòng lặp 11 bài mà không báo gì
      const res = await fetchCoHan(`${WORK_PROXY_BASE}/api/db/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 30000);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Proxy trả lỗi ${res.status}`);
      return d;
    } catch (e) {
      return { saved: false, error: e.name === "AbortError" ? "proxy không phản hồi sau 30s" : e.message };
    }
  }

  async function startContentCluster(topic, sourceUrl) {
    if (!topic || !topic.trim()) return say("Cần một chủ đề hoặc link nguồn");
    PIPE_LOG.length = 0;

    const clusterId = await nextClusterId();
    const p = ensureClusterProject();
    const maxCode = S.tickets.reduce((m, t) => Math.max(m, t.code || 0), 49000);
    const ticket = {
      id: newId("t"), code: maxCode + 1,
      title: `Content Cluster: ${topic.slice(0, 90)}`,
      project: p.id, type: "Yêu cầu phát triển phần mềm",
      status: "Đang thực hiện", prio: "Cao", deadline: dOff(7),
      assignees: [...new Set(Object.values(CLUSTER_AGENTS).map((a) => S.agentOwners[a]).filter(Boolean))],
      cluster: clusterId,
      desc: `Sản xuất trọn bộ Topic Cluster (1 Pillar + N Cluster) từ nguồn: ${sourceUrl || topic}.\nMã cluster: ${clusterId} — bài viết lưu tại marketing/data/bai-viet/${clusterId}/.\nToàn bộ do đội AI Agent marketing thực hiện, người chịu trách nhiệm duyệt từng mục.`,
    };
    S.tickets.push(ticket);
    save();
    say(`Đã tạo phiếu #${ticket.code} — giao đội AI Agent ✓`);
    if (typeof addFeed === "function") addFeed(`<b>Orches</b> mở phiếu <b>#${ticket.code}</b> "Content Cluster" và giao cho đội marketing.`, "f-orches");

    openModal(modalHead("🔁", `Vòng lặp Content Cluster — phiếu #${ticket.code}`, esc(topic.slice(0, 120))) + `
      <div class="hr-intake-form">
        <div class="wk-note">Mỗi Agent chạy xong sẽ tạo <b>một công việc</b> trong phiếu này kèm <b>báo cáo</b>.
        Hết vòng lặp, phiếu được ghi chú hoàn thành. Người chịu trách nhiệm vẫn phải duyệt từng mục.</div>
        <div id="wk_pipe_log" class="wk-steps" style="max-height:340px;overflow-y:auto"></div>
        <div class="bf-actions" style="margin-top:1rem">
          <button class="btn btn-ghost btn-sm" type="button" data-act="modal-close">Đóng</button>
          <button class="btn btn-primary btn-sm" type="button" data-act="go" data-view="ticketDetail" data-id="${ticket.id}">Mở phiếu #${ticket.code}</button>
        </div>
      </div>`);

    pipeLog("📋", `Đã tạo phiếu #${ticket.code} trong dự án "${p.name}" — mã cluster ${clusterId}`);

    // ---- S1: nghiên cứu & bóc tách ----
    const k1 = addAgentTask(ticket.id, "S1 · Nghiên cứu nguồn & bóc tách chủ đề con", CLUSTER_AGENTS.research);
    save(); render();
    pipeLog("🔎", `Công việc S1 giao ${agentById(CLUSTER_AGENTS.research).name} — đang chạy…`);
    // Đọc trang nguồn TRƯỚC khi gọi agent — agent không tự duyệt web được
    const src = await fetchSourceText(sourceUrl);
    pipeLog(src ? "🌐" : "⚠️", src
      ? `Đã đọc trang nguồn: ${src.chars.toLocaleString("vi-VN")} ký tự${src.truncated ? " (cắt bớt)" : ""}`
      : sourceUrl ? "Không đọc được trang nguồn — S1 sẽ chỉ làm được phần không cần nguồn" : "Không có link nguồn — chạy theo chủ đề tự do");

    const out1 = await runTaskViaProxy(k1, await stagePrompt("research", [
      `Chủ đề gốc: ${topic}`,
      `Nguồn: ${sourceUrl || "(không có link, chủ đề tự do)"}`,
      src ? `Ngày truy cập nguồn: ${src.ngay_truy_cap}` : "",
      ``,
      src ? `--- NỘI DUNG TRANG NGUỒN (đã đọc hộ, dùng đúng dữ kiện trong đây) ---\n${src.text}\n--- HẾT NGUỒN ---\n` : "",
      `Trả về: (1) tóm tắt nguồn, (2) danh sách thực thể/chủ đề con kèm lý do chọn hoặc loại`,
      `theo đúng 3 câu hỏi sàng lọc trong skill.`,
    ].filter(Boolean).join("\n")));
    pipeLog(out1 ? "✅" : "⚠️", out1 ? "S1 xong — đã ghi báo cáo, chờ duyệt" : "S1 lỗi — xem báo cáo trong công việc");

    // ---- S2: kiến trúc SEO ----
    const k2 = addAgentTask(ticket.id, "S2 · Kiến trúc SEO & ma trận liên kết", CLUSTER_AGENTS.seo);
    save(); render();
    pipeLog("🗺️", `Công việc S2 giao ${agentById(CLUSTER_AGENTS.seo).name} — đang chạy…`);
    const out2 = await runTaskViaProxy(k2, await stagePrompt("seo", [
      `Chủ đề gốc: ${topic}`,
      ``,
      `KẾT QUẢ NGHIÊN CỨU TỪ S1:`, (out1 || "(S1 chưa có kết quả)").slice(0, 6000),
      ``,
      `BẮT BUỘC: kết thúc câu trả lời bằng đúng một khối \`\`\`json, và khối đó phải TỐI GIẢN —`,
      `mỗi bài chỉ 3 trường ma_bai, tieu_de, tu_khoa_chinh theo đúng thứ tự này, không thêm`,
      `tu_khoa_phu/tu_khoa_lsi/meta vào khối JSON (viết chúng ở phần văn xuôi phía trên).`,
      `Khối JSON dài dòng sẽ bị cắt và cả blueprint mất tác dụng.`,
      `{"pillar":{"tieu_de":"...","tu_khoa_chinh":"..."},"cluster":[{"ma_bai":"C-01","tieu_de":"...","tu_khoa_chinh":"..."}]}`,
    ].join("\n")));
    pipeLog(out2 ? "✅" : "⚠️", out2 ? "S2 xong — đã ghi báo cáo, chờ duyệt" : "S2 lỗi — xem báo cáo trong công việc");

    // ---- S3 + S4: vòng lặp từng bài ----
    const bai = parseBlueprint(out2);
    if (!bai.length) {
      pipeLog("⛔", "Không đọc được danh sách bài từ blueprint S2 — dừng vòng lặp, KHÔNG tự bịa danh sách bài.");
      ticket.status = "Tạm dừng";
      const kx = addAgentTask(ticket.id, "⚠️ Cần người chốt danh sách bài trước khi viết", CLUSTER_AGENTS.seo, "Cao");
      kx.status = "Chờ duyệt"; kx.progress = 0;
      kx.reports.push({
        at: today(), progress: 0,
        note: "S2 không trả về khối JSON blueprint nên không biết cần viết bao nhiêu bài. Hãy duyệt/nhập tay danh sách bài rồi chạy lại vòng lặp. Ở MOCK_MODE điều này là bình thường — Agent chưa nối Hermes thật nên không sinh được blueprint.",
        by: kx.owner, byType: "agent", agentId: CLUSTER_AGENTS.seo,
      });
      save(); render();
      say("Vòng lặp dừng ở S2 — cần chốt danh sách bài");
      return ticket;
    }

    pipeLog("📝", `Blueprint có ${bai.length} bài — bắt đầu vòng lặp viết`);
    for (const b of bai) {
      const kw = addAgentTask(ticket.id, `S3 · Viết bài ${b.ma_bai} — ${b.tieu_de}`.slice(0, 120), CLUSTER_AGENTS.writer);
      save(); render();
      pipeLog("✍️", `${b.ma_bai} — đang viết…`);
      const outW = await runTaskViaProxy(kw, await stagePrompt("writer", [
        `Viết trọn bài ${b.ma_bai} — loại: ${b.ma_bai === "P-00" ? "PILLAR (trụ cột)" : "CLUSTER (vệ tinh)"}.`,
        `Tiêu đề: ${b.tieu_de}`,
        `Từ khóa chính: ${b.tu_khoa}`,
        `Độ dài mục tiêu: ${b.ma_bai === "P-00" ? "2.000–2.500" : "1.200–1.800"} từ.`,
        `Các bài khác trong cluster (đừng giẫm góc nhìn): ${bai.map((x) => x.tieu_de).join(" · ")}`,
        ``,
        `CHỈ trả về nội dung bài viết: bắt đầu bằng frontmatter YAML theo đúng template,`,
        `rồi tới thân bài. Không in dòng trạng thái kiểu "▶ Đang viết…", không lời dẫn,`,
        `không giải thích quy trình — những thứ đó thuộc về hệ thống, không thuộc về file bài.`,
      ].join("\n")));
      pipeLog(outW ? "✅" : "⚠️", `${b.ma_bai} ${outW ? "viết xong" : "lỗi"} — đã ghi báo cáo`);

      /* Lưu NGAY từng bài, không đợi hết vòng: vòng lặp 11 bài chạy ~25 phút, đứt giữa
         chừng mà chưa lưu thì mất hết phần đã viết. */
      const hoSo = { cluster: clusterId, ma_bai: b.ma_bai, tieu_de: b.tieu_de,
        loai: b.ma_bai === "P-00" ? "pillar" : "cluster", tu_khoa_chinh: b.tu_khoa,
        nguon: sourceUrl || "", chu_de: topic, task_id: kw.id };
      if (outW) {
        const luu = await saveArticleToStore({ ...hoSo, noi_dung: outW });
        if (luu.saved) {
          kw.artifact = { cluster: clusterId, ma_bai: b.ma_bai, file: luu.file };
          pipeLog("💾", `${b.ma_bai} đã lưu → ${luu.file}${luu.firestore && luu.firestore.ok ? " + Firebase" : ""}`);
        } else {
          pipeLog("⛔", `${b.ma_bai} KHÔNG lưu được ra kho (${luu.error}) — bài chỉ còn trong báo cáo công việc, sẽ mất nếu xoá cache trình duyệt.`);
        }
        save();
      }

      const kp = addAgentTask(ticket.id, `S4 · Prompt ảnh ${b.ma_bai}`, CLUSTER_AGENTS.visual, "Trung bình");
      save(); render();
      pipeLog("🖼️", `${b.ma_bai} — đang dựng prompt ảnh…`);
      const outP = await runTaskViaProxy(kp, await stagePrompt("visual", [
        `Sinh AI Image Prompt cho mọi [IMAGE_PLACEHOLDER_X] trong bài ${b.ma_bai} dưới đây.`,
        `Chỉ tạo prompt, KHÔNG gọi công cụ sinh ảnh (bước đó cần duyệt credit riêng).`,
        ``, `BÀI VIẾT:`, (outW || "(chưa có nội dung bài)").slice(0, 8000),
      ].join("\n")));
      pipeLog(outP ? "✅" : "⚠️", `${b.ma_bai} prompt ảnh ${outP ? "xong" : "lỗi"} — đã ghi báo cáo`);

      // Ghi đè bài vừa lưu để đính kèm prompt ảnh — bài đã an toàn từ bước trên rồi
      if (outW && outP) {
        const luu2 = await saveArticleToStore({ ...hoSo, noi_dung: outW, prompt_anh: [outP] });
        if (luu2.saved) { kp.artifact = { cluster: clusterId, ma_bai: b.ma_bai, file: luu2.file }; save(); }
        pipeLog(luu2.saved ? "💾" : "⚠️", luu2.saved
          ? `${b.ma_bai} đã đính prompt ảnh vào bài đã lưu`
          : `${b.ma_bai} không đính được prompt ảnh vào kho (${luu2.error}) — prompt vẫn còn trong báo cáo S4`);
      }
    }

    // ---- Đóng phiếu ----
    const ks = ticketTasks(ticket.id);
    const loi = ks.filter((k) => k.run && k.run.status === "failed").length;
    ticket.status = loi ? "Tạm dừng" : "Hoàn tất";
    const daLuu = ks.filter((k) => k.artifact).length;
    ticket.desc += `\n\n— Vòng lặp kết thúc ${fmtD(today())}: ${ks.length} công việc, ${ks.length - loi} thành công, ${loi} lỗi.`
      + (loi ? " Phiếu để Tạm dừng do có mục chạy lỗi." : " Mọi mục đã có báo cáo, chờ người chịu trách nhiệm duyệt để đóng từng công việc.")
      + `\n— Bài viết: ${daLuu ? `đã lưu vào marketing/data/bai-viet/${clusterId}/` : "KHÔNG lưu được ra kho, chỉ còn trong báo cáo công việc"}.`;
    save(); render();
    pipeLog(daLuu ? "📦" : "⛔", daLuu
      ? `Bài viết nằm tại marketing/data/bai-viet/${clusterId}/ — mở được bằng editor, không mất khi xoá cache`
      : "Không lưu được bài nào ra kho — kiểm tra Backend Proxy rồi chạy lại");
    pipeLog(loi ? "⚠️" : "🏁", loi
      ? `Xong vòng lặp nhưng có ${loi} mục lỗi — phiếu #${ticket.code} để Tạm dừng`
      : `Hoàn tất phiếu #${ticket.code} — ${ks.length} công việc đều có báo cáo`);
    if (typeof addFeed === "function") addFeed(`Phiếu <b>#${ticket.code}</b> Content Cluster kết thúc — ${ks.length} công việc, ${loi} lỗi.`, loi ? "f-rule" : "f-done");
    say(loi ? `Phiếu #${ticket.code}: có ${loi} mục lỗi` : `Phiếu #${ticket.code} hoàn tất ✓`);
    return ticket;
  }

  /* ================= SỰ KIỆN ================= */
  function renderKeepFocus(filterKey) {
    render();
    const el = document.querySelector(`[data-filter="${filterKey}"]`);
    if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
  }

  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const d = el.dataset;
    switch (d.act) {
      // Điều hướng luôn thay màn hình chính, nên modal đang che phải đóng theo —
      // không thì bấm "Mở phiếu" xong vẫn thấy y nguyên cửa sổ cũ.
      case "go": closeModal(); show(d.view, d.id); break;
      case "sort":
        if (KF.sortKey === d.key) KF.sortDir *= -1; else { KF.sortKey = d.key; KF.sortDir = 1; }
        render(); break;
      case "mode": KF.mode = d.mode; render(); break;
      case "new-project": mNewProject(); break;
      case "new-ticket": mNewTicket(d.project); break;
      case "new-task": mNewTask(d.ticket); break;
      case "report": mReport(d.id); break;
      case "approve": approveTask(d.id); break;
      case "reject": rejectTask(d.id); break;
      case "save-project": saveProject(); break;
      case "save-ticket": saveTicket(); break;
      case "save-task": saveTask(); break;
      case "save-report": saveReport(CURRENT_REPORT); break;
      case "modal-close": closeModal(); break;
      case "qa-toggle": QA[d.ticket] = !QA[d.ticket]; render();
        { const i = document.querySelector(`[data-qa-title="${d.ticket}"]`); if (i) i.focus(); } break;
      case "qa-save": qaSave(d.ticket); break;
      case "qa-cancel": QA[d.ticket] = false; render(); break;
      case "toggle-public": {
        const p = projectById(d.id);
        if (p) { p.public = !p.public; save(); say(p.public ? "Đã bật public — khách hàng xem được tiến độ" : "Đã tắt public"); render(); }
        break;
      }
      case "pick-staff": SF = d.id || ""; render(); break;
      // Sang mặt phẳng ra lệnh: mở đúng Agent trong Dashboard đội Agent
      case "agent-chat":
      case "agent-profile":
        if (typeof showSection === "function") showSection("roster");
        if (typeof openDrawer === "function") openDrawer(d.agent, d.act === "agent-chat" ? "chat" : "info");
        else say("Không mở được hồ sơ Agent — thiếu js/app.js");
        break;
      case "assign-agent": mAssignAgent(d.id); break;
      case "confirm-assign": confirmAssign(d.id, false); break;
      case "confirm-assign-run": confirmAssign(d.id, true); break;
      case "run-agent": mRunAgent(d.id); break;
      case "task-chat": mTaskChat(d.id); break;
      case "chat-send": sendChat(d.id); break;
      case "chat-to-report": chatToReport(d.id); break;
      case "start-run": startRun(d.id); break;
      case "unassign-agent": unassignAgent(d.id); break;
      case "new-cluster": mNewCluster(); break;
      case "start-cluster": {
        const topic = val("wk_cl_topic");
        if (!topic) return say("Nhập chủ đề hoặc dán link nguồn");
        startContentCluster(topic, val("wk_cl_url") || topic);
        break;
      }
      // ---- Kho Lead ----
      case "lead-harvest": {
        // Bấm từ cửa "chạy lại" của một việc trong pipeline → điền sẵn đúng nguồn cũ
        const k = d.id ? taskById(d.id) : null;
        mLeadHarvest(k && k.leadSrc ? k.leadSrc : null);
        break;
      }
      case "lead-harvest-run": {
        const u = val("wk_lh_url");
        const txt = fld("wk_lh_text") ? fld("wk_lh_text").value.trim() : "";
        if (!u && !txt) return say("Dán link nguồn hoặc nội dung bình luận");
        startLeadHarvest(u, txt);
        break;
      }
      case "lead-new": mNewLead(); break;
      case "lead-detail": mLeadDetail(d.id); break;
      case "lead-save": saveLead(d.id || ""); break;
      case "lead-delete": deleteLead(d.id); break;
      case "lead-invite": mLeadInvite(d.id); break;
      case "lead-invite-save": saveLeadInvite(); break;
      case "lead-csv": exportLeadsCsv(); break;
      case "lead-backup": backupLeads(); break;
      case "lead-restore": restoreLeads(); break;
      case "reset": reset(); say("Đã nạp lại dữ liệu mẫu điều hành công việc"); break;
    }
  }

  function onFilterChange(e) {
    const el = e.target.closest("[data-filter]");
    if (!el) return;
    // select/checkbox chỉ xử lý ở "change" để không render hai lần
    if (e.type === "input" && !(el.tagName === "INPUT" && el.type !== "checkbox")) return;
    const [group, key] = el.dataset.filter.split(".");
    if (group === "c") { PC = el.value; render(); return; } // chọn khách hàng ở Portal
    const store = group === "t" ? TF : group === "r" ? RF : group === "l" ? LF : KF;
    store[key] = el.type === "checkbox" ? el.checked : el.value;
    if (key === "kw") renderKeepFocus(el.dataset.filter); else render();
  }

  function onKey(e) {
    const qa = e.target.closest("[data-qa-title]");
    if (!qa) return;
    if (e.key === "Enter") { e.preventDefault(); qaSave(qa.dataset.qaTitle); }
    else if (e.key === "Escape") { QA[qa.dataset.qaTitle] = false; render(); }
  }

  // Kéo thả thẻ Kanban để đổi trạng thái
  function bindKanbanDnd(host) {
    const cards = host.querySelectorAll(".wk-card[draggable]");
    if (!cards.length) return;
    let dragId = null;
    cards.forEach((c) => {
      c.addEventListener("dragstart", (e) => {
        dragId = c.dataset.task;
        c.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragId);
      });
      c.addEventListener("dragend", () => { c.classList.remove("dragging"); dragId = null; });
    });
    host.querySelectorAll(".wk-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
      col.addEventListener("dragleave", () => col.classList.remove("over"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("over");
        const id = dragId || e.dataTransfer.getData("text/plain");
        const k = taskById(id);
        const status = col.dataset.col;
        if (!k || !status || k.status === status) return;
        k.status = status;
        if (isDone(status)) k.progress = 100;
        else if (status === "Đang thực hiện" && k.progress === 0) k.progress = 5;
        k.reports.push({
          at: today(), progress: k.progress,
          note: `Chuyển trạng thái sang "${status}" trên bảng Kanban.`,
          by: isAgentTask(k) ? k.owner : k.executor.id, byType: "human",
        });
        save(); render();
      });
    });
  }

  function bindHost() {
    const host = $("#workView");
    if (!host || host.__wkBound) return;
    host.__wkBound = true;
    host.addEventListener("click", onClick);
    host.addEventListener("input", onFilterChange);
    host.addEventListener("change", onFilterChange);
    host.addEventListener("keydown", onKey);
    ensureModalHost().addEventListener("click", onClick);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  /* Không Agent nào được phép không có người chịu trách nhiệm. Dữ liệu đã lưu từ
     trước khi thêm Agent mới sẽ thiếu, nên vá ngay lúc nạp thay vì để rơi về
     nhân sự đầu danh sách một cách âm thầm. */
  function ensureAgentOwners() {
    let added = 0;
    agentList().forEach((a) => {
      if (!S.agentOwners[a.id]) {
        const byDept = { mkt: "s9", sales: "s8", hr: "s2", fin: "s1", legal: "s2", cskh: "s10" };
        S.agentOwners[a.id] = byDept[a.dept] || S.staff[0].id;
        added++;
      }
    });
    if (added) save();
    return added;
  }

  /* Kho Lead được thêm sau P4 — dữ liệu đã lưu trước đó không có mảng này.
     Vá lúc nạp thay vì đổi SCHEMA_VERSION, để người dùng không mất dự án/phiếu đang chạy. */
  function ensureLeads() {
    if (!Array.isArray(S.leads)) { S.leads = seedLeads(); save(); return true; }
    return false;
  }

  /* Công việc thu thập Lead tạo trước khi có cờ "engine" sẽ bị nút ▶ Chạy Agent đẩy
     nhầm sang khung chat Hermes. Gắn cờ lại theo dự án chứa chúng. */
  function ensureLeadTaskTags() {
    const p = S.projects.find((x) => x.name === LEAD_PROJECT_NAME);
    if (!p) return 0;
    const tids = new Set(S.tickets.filter((t) => t.project === p.id).map((t) => t.id));
    let n = 0;
    S.tasks.forEach((k) => { if (!k.engine && tids.has(k.ticket)) { k.engine = "lead-harvest"; n++; } });
    if (n) save();
    return n;
  }

  // ---------- Khởi động ----------
  // Nạp đồng bộ từ localStorage trước để giao diện hiện ngay, rồi mới hỏi máy chủ ở
  // nền — proxy chậm hay chưa bật đều không làm người dùng phải nhìn màn hình trắng.
  S = load();
  ensureAgentOwners();
  ensureLeads();
  ensureLeadTaskTags();
  saveLocal();
  refreshCounters();
  bindHost();
  hydrateFromServer();

  window.AIOS_WORK = {
    show,
    reset,
    save,
    get state() { return S; },
    metrics,
    helpers: {
      projectProgress, ticketProgress, needsReport, isLate, isDone,
      staffName, customerName, executorLabel, isAgentTask, fmtD, esc, today, dOff,
      projectById, ticketById, taskById, ticketTasks, projectTickets, agentById,
    },
    PROXY_BASE: WORK_PROXY_BASE,
    // Orches gọi vào đây khi nhận lệnh sản xuất content cluster
    startContentCluster,
    CLUSTER_AGENTS,
    // Orches gọi vào đây khi nhận lệnh thu thập Lead từ mạng xã hội
    startLeadHarvest,
    LEAD_AGENT,
    leads: { types: LEAD_TYPES, services: LEAD_SERVICES, status: LEAD_STATUS, merge: mergeLeads },
  };
})();
