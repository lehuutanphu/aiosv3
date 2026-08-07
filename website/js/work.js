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
  // Ngày sinh theo thời điểm mở dashboard để phần trễ hạn / thiếu báo cáo
  // luôn có ý nghĩa, không bị "chết cứng" ở một mốc quá khứ.
  function seed() {
    const staff = [
      { id: "s1", name: "Lê Kính Hảo", title: "Trưởng nhóm giải pháp" },
      { id: "s2", name: "Nguyễn Huy Hoàng", title: "Quản lý dự án" },
      { id: "s3", name: "Đỗ Quốc Thắng", title: "Kỹ sư phần mềm" },
      { id: "s4", name: "Lê Hữu Tấn Phú", title: "Kỹ sư phần mềm" },
      { id: "s5", name: "Phạm Anh Tu", title: "Lập trình viên ứng dụng" },
      { id: "s6", name: "Nguyễn Thành Đạt", title: "Lập trình viên backend" },
      { id: "s7", name: "Ngọc Duy", title: "Kỹ sư AI / NLU" },
      { id: "s8", name: "Trần Thảo Uyển", title: "Chuyên viên tư vấn" },
      { id: "s9", name: "Trần Thanh Trà", title: "Quản lý sản phẩm" },
      { id: "s10", name: "Nguyễn Hà Duy Anh", title: "Chuyên viên hỗ trợ" },
    ];

    const customers = [
      { id: "c1", name: "TriAnh Solutions Company (Nội bộ)" },
      { id: "c2", name: "CTY TNHH MTV Cấp Nước Tiền Giang" },
      { id: "c3", name: "CN CTY CP Nhãn Khoa Mắt Sài Gòn" },
      { id: "c4", name: "CTY TNHH TM Huỳnh Thành" },
      { id: "c5", name: "CTY CP Cấp Nước Chợ Lớn" },
    ];

    // Mỗi AI Agent được giao cho đúng 1 nhân sự chịu trách nhiệm.
    const agentOwners = {
      "sales-1": "s8", "mkt-1": "s9", "mkt-2": "s9", "hr-1": "s2",
      "fin-1": "s1", "fin-2": "s1", "legal-1": "s2", "cskh-1": "s10", "cskh-2": "s10",
    };

    const projects = [
      { id: "p1", name: "Upgrade SmartBot 2.0", customer: "c1", pm: "s1", members: ["s1", "s3", "s7", "s5"], start: dOff(-68), deadline: dOff(54), status: "Đang thực hiện", desc: "Nâng cấp SmartBot lên phiên bản 2.0: NLU mới, tích hợp kênh Zalo/FB, dashboard giám sát.", docs: ["SRS_SmartBot2.pdf", "Wireframe_v3.fig"], public: true },
      { id: "p2", name: "TCRM App — Mobile & Desktop", customer: "c1", pm: "s9", members: ["s9", "s5", "s3", "s6", "s7"], start: dOff(-84), deadline: dOff(24), status: "Đang thực hiện", desc: "Phát triển TCRM trên Desktop và Mobile: danh sách công việc UI mới, chức năng File link, chat nội bộ.", docs: ["UI_Design_TCRM.fig"], public: false },
      { id: "p3", name: "Triển khai TCRM — CN Tiền Giang", customer: "c2", pm: "s2", members: ["s2", "s1", "s4", "s3"], start: dOff(-37), deadline: dOff(39), status: "Đang thực hiện", desc: "Triển khai TCRM cho Cấp Nước Tiền Giang: tổ chức chi nhánh cha–con, phân quyền xem phiếu/chat/khách hàng theo tổ chức con.", docs: ["HopDong_TG_2026.pdf", "BienBan_KhaoSat.docx"], public: true },
      { id: "p4", name: "Bảo trì Contact Center CNCL", customer: "c5", pm: "s2", members: ["s2", "s10"], start: dOff(-218), deadline: dOff(146), status: "Đang thực hiện", desc: "Gói bảo trì hệ thống Contact Center cho Cấp Nước Chợ Lớn năm 2026.", docs: ["HD_BaoTri_CNCL.pdf"], public: true },
      { id: "p5", name: "Tổng đài Nhãn Khoa MSG", customer: "c3", pm: "s8", members: ["s8", "s1", "s10"], start: dOff(-28), deadline: dOff(23), status: "Mới", desc: "Tư vấn và triển khai tổng đài 1 số nhiều ext cho hệ thống Nhãn Khoa Mắt Sài Gòn.", docs: [], public: false },
    ];

    const tickets = [
      { id: "t1", code: 49357, title: "Các việc phát triển cho TCRM CN Tiền Giang", project: "p3", type: "Yêu cầu phát triển phần mềm", status: "Mới", prio: "Trung bình", deadline: dOff(3), assignees: ["s10", "s1", "s2", "s3"], desc: "Tạo tổ chức chi nhánh (cha–con); phân quyền xem phiếu yêu cầu, chat, khách hàng của các tổ chức con." },
      { id: "t2", code: 49354, title: "Chức năng File link trên Desktop", project: "p2", type: "Testing phần mềm", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(3), assignees: ["s3", "s5"], desc: "Khi người dùng gửi đường dẫn file trên desktop, hệ thống nhận diện và mở nhanh file link." },
      { id: "t3", code: 49351, title: "Nhãn Khoa MSG — tổng đài 1 số ext", project: "p5", type: "Hỗ trợ khách hàng", status: "Mới", prio: "Trung bình", deadline: dOff(12), assignees: ["s8", "s1"], desc: "KH có nhu cầu hệ thống tổng đài 1 số nhiều máy nhánh, cần khảo sát và báo giá." },
      { id: "t4", code: 49348, title: "Điều chỉnh lại mẫu khảo sát SMS & ZNS", project: "p4", type: "Hỗ trợ khách hàng", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(-1), assignees: ["s10"], desc: "KH Huỳnh Thành nhờ thay đổi nội dung mẫu khảo sát gửi qua SMS & ZNS." },
      { id: "t5", code: 49345, title: "Cập nhật màn hình danh sách công việc theo UI design mới", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Hoàn tất", prio: "Trung bình", deadline: dOff(0), assignees: ["s5"], desc: "Làm lại màn hình danh sách công việc desktop theo UI design mới." },
      { id: "t6", code: 49288, title: "Khắc phục giật màn hình khi chuyển đổi menu trong màn hình chat", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Tạm dừng", prio: "Trung bình", deadline: dOff(7), assignees: ["s5"], desc: "Giật màn hình khi chuyển đổi giữa menu chức năng, ảnh và bàn phím trong màn hình chat." },
      { id: "t7", code: 49290, title: "Chức năng kho lưu trữ chat nội bộ", project: "p2", type: "Yêu cầu phát triển phần mềm", status: "Đang thực hiện", prio: "Trung bình", deadline: dOff(10), assignees: ["s6", "s7"], desc: "API /internal-chat: links, files, media cho kho lưu trữ." },
      { id: "t8", code: 49120, title: "Huấn luyện intent tiếng Việt cho SmartBot", project: "p1", type: "Yêu cầu phát triển phần mềm", status: "Đang thực hiện", prio: "Cao", deadline: dOff(28), assignees: ["s7", "s1"], desc: "Bộ intent nghiệp vụ cấp nước + huấn luyện mô hình NLU." },
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
      { id: "k14", ticket: "t9", title: "Soạn email cập nhật tiến độ tuần cho CN Tiền Giang", executor: A("sales-1"), owner: "s8", status: "Đang thực hiện", prio: "Cao", start: dOff(-1), deadline: dOff(1), progress: 50, reports: [{ at: dOff(-1), progress: 50, note: "Đã dựng bản nháp email theo mốc tiến độ phiếu #49357, chờ người phụ trách rà lại số liệu.", by: "s8", byType: "agent", agentId: "sales-1", minutes: 4 }] },
      { id: "k15", ticket: "t9", title: "Viết bài giới thiệu tính năng mới của SmartBot 2.0", executor: A("mkt-1"), owner: "s9", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(4), progress: 0, reports: [] },
      { id: "k16", ticket: "t9", title: "Rà soát điều khoản phụ lục gia hạn HĐ 878", executor: A("legal-1"), owner: "s2", status: "Chờ duyệt", prio: "Cao", start: dOff(-2), deadline: dOff(2), progress: 100, reports: [{ at: dOff(-2), progress: 100, note: "Phát hiện 2 điểm cần lưu ý: mốc thanh toán lệch 15 ngày so với hợp đồng gốc và thiếu điều khoản chấm dứt sớm. Đề xuất chỉnh trước khi gửi KH.", by: "s2", byType: "agent", agentId: "legal-1", minutes: 6 }] },
      { id: "k17", ticket: "t9", title: "Tổng hợp công nợ gói bảo trì CNCL quý 2", executor: A("fin-1"), owner: "s1", status: "Mới", prio: "Trung bình", start: dOff(0), deadline: dOff(5), progress: 0, reports: [] },
    ];

    return { version: SCHEMA_VERSION, staff, customers, agentOwners, projects, tickets, tasks };
  }

  // ---------- Lưu trữ ----------
  let S = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === SCHEMA_VERSION && Array.isArray(data.tasks)) return data;
      }
    } catch (e) {
      console.warn("[work] Không đọc được dữ liệu đã lưu, dùng lại dữ liệu mẫu:", e);
    }
    return seed();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch (e) {
      console.warn("[work] Không lưu được dữ liệu:", e);
    }
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

  // ---------- Điều hướng ----------
  const VIEW_META = {
    control: { icon: "🛰️", title: "Phòng điều hành", desc: "Toàn cảnh dự án, công việc, trễ hạn và tình trạng báo cáo của cả người lẫn AI Agent." },
    projects: { icon: "📁", title: "Dự án", desc: "Mỗi dự án gắn 1 khách hàng, 1 PM và nhóm nhân sự. Tiến độ cuộn lên từ công việc → phiếu → dự án." },
    tickets: { icon: "🎫", title: "Phiếu yêu cầu", desc: "Yêu cầu từ khách hàng hoặc nội bộ, luôn thuộc về đúng một dự án." },
    tasks: { icon: "✅", title: "Công việc", desc: "Đơn vị nhỏ nhất để giao việc — cho nhân sự hoặc cho AI Agent." },
    staff: { icon: "👥", title: "Nhân sự & Agent", desc: "Khối lượng việc của từng người, kèm các AI Agent mà người đó chịu trách nhiệm." },
    reports: { icon: "📈", title: "Báo cáo", desc: "Nhật ký báo cáo tiến độ. Người tự nhập, Agent tự sinh — cùng một dòng thời gian." },
    portal: { icon: "🌐", title: "Portal khách hàng", desc: "Trang khách hàng nhìn thấy: tiến độ và mốc thời gian, không lộ nhân sự hay ghi chú nội bộ." },
    flow: { icon: "🔄", title: "Luồng nghiệp vụ", desc: "Mô hình dữ liệu và luồng vận hành, bao gồm cả nhánh giao việc cho AI Agent." },
  };

  let VIEW = "control";

  function show(view) {
    VIEW = VIEW_META[view] ? view : "control";
    render();
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

  function todoPanel(phase, what) {
    return `
    <div class="wk-todo">
      <div class="ic">🚧</div>
      <b>Màn hình này được dựng ở ${esc(phase)}</b>
      <p>${what}</p>
      <span class="phase-tag">KHUNG DỮ LIỆU ĐÃ SẴN SÀNG</span>
    </div>`;
  }

  const VIEW_TODO = {
    control: ["P2", "Biểu đồ tải theo người và theo Agent, danh sách việc trễ hạn / thiếu báo cáo bấm được, và nhật ký hoạt động hợp nhất người + AI."],
    projects: ["P1", "Danh sách dự án, trang chi tiết với phiếu yêu cầu lồng bên trong, tài liệu đính kèm và công tắc public cho khách hàng."],
    tickets: ["P1", "Danh sách phiếu có bộ lọc theo dự án / khách hàng / trạng thái, trang chi tiết kèm các công việc bên trong và nút thêm nhanh."],
    tasks: ["P1", "Bảng công việc và bảng Kanban theo trạng thái, lọc theo người thực hiện, theo Agent và theo dự án."],
    staff: ["P2", "Khối lượng việc từng nhân sự, các Agent người đó chịu trách nhiệm kèm độ trưởng thành KWSR lấy từ hồ sơ Agent."],
    reports: ["P2", "Nhật ký báo cáo theo ngày/tuần, lọc theo người và Agent, cảnh báo công việc đang chạy mà không có báo cáo."],
    portal: ["P4", "Trang tiến độ dành cho khách hàng theo tone tối của AI OS, chỉ hiện dự án đã bật public."],
    flow: ["P4", "Sơ đồ mô hình dữ liệu 3 cấp, ma trận trạng thái và luồng giao việc cho AI Agent."],
  };

  function render() {
    const host = $("#workView");
    if (!host) return;
    const meta = VIEW_META[VIEW];
    const [phase, what] = VIEW_TODO[VIEW];

    host.innerHTML = `
      <div class="wk-head">
        <div class="wk-head-main">
          <h1>${meta.icon} ${esc(meta.title)}</h1>
          <p>${esc(meta.desc)}</p>
        </div>
        <div class="wk-head-actions">
          <button class="btn btn-ghost btn-sm" data-wk-reset title="Xóa dữ liệu đã lưu trên trình duyệt và nạp lại dữ liệu mẫu">↺ Nạp lại dữ liệu mẫu</button>
        </div>
      </div>
      ${kpiStrip()}
      ${todoPanel(phase, what)}`;

    const resetBtn = host.querySelector("[data-wk-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        reset();
        if (typeof toast === "function") toast("Đã nạp lại dữ liệu mẫu điều hành công việc");
      });
    }
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
  }

  // ---------- Khởi động ----------
  S = load();
  save();
  refreshCounters();

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
  };
})();
