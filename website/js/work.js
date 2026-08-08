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
      if (isDone(k.status)) return chat;
      const ran = k.run && k.run.status === "done";
      return `<button class="wk-minibtn go" data-act="run-agent" data-id="${k.id}" title="Cho Agent thực thi trọn công việc này">▶ ${ran ? "Chạy lại" : "Chạy Agent"}</button>${chat}`;
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
        <label class="span2">Tên dự án <span class="req">*</span><input type="text" id="wk_p_name" placeholder="VD: Triển khai TCRM — CN Bến Tre"></label>
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

    // 2. Ngữ cảnh
    setStep("context", "doing");
    const prompt = buildPrompt(k, a);
    setStep("context", "ok", `${prompt.length} ký tự ngữ cảnh · ${(a.rules || []).length} rule của Agent`);

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
      case "go": show(d.view, d.id); break;
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
    const store = group === "t" ? TF : group === "r" ? RF : KF;
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

  // ---------- Khởi động ----------
  S = load();
  save();
  refreshCounters();
  bindHost();

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
