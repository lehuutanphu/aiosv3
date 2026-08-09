// Module Tuyển dụng — thực thi THẬT bước B1 (nhu-cau-tuyen-dung) của pipeline hr/README.md
// và phục vụ nội dung SKILL.md thật cho Dashboard xem/điều phối.
//
// Chỉ B1 được làm quyết định (deterministic form → JSON) vì đây là bước duy nhất trong
// 10 bước không cần phán đoán của LLM — đúng như logic trong hr/skills/nhu-cau-tuyen-dung/SKILL.md.
// Các bước B2–B10 cần LLM thật (Hermes hr-1 đã cấu hình ở agents.config.json) hoặc connector
// chưa có (xem hr/README.md mục 3) — KHÔNG mô phỏng giả ở đây để tránh tạo cảm giác "đã xong"
// trong khi thực tế còn thiếu kết nối.

const fs = require("fs");
const path = require("path");
const { callChatModel } = require("./openrouter");
const excelSync = require("./excelSync");
const docxSync = require("./docxSync");

const HR_ROOT = path.join(__dirname, "..", "hr");
const AIOS_ROOT = path.join(HR_ROOT, "..");
const REQ_DIR = path.join(HR_ROOT, "data", "requisitions");
const HOSO_DIR = path.join(HR_ROOT, "data", "ho-so");
const SKILLS_DIR = path.join(HR_ROOT, "skills");
const AGENTS_DIR = path.join(HR_ROOT, "agents");
const TEMPLATE_PATH = path.join(HR_ROOT, "templates", "requisition.template.json");

// Bản đồ bước → skill kế tiếp, đúng "Bản đồ bước → skill" trong tuyen-dung/SKILL.md
const BUOC_MAP = {
  1: { ten: "Xác định nhu cầu", skill: "nhu-cau-tuyen-dung" },
  2: { ten: "Cập nhật JD", skill: "jd-va-tin-tuyen-dung" },
  3: { ten: "Đăng tin đa kênh", skill: "jd-va-tin-tuyen-dung" },
  4: { ten: "Thu nhận & sàng lọc CV", skill: "thu-nhan-sang-loc-cv" },
  5: { ten: "Hẹn & lên lịch phỏng vấn", skill: "lich-phong-van" },
  6: { ten: "Follow kết quả phỏng vấn", skill: "lich-phong-van" },
  7: { ten: "Chốt điều khoản offer", skill: "offer-va-luu-ho-so" },
  8: { ten: "Trình duyệt offer letter", skill: "offer-va-luu-ho-so" },
  9: { ten: "Gửi offer letter", skill: "offer-va-luu-ho-so" },
  10: { ten: "Lưu hồ sơ & đóng job", skill: "offer-va-luu-ho-so" },
};

const CAP_BAC_HOP_LE = ["Thực tập", "Nhân viên", "Chuyên viên", "Trưởng nhóm", "Quản lý"];
const HINH_THUC_HOP_LE = ["toan_thoi_gian", "ban_thoi_gian", "thoi_vu", "remote", "hybrid"];

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  const d = new Date();
  const tz = "+07:00";
  return d.toISOString().replace("Z", tz).replace(/\.\d+/, "");
}

function safeReadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw || !raw.trim()) return null; // file rỗng (vd REQ-TEST.json) — bỏ qua, không crash
  return JSON.parse(raw);
}

function isValidReqFilename(name) {
  return /^REQ-\d{4}-\d{3}\.json$/.test(name);
}

// ---------- Danh sách & chi tiết requisition ----------
function listRequisitions() {
  if (!fs.existsSync(REQ_DIR)) return [];
  const files = fs.readdirSync(REQ_DIR).filter(isValidReqFilename);
  const out = [];
  for (const f of files) {
    let data;
    try {
      data = safeReadJson(path.join(REQ_DIR, f));
    } catch (e) {
      out.push({ requisition_id: f.replace(".json", ""), loi: "File JSON hỏng — cần kiểm tra thủ công" });
      continue;
    }
    if (!data) continue; // file rỗng/placeholder (vd REQ-TEST.json)
    const buoc = BUOC_MAP[data.buoc_hien_tai] || { ten: "?", skill: null };
    const ungVien = Array.isArray(data.ung_vien)
      ? data.ung_vien.filter((u) => u && (u.ten || u.email))
      : [];
    out.push({
      requisition_id: data.requisition_id,
      vi_tri: data.vi_tri,
      trang_thai: data.trang_thai,
      buoc_hien_tai: data.buoc_hien_tai,
      buoc_ten: buoc.ten,
      buoc_ke_tiep: buoc.skill,
      ngay_mo: data.ngay_mo,
      so_ung_vien: ungVien.length,
    });
  }
  return out.sort((a, b) => String(b.ngay_mo).localeCompare(String(a.ngay_mo)));
}

function getRequisition(id) {
  if (!/^REQ-\d{4}-\d{3}$/.test(id)) throw err(400, `ID requisition không hợp lệ: "${id}"`);
  const filePath = path.join(REQ_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) throw err(404, `Không tìm thấy requisition "${id}"`);
  let data;
  try {
    data = safeReadJson(filePath);
  } catch (e) {
    throw err(500, `File "${id}.json" hỏng (JSON không hợp lệ) — cần kiểm tra thủ công, không tự đoán để vá`);
  }
  if (!data) throw err(404, `Requisition "${id}" rỗng`);
  return data;
}

function nextRequisitionId() {
  const year = new Date().getFullYear();
  let max = 0;
  if (fs.existsSync(REQ_DIR)) {
    for (const f of fs.readdirSync(REQ_DIR)) {
      const m = f.match(/^REQ-(\d{4})-(\d{3})\.json$/);
      if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
    }
  }
  const seq = String(max + 1).padStart(3, "0");
  return `REQ-${year}-${seq}`;
}

// Cảnh báo tự động — đúng nguyên văn logic trong nhu-cau-tuyen-dung/SKILL.md
function canhBaoThoiGian(onboardMongMuon) {
  const warnings = [];
  if (!onboardMongMuon) return warnings;
  const diffDays = Math.round((new Date(onboardMongMuon) - new Date(todayISODate())) / 86400000);
  if (Number.isNaN(diffDays)) return warnings;
  if (diffDays < 21) {
    warnings.push(
      "⏱️ Thời gian rất gấp. Chu kỳ tuyển trung bình cho vị trí này là 4–6 tuần. Cân nhắc: " +
        "(a) lùi ngày onboard, (b) dùng nguồn giới thiệu nội bộ song song, (c) hạ một số tiêu chí \"nên có\"."
    );
  }
  if (diffDays > 90) {
    warnings.push("📅 Ngày onboard còn khá xa — cân nhắc có nên hoãn mở đợt để JD sát thực tế hơn không.");
  }
  return warnings;
}

function required(v, label) {
  if (v === undefined || v === null || String(v).trim() === "") throw err(400, `Thiếu trường bắt buộc: "${label}"`);
  return v;
}

// ---------- B1 — Xác định nhu cầu tuyển dụng (thật, không mô phỏng) ----------
function createRequisition(input) {
  const viTri = input.vi_tri || {};
  const boiCanh = input.boi_canh || {};
  const nganSach = input.ngan_sach || {};
  const jdCu = input.jd_cu || {};
  const jdCuNoiDung = String(jdCu.noi_dung || "").trim();
  const jdCuDuongDan = String(jdCu.duong_dan || "").trim();

  required(viTri.ten, "Tên vị trí");
  required(viTri.phong_ban, "Phòng ban");
  required(viTri.cap_bac, "Cấp bậc");
  if (!CAP_BAC_HOP_LE.includes(viTri.cap_bac)) throw err(400, `Cấp bậc không hợp lệ: "${viTri.cap_bac}"`);
  required(viTri.bao_cao_cho, "Báo cáo cho");
  required(viTri.so_luong, "Số lượng cần tuyển");
  if (!(Number(viTri.so_luong) >= 1)) throw err(400, "Số lượng cần tuyển phải >= 1");
  required(viTri.hinh_thuc, "Hình thức làm việc");
  if (!HINH_THUC_HOP_LE.includes(viTri.hinh_thuc)) throw err(400, `Hình thức không hợp lệ: "${viTri.hinh_thuc}"`);
  required(viTri.ly_do_tuyen, "Lý do tuyển");
  required(viTri.onboard_mong_muon, "Ngày onboard mong muốn");
  required(viTri.onboard_muon_nhat, "Ngày onboard muộn nhất");
  required(boiCanh.thay_doi_doanh_nghiep, "Bối cảnh: doanh nghiệp đang thay đổi gì");
  required(boiCanh.tieu_chi_thanh_cong_6_thang, "Tiêu chí thành công sau 6 tháng");
  const baViec = (boiCanh.ba_viec_chinh_3_thang || []).filter((x) => x && x.trim());
  if (!baViec.length) throw err(400, "Cần ít nhất 1 việc chính trong 3 tháng đầu");

  // 🔴 Lương: tuyệt đối không tự điền — chỉ ghi đúng số user đưa, để null nếu chưa chốt
  const luongMin = nganSach.luong_min === "" || nganSach.luong_min === undefined ? null : Number(nganSach.luong_min);
  const luongMax = nganSach.luong_max === "" || nganSach.luong_max === undefined ? null : Number(nganSach.luong_max);

  const template = safeReadJson(TEMPLATE_PATH);
  const requisitionId = nextRequisitionId();
  const ngayMo = todayISODate();

  const requisition = {
    ...template,
    requisition_id: requisitionId,
    trang_thai: "dang_mo",
    buoc_hien_tai: 2, // B1 xong → sang B2 theo đúng skill
    ngay_mo: ngayMo,
    duong_dan_luu_tru: null,
    sheet_pipeline_url: null,
    vi_tri: {
      ten: viTri.ten,
      phong_ban: viTri.phong_ban,
      cap_bac: viTri.cap_bac,
      bao_cao_cho: viTri.bao_cao_cho,
      so_luong: Number(viTri.so_luong),
      hinh_thuc: viTri.hinh_thuc,
      dia_diem: viTri.dia_diem || "",
      ly_do_tuyen: viTri.ly_do_tuyen,
      onboard_mong_muon: viTri.onboard_mong_muon,
      onboard_muon_nhat: viTri.onboard_muon_nhat,
    },
    boi_canh: {
      thay_doi_doanh_nghiep: boiCanh.thay_doi_doanh_nghiep,
      ba_viec_chinh_3_thang: [baViec[0] || "", baViec[1] || "", baViec[2] || ""],
      tieu_chi_thanh_cong_6_thang: boiCanh.tieu_chi_thanh_cong_6_thang,
    },
    ngan_sach: {
      luong_min: Number.isFinite(luongMin) ? luongMin : null,
      luong_max: Number.isFinite(luongMax) ? luongMax : null,
      ghi_chu: luongMin === null && luongMax === null ? "Chờ chốt — chưa có số cụ thể" : "",
      cong_bo_luong_tren_tin_dang: !!nganSach.cong_bo_luong_tren_tin_dang,
    },
    jd: { file: null, phien_ban: 1, nguon: null, tieu_chi: { bat_buoc: [], nen_co: [], uu_tien: [] } },
    kenh_dang: [],
    ung_vien: [],
    nhat_ky: [{ thoi_gian: nowISO(), hanh_dong: "tao_requisition", nguoi_thuc_hien: "hr-1" }],
  };

  ensureDir(REQ_DIR);
  ensureDir(path.join(HOSO_DIR, requisitionId));
  ensureDir(path.join(HOSO_DIR, requisitionId, "cv")); // sẵn thư mục CV ngay từ B1 — B4 chỉ cần copy file vào

  // JD cũ đính kèm ngay ở B1 (gộp phần "có JD cũ không" vào form mở đợt) — B2 chỉ còn việc
  // đối chiếu/điều chỉnh thay vì hỏi lại từ đầu.
  if (jdCuNoiDung) {
    const jdFileName = "JD-dinh-kem-B1.md";
    fs.writeFileSync(path.join(HOSO_DIR, requisitionId, jdFileName), jdCuNoiDung, "utf8");
    requisition.jd.file = `hr/data/ho-so/${requisitionId}/${jdFileName}`;
    requisition.jd.nguon = "dinh_kem_b1";
    requisition.nhat_ky.push({ thoi_gian: nowISO(), hanh_dong: "dinh_kem_jd_cu_noi_dung_tu_b1", nguoi_thuc_hien: "hr-1" });
  } else if (jdCuDuongDan) {
    requisition.jd.file = jdCuDuongDan;
    requisition.jd.nguon = "duong_dan_b1";
    requisition.nhat_ky.push({ thoi_gian: nowISO(), hanh_dong: "dinh_kem_jd_cu_duong_dan_tu_b1", nguoi_thuc_hien: "hr-1" });
  }

  fs.writeFileSync(path.join(REQ_DIR, `${requisitionId}.json`), JSON.stringify(requisition, null, 2), "utf8");

  const canhBao = canhBaoThoiGian(viTri.onboard_mong_muon);
  const buoc = BUOC_MAP[2];
  const coJdCu = !!(jdCuNoiDung || jdCuDuongDan);
  const summary =
    `📋 ${requisitionId} — ${viTri.ten} (${viTri.so_luong} người)\n` +
    `   Onboard dự kiến : ${viTri.onboard_mong_muon}        Đã trôi: 0 ngày kể từ mở đợt\n` +
    `   Bước hiện tại   : B2 — ${buoc.ten}\n` +
    `   Ứng viên        : 0 CV | 0 hẹn PV | 0 đã PV | 0 chờ offer\n` +
    `   Việc cần bạn    : ${coJdCu ? "Duyệt lại JD cũ đã đính kèm (chỉ cần xác nhận hoặc điều chỉnh)" : "Cập nhật JD và đăng tin tuyển dụng"}\n` +
    `   Bước kế tiếp    : /${buoc.skill}`;

  return { requisition, canhBao, summary };
}

// ---------- SKILL.md thật (dùng cho modal "Xem skill" + subagent) ----------
function isSafeName(name) {
  return /^[a-z0-9-]+$/.test(name);
}

function getSkillMarkdown(name) {
  if (!isSafeName(name)) throw err(400, `Tên skill không hợp lệ: "${name}"`);
  const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
  if (fs.existsSync(skillPath)) return { path: `hr/skills/${name}/SKILL.md`, md: fs.readFileSync(skillPath, "utf8") };
  const agentPath = path.join(AGENTS_DIR, `${name}.md`);
  if (fs.existsSync(agentPath)) return { path: `hr/agents/${name}.md`, md: fs.readFileSync(agentPath, "utf8") };
  throw err(404, `Không tìm thấy skill/subagent "${name}" trong hr/skills hoặc hr/agents`);
}

// ---------- Lịch sử chat (persist thật ra đĩa — sống sót qua restart server/reload trang) ----------
// Trước đây hội thoại chỉ nằm trong bộ nhớ trình duyệt (JS variable) — restart server hoặc
// F5 là mất sạch, HR Agent phải hỏi lại từ đầu dù requisition đã tiến được nhiều bước trong
// chat. Giờ lưu thật vào hr/data/ho-so/<reqId>/chat-log.json (đã nằm trong .gitignore vì có
// thể chứa nội dung nhạy cảm) và nạp lại làm history mỗi lần chat thay vì phụ thuộc client.
const CHATLOG_FILENAME = "chat-log.json";

function chatLogPath(reqId) {
  return path.join(HOSO_DIR, reqId, CHATLOG_FILENAME);
}

function loadChatLog(reqId) {
  const p = chatLogPath(reqId);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const arr = raw && raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return []; // log hỏng — không chặn chat, chỉ mất lịch sử cũ
  }
}

function saveChatLog(reqId, log) {
  ensureDir(path.join(HOSO_DIR, reqId));
  fs.writeFileSync(chatLogPath(reqId), JSON.stringify(log, null, 2), "utf8");
}

function getChatLog(reqId) {
  getRequisition(reqId); // throws 404 nếu requisition không tồn tại
  return loadChatLog(reqId);
}

// ============================================================
// B2–B10 — thực thi THẬT bằng Claude Sonnet tại local (không qua Hermes)
// Sonnet nạp nguyên văn SKILL.md làm system prompt + có 3 tool để tự đọc/ghi
// đúng file requisition & hồ sơ thật trên đĩa. Các cổng người (🔴 lương/gửi email)
// nằm trong chính SKILL.md — Sonnet được yêu cầu tuân thủ; server chỉ khóa cứng
// phần rủi ro cao nhất: không cho nhảy qua B7 và không cho ghi số lương trước B7.
// ============================================================

const SALARY_FIELDS = ["luong_thu_viec", "luong_chinh_thuc", "phu_cap", "thuong"];

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_requisition_fields",
      description:
        "Cập nhật các trường an toàn của requisition: jd, vi_tri, boi_canh, kenh_dang, buoc_hien_tai, trang_thai. " +
        "KHÔNG dùng tool này để sửa ứng viên — dùng upsert_candidate. Luôn kèm hanh_dong_nhat_ky.",
      parameters: {
        type: "object",
        properties: {
          jd: { type: "object", description: "Object jd đầy đủ theo schema requisition (file, phien_ban, tieu_chi.bat_buoc/nen_co/uu_tien)" },
          vi_tri: { type: "object", description: "Field cần merge (nông) vào vi_tri hiện có — vd bổ sung/sửa dia_diem sau khi hỏi user, KHÔNG đổi ten đã chốt ở B1 trừ khi user yêu cầu rõ." },
          boi_canh: { type: "object", description: "Field cần merge (nông) vào boi_canh hiện có — vd bổ sung ba_viec_chinh_3_thang[2] còn thiếu." },
          kenh_dang: { type: "array", items: { type: "object" }, description: "Mảng đầy đủ kenh_dang theo schema requisition" },
          buoc_hien_tai: { type: "integer", description: "Bước kế tiếp. Không được nhảy qua B7 trong 1 lần gọi — phải dừng đúng ở B7 trước." },
          trang_thai: { type: "string", enum: ["dang_mo", "da_dong"] },
          hanh_dong_nhat_ky: { type: "string", description: "Mô tả ngắn hành động, ghi vào nhat_ky[]" },
        },
        required: ["hanh_dong_nhat_ky"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_candidate",
      description:
        "Thêm mới hoặc cập nhật 1 ứng viên trong ung_vien[] theo ma_uv (merge nông vào phần tử hiện có). " +
        "Dùng cho B4 (điểm CV), B5-B6 (lịch PV, kết quả), B7-B9 (offer). " +
        "B4 — khi chấm điểm CV, LUÔN điền đủ diem, xep_loai, diem_chi_tiet {bat_buoc(/50), nen_co(/25), " +
        "kinh_nghiem(/15), on_dinh(/10)} theo đúng 4 hạng mục rubric B1 của SKILL.md (không chỉ điền tổng " +
        "diem rồi bỏ trống breakdown), cùng diem_manh[] và diem_can_hoi[] — các field này đều được đồng bộ " +
        "thành cột riêng trong Excel Pipeline, thiếu field nào thì cột đó trống. " +
        "🔴 CHỈ điền offer.luong_thu_viec/luong_chinh_thuc/phu_cap/thuong SAU KHI người dùng đã gõ xác nhận " +
        "đủ 12/12 dòng điều khoản trong hội thoại — nếu chưa, để các field đó null.",
      parameters: {
        type: "object",
        properties: {
          ma_uv: { type: "string" },
          candidate: { type: "object", description: "Field cần merge vào ứng viên, theo đúng schema ung_vien[] trong requisition.template.json" },
          hanh_dong_nhat_ky: { type: "string" },
        },
        required: ["ma_uv", "candidate", "hanh_dong_nhat_ky"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_hr_file",
      description: "Lưu 1 file text thật (JD, bài đăng, biên bản phỏng vấn…) vào hr/data/ho-so/<requisition_id>/<relative_path>.",
      parameters: {
        type: "object",
        properties: {
          relative_path: { type: "string", description: "vd: JD-KeToan.md hoặc bai-dang/facebook.md" },
          content: { type: "string" },
        },
        required: ["relative_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_interview_form",
      description:
        "Mở FORM thật trên giao diện để user điền kết quả đánh giá phỏng vấn (điểm chuyên môn, điểm văn hóa, " +
        "điểm mạnh, điểm lo ngại, lương mong muốn, kết luận...) — dùng thay vì hỏi từng câu trong chat (không " +
        "chuyên nghiệp, dễ ghi sai số). Gọi tool này khi đến lúc ghi nhận kết quả 1 buổi phỏng vấn (B5-B6). " +
        "Form tự ghi thẳng vào ung_vien[] và đồng bộ Excel khi user bấm Lưu — không cần bạn gọi upsert_candidate " +
        "cho các field đó nữa. Form CHỈ cho chọn ứng viên đã có sẵn (đã chấm CV ở B4) từ dropdown, KHÔNG tạo " +
        "được ứng viên mới — nếu user muốn đánh giá 1 người chưa có trong hệ thống, bảo họ chấm CV/thêm ứng " +
        "viên đó trước (qua upsert_candidate) rồi mới gọi tool này.",
      parameters: {
        type: "object",
        properties: {
          ma_uv: { type: "string", description: "Mã ứng viên đã có sẵn trong ung_vien[] — nếu biết, form sẽ tự chọn sẵn đúng dòng đó." },
          ten: { type: "string", description: "Tên ứng viên đã có sẵn — dùng để tự chọn sẵn nếu không có ma_uv." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_offer_letter",
      description:
        "Điền THẬT vào mẫu offer letter có sẵn của công ty (hr/data/mau-cong-ty/offer-letter.docx) bằng đúng " +
        "dữ liệu offer.* đã chốt ở Cổng 1 (B7) của ứng viên — không tự soạn, không tự đoán số liệu. Chỉ gọi " +
        "SAU KHI đã đủ 12/12 dòng điều khoản được user xác nhận và lưu qua upsert_candidate. Server tự chặn " +
        "nếu requisition chưa qua B7 hoặc offer còn thiếu field bắt buộc.",
      parameters: {
        type: "object",
        properties: {
          ma_uv: { type: "string" },
          chuc_danh_nguoi_ky: { type: "string", description: "Chức danh người ký offer (vd 'Giám đốc Nhân sự') — hỏi user nếu chưa biết, không tự đoán." },
          hanh_dong_nhat_ky: { type: "string" },
        },
        required: ["ma_uv", "hanh_dong_nhat_ky"],
      },
    },
  },
];

// Đọc an toàn nội dung JD cũ (đính kèm ở B1 hoặc đường dẫn user tự nhập) để nhét vào context
// cho Sonnet ở B2 — chỉ đọc file text nằm trong project/aios, bỏ qua nếu không đọc được
// (link ngoài, đường dẫn sai…) thay vì crash.
function tryReadJdFile(jdFile) {
  if (!jdFile || typeof jdFile !== "string") return null;
  if (/^https?:\/\//i.test(jdFile)) return null;
  try {
    const resolved = path.normalize(path.isAbsolute(jdFile) ? jdFile : path.join(AIOS_ROOT, jdFile));
    if (!resolved.startsWith(path.normalize(AIOS_ROOT))) return null;
    if (!fs.existsSync(resolved)) return null;
    const stat = fs.statSync(resolved);
    if (!stat.isFile() || stat.size > 300000) return null;
    return fs.readFileSync(resolved, "utf8");
  } catch (e) {
    return null;
  }
}

function writeRequisitionFile(reqId, data) {
  fs.writeFileSync(path.join(REQ_DIR, `${reqId}.json`), JSON.stringify(data, null, 2), "utf8");
}

function execUpdateRequisitionFields(reqId, input) {
  const data = getRequisition(reqId);
  if (input.buoc_hien_tai !== undefined) {
    const current = data.buoc_hien_tai;
    const next = Number(input.buoc_hien_tai);
    if (next > current + 3) throw err(400, `Nhảy bước quá xa (B${current} → B${next}) — có thể bỏ sót bước, từ chối.`);
    if (current < 7 && next >= 8) throw err(400, "Không được nhảy qua B7 (cổng lương bắt buộc) — phải dừng đúng ở B7 để người dùng xác nhận điều khoản trước.");
    data.buoc_hien_tai = next;
  }
  if (input.jd) data.jd = { ...data.jd, ...input.jd };
  if (input.vi_tri) data.vi_tri = { ...data.vi_tri, ...input.vi_tri };
  if (input.boi_canh) data.boi_canh = { ...data.boi_canh, ...input.boi_canh };
  if (input.kenh_dang) data.kenh_dang = input.kenh_dang;
  if (input.trang_thai) data.trang_thai = input.trang_thai;
  data.nhat_ky.push({ thoi_gian: nowISO(), hanh_dong: input.hanh_dong_nhat_ky || "cap_nhat", nguoi_thuc_hien: "hr-1 (Sonnet)" });
  writeRequisitionFile(reqId, data);
  return { ok: true, buoc_hien_tai: data.buoc_hien_tai };
}

function execUpsertCandidate(reqId, input) {
  const data = getRequisition(reqId);
  if (input.candidate?.offer) {
    const hasSalary = SALARY_FIELDS.some((f) => input.candidate.offer[f] !== undefined && input.candidate.offer[f] !== null);
    if (hasSalary && data.buoc_hien_tai < 7) {
      throw err(400, "Chưa qua B7 (cổng lương) — không được ghi số lương. Phải xác nhận đủ 12 dòng điều khoản với người dùng trong chat trước, rồi cập nhật buoc_hien_tai=7.");
    }
  }
  let uv = (data.ung_vien || []).find((u) => u.ma_uv === input.ma_uv);
  if (!uv) {
    uv = { ma_uv: input.ma_uv };
    data.ung_vien = data.ung_vien || [];
    data.ung_vien.push(uv);
  }
  Object.assign(uv, input.candidate, { ma_uv: input.ma_uv });
  data.nhat_ky.push({ thoi_gian: nowISO(), hanh_dong: input.hanh_dong_nhat_ky || `cap_nhat_${input.ma_uv}`, nguoi_thuc_hien: "hr-1 (Sonnet)" });
  writeRequisitionFile(reqId, data);
  return { ok: true, ma_uv: input.ma_uv };
}

// ---------- Đồng bộ THẬT vào file Excel local hr/templates/Tuyen-dung-2026-Pipeline.xlsx (sheet
// "Pipeline", 1 file dùng chung cho mọi REQ). Mỗi lần chấm/cập nhật 1 ứng viên → upsert đúng 1
// dòng theo khóa ghép Ma_UV + REQ_ID (Ma_UV chỉ duy nhất trong phạm vi 1 requisition).
// Lỗi đồng bộ KHÔNG được làm hỏng luồng chat chính — chỉ báo lại cho user biết qua toolLog.
function buildPipelineRow(reqId, requisition, uv) {
  const lichPv = uv.lich_pv || {};
  const ketQuaPv = uv.ket_qua_pv || {};
  const offer = uv.offer || {};
  const diemChiTiet = uv.diem_chi_tiet || {};
  const [ngayPv, gioPv] = String(lichPv.thoi_gian || "").split("T");
  return [
    uv.ma_uv || "",
    reqId,
    uv.ten || "",
    uv.email || "",
    uv.sdt || "",
    requisition?.vi_tri?.ten || "",
    uv.nguon || "",
    uv.ngay_nop || "",
    uv.diem ?? "",
    uv.xep_loai || "",
    uv.trang_thai || "",
    ngayPv || "",
    gioPv ? gioPv.slice(0, 5) : "",
    (lichPv.nguoi_pv || []).join(", "),
    ketQuaPv.diem_chuyen_mon ?? "",
    ketQuaPv.diem_van_hoa ?? "",
    ketQuaPv.ket_luan || "",
    ketQuaPv.luong_mong_muon ?? "",
    ketQuaPv.co_the_onboard_tu || "",
    "", // Ngay_gui_offer — chưa có field tương ứng trong schema requisition, để trống cho người điền
    "", // Ket_qua_offer — tương tự
    uv.trang_thai === "nhan_viec" ? offer.ngay_onboard || "" : "",
    "", // Ghi_chu — để trống, không tự suy diễn
    nowISO(),
    uv.file_cv || "",
    diemChiTiet.bat_buoc ?? "",
    diemChiTiet.nen_co ?? "",
    diemChiTiet.kinh_nghiem ?? "",
    diemChiTiet.on_dinh ?? "",
    (uv.diem_manh || []).join("; "),
    (uv.diem_can_hoi || []).join("; "),
  ];
}

async function syncCandidateToSheet(reqId, uv) {
  try {
    const requisition = getRequisition(reqId);
    const row = buildPipelineRow(reqId, requisition, uv);
    const result = await excelSync.upsertRow(row);
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---------- B5/B6 — Form đánh giá phỏng vấn (deterministic, giống B1 — không cần LLM phán đoán,
// người phỏng vấn tự gõ số vào form thay vì đọc miệng qua chat rồi agent chép lại dễ sai). ----------
// Bắt buộc ứng viên đã tồn tại trong ung_vien[] (đã chấm CV ở B4) — form chỉ cho CHỌN từ dropdung
// thật, không cho gõ tay, nên KHÔNG tự tạo ứng viên mới ở đây (tránh sai mã/trùng tên/tạo lạc loài).
function recordInterviewEvaluation(reqId, input) {
  const data = getRequisition(reqId);
  const maUv = (input.ma_uv || "").trim();
  required(maUv, "Mã ứng viên");
  const uv = (data.ung_vien || []).find((u) => u.ma_uv === maUv);
  if (!uv) {
    throw err(400, `Không tìm thấy ứng viên "${maUv}" trong requisition này — chỉ đánh giá được ứng viên đã có sẵn (đã chấm CV ở B4).`);
  }

  if (input.thoi_gian || input.hinh_thuc || (input.nguoi_pv && input.nguoi_pv.length)) {
    uv.lich_pv = {
      ...uv.lich_pv,
      thoi_gian: input.thoi_gian || uv.lich_pv?.thoi_gian || null,
      hinh_thuc: input.hinh_thuc || uv.lich_pv?.hinh_thuc || null,
      nguoi_pv: (input.nguoi_pv && input.nguoi_pv.length ? input.nguoi_pv : uv.lich_pv?.nguoi_pv) || [],
      event_id: uv.lich_pv?.event_id || null,
    };
  }

  required(input.diem_chuyen_mon, "Điểm chuyên môn");
  required(input.diem_van_hoa, "Điểm phù hợp văn hóa");
  required(input.ket_luan, "Kết luận");
  uv.ket_qua_pv = {
    diem_chuyen_mon: Number(input.diem_chuyen_mon),
    diem_van_hoa: Number(input.diem_van_hoa),
    diem_manh: input.diem_manh || "",
    diem_lo_ngai: input.diem_lo_ngai || "",
    // 🔴 chỉ ghi đúng số ứng viên nói — form cho người phỏng vấn tự gõ, không suy diễn thay
    luong_mong_muon: input.luong_mong_muon === "" || input.luong_mong_muon === undefined ? null : Number(input.luong_mong_muon),
    co_the_onboard_tu: input.co_the_onboard_tu || null,
    ket_luan: input.ket_luan,
  };
  // "Đồng ý" = sẵn sàng chốt offer → tự chuyển trang_thai + mở khóa B7 (Cổng 1), đúng "Kết thúc"
  // trong lich-phong-van/SKILL.md. Không tự chốt điều khoản/lương thay — chỉ mở cổng, B7 vẫn cần
  // user xác nhận đủ 12 dòng như bình thường (execUpdateRequisitionFields/execUpsertCandidate vẫn
  // chặn ghi lương trước B7).
  let advancedToB7 = false;
  if (input.ket_luan === "Tu_choi") {
    uv.trang_thai = "loai";
  } else if (input.ket_luan === "Dong_y") {
    uv.trang_thai = "cho_offer";
    if (data.buoc_hien_tai < 7) {
      data.buoc_hien_tai = 7;
      advancedToB7 = true;
    }
  } else {
    uv.trang_thai = "da_phong_van";
  }

  data.nhat_ky.push({
    thoi_gian: nowISO(),
    hanh_dong: `danh_gia_phong_van_${maUv}_qua_form` + (advancedToB7 ? "_chuyen_B7" : ""),
    nguoi_thuc_hien: "user (form đánh giá phỏng vấn)",
  });
  writeRequisitionFile(reqId, data);
  return { ma_uv: maUv, requisition: data, uv, advancedToB7 };
}

function execSaveHrFile(reqId, input) {
  const baseDir = path.join(HOSO_DIR, reqId);
  ensureDir(baseDir);
  const target = path.normalize(path.join(baseDir, input.relative_path || ""));
  if (!target.startsWith(baseDir)) throw err(400, "Đường dẫn không hợp lệ (path traversal)");
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, input.content ?? "", "utf8");
  return { ok: true, path: path.relative(HR_ROOT, target).replace(/\\/g, "/") };
}

// Không ghi gì cả — chỉ xác nhận reqId hợp lệ. Hiệu ứng thật xảy ra ở frontend (mở modal form)
// khi thấy tool này trong toolLog, xem app.js.
function execOpenInterviewForm(reqId, input) {
  getRequisition(reqId);
  return { ok: true, ma_uv: input.ma_uv || null, ten: input.ten || null };
}

const OFFER_REQUIRED_FIELDS = [
  "chuc_danh", "bao_cao_cho", "ngay_onboard", "thu_viec_thang",
  "luong_thu_viec", "luong_chinh_thuc", "hinh_thuc_lam_viec",
  "loai_hop_dong", "han_phan_hoi", "nguoi_ky",
];

function execGenerateOfferLetter(reqId, input) {
  const data = getRequisition(reqId);
  if (data.buoc_hien_tai < 7) {
    throw err(400, "Chưa qua B7 (cổng điều khoản) — chưa có offer đã chốt để tạo thư.");
  }
  const uv = (data.ung_vien || []).find((u) => u.ma_uv === input.ma_uv);
  if (!uv) throw err(404, `Không tìm thấy ứng viên "${input.ma_uv}" trong requisition này.`);
  const offer = uv.offer || {};
  const missing = OFFER_REQUIRED_FIELDS.filter((f) => offer[f] === undefined || offer[f] === null || offer[f] === "");
  if (missing.length) {
    throw err(400, `Offer của ${input.ma_uv} còn thiếu field bắt buộc: ${missing.join(", ")} — phải chốt đủ 12 dòng ở Cổng 1 (B7) trước.`);
  }
  const result = docxSync.generateOfferLetter(reqId, data, uv, { chuc_danh_nguoi_ky: input.chuc_danh_nguoi_ky });
  uv.offer.phien_ban_file = `v${result.version}`;
  data.nhat_ky.push({ thoi_gian: nowISO(), hanh_dong: input.hanh_dong_nhat_ky || `tao_offer_letter_${input.ma_uv}_v${result.version}`, nguoi_thuc_hien: "hr-1 (Sonnet)" });
  writeRequisitionFile(reqId, data);
  return { ok: true, path: result.path, version: result.version, missingTemplateFields: result.missingFields };
}

// toolCall: { id, type:"function", function:{ name, arguments: "<json string>" } } — chuẩn OpenAI/OpenRouter
async function runTool(reqId, toolCall) {
  const name = toolCall.function?.name;
  let input;
  try {
    input = JSON.parse(toolCall.function?.arguments || "{}");
  } catch (e) {
    return { error: `Tham số tool "${name}" không phải JSON hợp lệ: ${e.message}` };
  }
  try {
    if (name === "update_requisition_fields") return { input, result: execUpdateRequisitionFields(reqId, input) };
    if (name === "upsert_candidate") {
      const result = execUpsertCandidate(reqId, input);
      const savedUv = getRequisition(reqId).ung_vien.find((u) => u.ma_uv === input.ma_uv);
      const sheetSync = await syncCandidateToSheet(reqId, savedUv || { ma_uv: input.ma_uv, ...input.candidate });
      return { input, result: { ...result, sheetSync } };
    }
    if (name === "save_hr_file") return { input, result: execSaveHrFile(reqId, input) };
    if (name === "open_interview_form") return { input, result: execOpenInterviewForm(reqId, input) };
    if (name === "generate_offer_letter") return { input, result: execGenerateOfferLetter(reqId, input) };
    return { input, error: `Tool không xác định: ${name}` };
  } catch (e) {
    return { input, error: e.message };
  }
}

// B2 (buoc_hien_tai === 2) đã gộp bước "hỏi có JD cũ không" vào form B1 (Nhóm 5 — JD hiện có).
// Nếu requisition đã có jd.file (đính kèm hoặc đường dẫn), nạp thẳng nội dung vào context và
// chỉ đạo Sonnet chuyển sang chế độ "đối chiếu/điều chỉnh" thay vì hỏi lại từ đầu.
function jdCuDinhKemBlock(initial) {
  if (initial.buoc_hien_tai !== 2 || !initial.jd || !initial.jd.file) return "";
  const noiDung = tryReadJdFile(initial.jd.file);
  return (
    `\n\n=== JD cũ đã đính kèm sẵn từ B1 (đường dẫn: ${initial.jd.file}) ===\n` +
    (noiDung
      ? noiDung
      : "(Không tự đọc được nội dung file tại đường dẫn trên trong hệ thống — có thể là link ngoài hoặc đường dẫn chưa đúng. Hỏi user paste nội dung nếu cần dùng đến.)") +
    `\n\n=== YÊU CẦU RIÊNG CHO B2 LẦN NÀY ===\n` +
    `JD cũ ĐÃ có sẵn ở trên — KHÔNG hỏi lại "anh/chị có JD cũ không". Nhiệm vụ của bạn chỉ là đối chiếu JD cũ ` +
    `với bối cảnh kinh doanh, ngân sách và các trường vị trí hiện tại của requisition (áp dụng logic mục A1-A2 ` +
    `của SKILL.md), rồi quyết định GIỮ NGUYÊN hay cần ĐIỀU CHỈNH. Nếu vẫn phù hợp và không cần điều chỉnh gì, ` +
    `hãy nói rõ điều đó, tự cập nhật jd.tieu_chi (dựa theo JD cũ) qua tool update_requisition_fields trong ` +
    `cùng lượt này, rồi tiếp tục luôn — không cần dừng lại chờ hỏi thêm. Nếu cần điều chỉnh, chỉ hỏi đúng những ` +
    `điểm cần đổi, đừng hỏi lại toàn bộ từ đầu.`
  );
}

// ---------- B4 — nộp CV bằng cách copy file PDF vào thư mục thật (không có Gmail MCP thật) ----------
// User tự copy CV vào hr/data/ho-so/<reqId>/cv/ rồi nhắn TÊN FILE vào chat. Server phát hiện tên
// file được nhắc tới, tự đính kèm đúng file PDF đó (base64) vào tin nhắn.
//
// Model riêng cho lượt đọc CV: Claude Haiku 4.5 (có vision, đọc PDF gốc trực tiếp — kể cả CV dạng
// scan/đồ họa không có lớp text) thay vì DEFAULT_MODEL (DeepSeek V4 Flash, text-only). Trước đây dùng
// plugin file-parser (OCR engine cloudflare-ai) của OpenRouter để trích text hộ DeepSeek, nhưng OCR
// đó có thể chỉ đọc được metadata PDF (không đọc được nội dung trang) với CV dạng ảnh/đồ họa — xem
// nhật ký sự cố "chỉ đọc được metadata". Chuyển sang model vision bỏ hẳn bước OCR trung gian này:
// KHÔNG truyền `plugins` cho lượt gọi CV_READ_MODEL — để OpenRouter chuyển file PDF thẳng cho Claude
// đọc bằng khả năng đọc tài liệu gốc, không qua bộ OCR nào cả. Các bước khác (B1-B3, B5-B10) không
// đọc file nên vẫn dùng DEFAULT_MODEL (DeepSeek V4 Flash) như cũ — chỉ lượt có đính kèm CV mới đổi model.
const CV_READ_MODEL = process.env.OPENROUTER_CV_MODEL || "anthropic/claude-haiku-4.5";
const CV_MAX_BYTES = 8 * 1024 * 1024; // 8MB/file — đủ cho CV thường

function cvDirPath(reqId) {
  return path.join(HOSO_DIR, reqId, "cv");
}

function listCvFiles(reqId) {
  const dir = cvDirPath(reqId);
  ensureDir(dir);
  return fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort();
}

// B4 (buoc_hien_tai === 4): cho Sonnet biết đường dẫn thư mục CV thật + danh sách file hiện có,
// để nó tự hướng dẫn user đúng quy trình thay vì chỉ dựa vào Gmail (chưa nối thật trong hệ thống này).
function cvFolderBlock(reqId, initial) {
  if (initial.buoc_hien_tai !== 4) return "";
  const files = listCvFiles(reqId);
  return (
    `\n\n=== Thư mục CV thật của requisition này (B4) ===\n` +
    `Đường dẫn: hr/data/ho-so/${reqId}/cv/\n` +
    (files.length
      ? `File PDF hiện có: ${files.join(", ")}\n\n` +
        `User đã copy file vào thư mục trên. Khi user nhắc TÊN FILE trong chat (hoặc nói "chấm tất cả"/"chấm hết"), ` +
        `hệ thống tự đính kèm đúng file PDF đó vào tin nhắn cho bạn đọc trực tiếp — bạn KHÔNG cần tool đọc file, ` +
        `chỉ cần chấm điểm theo đúng rubric 3 tầng ở Phần B của SKILL.md rồi gọi upsert_candidate lưu NGAY trong ` +
        `cùng lượt trả lời (xem block "QUAN TRỌNG — chấm điểm CV (B4)" ở trên) — không hiển thị bảng điểm cho ` +
        `user xong mới lưu ở lượt sau.`
      : `Thư mục đang trống. Hướng dẫn user: copy file CV (định dạng .pdf, đặt tên rõ ràng vd TenUngVien.pdf) ` +
        `vào đúng đường dẫn trên, rồi nhắn tên file đó vào chat — hệ thống sẽ tự đính kèm cho bạn đọc và chấm điểm. ` +
        `Đây là cách nộp CV thay Gmail vì hệ thống này chưa nối Gmail MCP thật.`)
  );
}

// Quét tin nhắn user tìm tên file .pdf đang thật sự có trong thư mục cv/ — chỉ khớp file có
// thật (đọc từ readdirSync), không dùng đường dẫn user tự gõ, nên an toàn trước path traversal.
// Nói "tất cả"/"toàn bộ"/"hết" (kèm "cv"/"file") → đính kèm mọi file trong thư mục.
function findCvAttachments(reqId, message) {
  const files = listCvFiles(reqId);
  if (!files.length) return { attachments: [], skipped: [] };
  const wantAll = /(tất cả|toàn bộ|hết)/i.test(message) && /(cv|file|hồ sơ)/i.test(message);
  const matched = wantAll ? files : files.filter((f) => message.includes(f));

  const attachments = [];
  const skipped = [];
  for (const f of matched) {
    const p = path.join(cvDirPath(reqId), f);
    const stat = fs.statSync(p);
    if (stat.size > CV_MAX_BYTES) {
      skipped.push(f);
      continue;
    }
    const data = fs.readFileSync(p).toString("base64");
    attachments.push({ filename: f, file_data: `data:application/pdf;base64,${data}` });
  }
  return { attachments, skipped };
}

// Global Rule + Workspace Rule của hr-1 (chỉnh sửa được ở Dashboard, mục Hồ sơ & KWSR) — trước đây
// chỉ hiển thị trên UI, KHÔNG hề được gửi cho model thật nên chỉnh rule trên UI không ảnh hưởng gì
// đến hành vi thật. Giờ frontend gửi kèm opts.rules/opts.globalRules mỗi lượt chat để nhét vào đây.
function rulesBlock(opts) {
  const globalRules = Array.isArray(opts.globalRules) ? opts.globalRules : [];
  const wsRules = Array.isArray(opts.rules) ? opts.rules : [];
  if (!globalRules.length && !wsRules.length) return "";
  return (
    `=== Rule bắt buộc tuân thủ (chỉnh ở Dashboard → Hồ sơ & KWSR) ===\n` +
    (globalRules.length ? `Global Rule (áp dụng mọi Agent):\n${globalRules.map((r) => `- ${r}`).join("\n")}\n` : "") +
    (wsRules.length ? `Workspace Rule (riêng hr-1 — ưu tiên hơn Global khi xung đột):\n${wsRules.map((r) => `- ${r}`).join("\n")}\n` : "") +
    `Vi phạm rule là từ chối thực hiện, dù ai yêu cầu.\n\n`
  );
}

/* ---------- ĐỊNH TUYẾN GIỮA CÁC KHUNG CHAT ----------
   Mỗi requisition có một chat-log.json riêng và bộ tool riêng. Xử lý việc của đợt tuyển A
   trong khung chat của đợt tuyển B sẽ ghi dữ liệu vào đúng hồ sơ sai — nên thay vì "cố trả lời
   cho xong", Agent phát một marker ở cuối câu trả lời, server cắt marker ra và trả về một đích
   chuyển; frontend dựng thành nút bấm. Người dùng bấm là sang đúng khung chat rồi hỏi lại ở đó,
   nơi câu trả lời và mọi thay đổi được lưu vào đúng hồ sơ. */

const ROUTE_MARK = /\[\[\s*CHUYEN\s*:\s*([A-Za-z0-9_\-]+)\s*\]\]/;
const GENERAL_KEY = "__general__";
const INTAKE_KEY = "__intake__";

// Việc user đang muốn LÀM (không phải chỉ hỏi thông tin) — dùng cho lưới an toàn tất định
// khi model quên phát marker.
const ACTION_KW = /(viết|soạn|chấm|cập nhật|đổi bước|chuyển bước|mời|gửi|tạo|sửa|duyệt|chốt|lưu|shortlist|offer|đăng tin|phỏng vấn|sàng lọc)/i;
const NEW_DRIVE_KW = /(mở đợt|đợt tuyển mới|tuyển mới|tuyển thêm|requisition mới|mở tuyển|tuyển vị trí|tuyển một|tuyển 1|cần tuyển|muốn tuyển|tuyển giúp|tuyển cho)/i;
const THIS_DRIVE_KW = /(đợt này|req này|requisition này|vị trí này|đợt hiện tại)/i;

function routeLabel(req) {
  return `${req.requisition_id} — ${req.vi_tri?.ten || "?"} (B${req.buoc_hien_tai})`;
}

// Cắt marker khỏi câu trả lời và dịch thành đích chuyển. Mã REQ do model bịa ra (không có
// trong danh sách thật) bị bỏ qua — thà không có nút còn hơn nút dẫn tới hồ sơ không tồn tại.
function extractRouting(reply, fromKey) {
  const m = String(reply).match(ROUTE_MARK);
  if (!m) return { reply, routing: null };
  const cleaned = String(reply).replace(ROUTE_MARK, "").trim();
  const raw = m[1].toUpperCase();
  if (raw === "HOI_CHUNG") {
    return { reply: cleaned, routing: fromKey === GENERAL_KEY ? null : { to: GENERAL_KEY, label: "Hỏi chung" } };
  }
  if (raw === "MO_DOT_MOI") {
    return { reply: cleaned, routing: { to: INTAKE_KEY, label: "form Nhu cầu tuyển dụng (B1)" } };
  }
  const req = listRequisitions().find((r) => String(r.requisition_id).toUpperCase() === raw);
  if (!req || req.requisition_id === fromKey) return { reply: cleaned, routing: null };
  return { reply: cleaned, routing: { to: req.requisition_id, label: routeLabel(req) } };
}

// Lưới an toàn: model quên marker thì suy ra từ chính câu của user.
function fallbackRouting(message, fromKey) {
  const text = String(message || "");
  if (fromKey === GENERAL_KEY) {
    if (!ACTION_KW.test(text)) return null;
    const hit = listRequisitions().find((r) => text.toUpperCase().includes(String(r.requisition_id).toUpperCase()));
    return hit ? { to: hit.requisition_id, label: routeLabel(hit) } : null;
  }
  // Đang trong một requisition mà user đòi mở đợt tuyển khác
  if (NEW_DRIVE_KW.test(text) && !THIS_DRIVE_KW.test(text) && !text.toUpperCase().includes(String(fromKey).toUpperCase())) {
    return { to: INTAKE_KEY, label: "form Nhu cầu tuyển dụng (B1)" };
  }
  return null;
}

const ROUTING_RULE_REQ = (reqId) =>
  `ĐỊNH TUYẾN — bắt buộc: phiên chat này gắn cứng với ${reqId}, mọi thứ bạn làm ở đây được ghi vào hồ sơ ` +
  `của ${reqId}. Vì vậy việc thuộc requisition KHÁC, hoặc yêu cầu MỞ ĐỢT TUYỂN MỚI, bạn KHÔNG được xử lý ` +
  `ở đây: không hỏi thông tin đợt mới, không đề nghị tạm dừng ${reqId} để làm đợt khác, không tạo ` +
  `requisition. Trả lời NGẮN (2–4 câu): nói rõ bạn đang gắn với ${reqId} ở bước nào, và việc kia phải làm ` +
  `ở khu vực chat khác. Sau đó kết thúc câu trả lời bằng đúng MỘT dòng marker cuối cùng:\n` +
  `  [[CHUYEN: MO_DOT_MOI]]      → user muốn tuyển vị trí mới / mở đợt tuyển mới\n` +
  `  [[CHUYEN: REQ-YYYY-NNN]]    → việc thuộc một requisition KHÁC đang có trong danh sách dưới đây\n` +
  `  [[CHUYEN: HOI_CHUNG]]       → câu hỏi chung về tuyển dụng, không gắn requisition nào\n` +
  `Chỉ phát marker khi thật sự lệch phạm vi; việc của chính ${reqId} thì cứ làm bình thường, không marker. ` +
  `Hệ thống cắt marker này ra và dựng thành nút chuyển khu vực chat cho user — đừng nhắc tới nó trong lời văn.\n\n`;

const ROUTING_RULE_GENERAL =
  `ĐỊNH TUYẾN — bắt buộc: ở đây bạn KHÔNG có tool, không sửa được hồ sơ nào. Nếu user muốn THAO TÁC THẬT ` +
  `trên một requisition đang có (viết JD, đăng tin, chấm CV, đổi bước, cập nhật ứng viên, tạo offer...), ` +
  `trả lời ngắn gọn rồi kết thúc bằng đúng một dòng marker cuối cùng:\n` +
  `  [[CHUYEN: REQ-YYYY-NNN]]    → đúng mã requisition trong danh sách thật bên dưới\n` +
  `  [[CHUYEN: MO_DOT_MOI]]      → user muốn mở đợt tuyển hoàn toàn mới (chưa có requisition)\n` +
  `Lý do: câu trả lời và mọi thay đổi chỉ được lưu vào hồ sơ thật khi hỏi trong đúng khung chat của ` +
  `requisition đó. Hệ thống cắt marker ra và dựng thành nút chuyển cho user — đừng nhắc tới nó trong lời văn.\n\n`;

// opts.silent = true cho các lượt hệ thống tự kích hoạt (kickoff mở bước) — không lưu message
// này như một câu hỏi thật của user vào chat-log.json, chỉ lưu câu trả lời của Sonnet.
async function chatOnRequisition(reqId, message, opts = {}) {
  if (!message || typeof message !== "string") throw err(400, "Thiếu 'message'");
  const initial = getRequisition(reqId); // throws 404 nếu không tồn tại
  const buoc = BUOC_MAP[initial.buoc_hien_tai] || BUOC_MAP[10];
  const dispatcherMd = fs.readFileSync(path.join(SKILLS_DIR, "tuyen-dung", "SKILL.md"), "utf8");
  const stepMd = fs.readFileSync(path.join(SKILLS_DIR, buoc.skill, "SKILL.md"), "utf8");
  const persistedLog = loadChatLog(reqId);

  const system =
    `Bạn là hr-1 (HR Agent) trong AI OS, thực thi THẬT pipeline tuyển dụng cho requisition ${reqId} — ` +
    `mọi thay đổi qua tool đều ghi file thật trên đĩa.\n\n` +
    `PHẠM VI — bắt buộc tuân thủ: bạn CHỈ trả lời trong phạm vi tuyển dụng & hồ sơ nhân sự (đúng ` +
    `6 skill/workflow ở trên). Nếu user hỏi việc thuộc phòng ban khác (marketing, kế toán, pháp lý, ` +
    `kỹ thuật, CSKH...), từ chối RÕ RÀNG và định hướng sang đúng Agent phụ trách — KHÔNG tự ý trả lời ` +
    `một phần hay "hỗ trợ thêm" ngoài phạm vi dù chỉ 1 câu, kể cả khi bạn biết câu trả lời. Ngoại lệ duy ` +
    `nhất: câu hỏi chung về cách dùng AI OS / cách chat với bạn.\n\n` +
    ROUTING_RULE_REQ(reqId) +
    rulesBlock(opts) +
    `Tuân thủ NGUYÊN VĂN hai SKILL.md dưới đây, đặc biệt các CỔNG NGƯỜI (🔴): không tự điền số lương, ` +
    `không tự ý coi như đã gửi email (bạn không có Gmail/Calendar/Drive/Sheets thật — hãy soạn nội dung ` +
    `đầy đủ rồi yêu cầu người dùng tự copy/gửi thủ công), không tự quyết ai được mời phỏng vấn.\n\n` +
    `QUAN TRỌNG — trạng thái chỉ được coi là đã lưu khi gọi tool: nếu bạn kết luận một bước đã hoàn tất và ` +
    `có thể chuyển sang bước kế tiếp, PHẢI gọi update_requisition_fields với buoc_hien_tai mới NGAY trong lượt ` +
    `đó. Chỉ nói bằng lời "đã hoàn tất B..." mà không gọi tool sẽ KHÔNG được lưu — lần chat sau (hoặc sau khi ` +
    `restart) bước sẽ vẫn hiện đúng như cũ, người dùng sẽ tưởng bị mất tiến độ dù bạn đã nói là xong.\n\n` +
    `QUAN TRỌNG — chấm điểm CV (B4): ngay khi bạn đưa ra điểm số/xếp loại cụ thể cho một ứng viên trong ` +
    `câu trả lời (bảng điểm, điểm mạnh, điểm cần hỏi...), PHẢI gọi tool upsert_candidate lưu đúng số đó ` +
    `NGAY TRONG CÙNG LƯỢT — không hiển thị điểm cho user rồi chờ user yêu cầu "lưu lại" mới lưu, không hỏi ` +
    `thêm thông tin rồi bỏ dở việc lưu. Chỉ hiện điểm trong chat mà không gọi tool = dữ liệu KHÔNG vào file ` +
    `pipeline, bước kế tiếp (B5+) sẽ không thấy ứng viên này. Lệnh gọi PHẢI kèm đủ diem_chi_tiet (4 hạng mục ` +
    `bat_buoc/nen_co/kinh_nghiem/on_dinh của rubric B1) chứ không chỉ tổng diem — thiếu breakdown thì cột ` +
    `tương ứng trong Excel Pipeline sẽ trống, người dùng không truy được vì sao điểm ra như vậy. Nếu thiếu ` +
    `căn cứ chấm điểm (chưa có tiêu chí JD) thì được phép từ chối chấm và hỏi lại — nhưng một khi bạn đã nêu ` +
    `một con số điểm cụ thể, con số đó (kèm breakdown) bắt buộc phải được lưu qua tool trong cùng lượt, kèm ` +
    `ghi chú cảnh báo trong diem_can_hoi nếu điểm chưa chắc chắn do thiếu tiêu chí.\n\n` +
    `=== hr/skills/tuyen-dung/SKILL.md (điều phối) ===\n${dispatcherMd}\n\n` +
    `=== hr/skills/${buoc.skill}/SKILL.md (bước hiện tại B${initial.buoc_hien_tai}) ===\n${stepMd}\n\n` +
    `=== Trạng thái requisition hiện tại (JSON thật) ===\n${JSON.stringify(initial, null, 2)}\n\n` +
    // Cần danh sách các đợt khác để phát đúng mã REQ trong marker định tuyến — nhưng chỉ tóm tắt,
    // không đưa JSON đầy đủ, tránh Agent lấy nhầm dữ liệu đợt khác vào việc của đợt này.
    `=== Các requisition KHÁC đang có (chỉ để định tuyến — KHÔNG thao tác lên chúng ở đây) ===\n` +
    JSON.stringify(
      listRequisitions()
        .filter((r) => r.requisition_id !== reqId)
        .map((r) => ({ requisition_id: r.requisition_id, vi_tri: r.vi_tri?.ten, buoc_hien_tai: r.buoc_hien_tai })),
      null, 2
    ) +
    jdCuDinhKemBlock(initial) +
    cvFolderBlock(reqId, initial);

  const { attachments, skipped } = findCvAttachments(reqId, message);
  const userContent = attachments.length
    ? [
        { type: "text", text: message },
        ...attachments.map((a) => ({ type: "file", file: a })),
      ]
    : message;

  const messages = [
    ...persistedLog.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: String(h.text || "") })),
    { role: "user", content: userContent },
  ];
  // Có CV đính kèm → đổi sang model có vision (CV_READ_MODEL), không dùng plugin OCR nữa (Claude tự
  // đọc PDF gốc). Không có CV đính kèm → giữ nguyên DEFAULT_MODEL (DeepSeek V4 Flash) cho mọi bước khác.
  const model = attachments.length ? CV_READ_MODEL : undefined;

  // Marker định tuyến bị cắt TRƯỚC khi lưu — chat-log là thứ người đọc lại sau này,
  // không nên dính ký hiệu nội bộ.
  const persist = (reply) => {
    const entries = [];
    if (!opts.silent) {
      const skipNote = skipped.length ? ` [Lưu ý: ${skipped.join(", ")} vượt ${CV_MAX_BYTES / 1024 / 1024}MB, chưa đính kèm được]` : "";
      entries.push({ role: "user", text: message + skipNote, at: nowISO() });
    }
    entries.push({ role: "agent", text: reply, at: nowISO() });
    saveChatLog(reqId, [...persistedLog, ...entries]);
  };

  const finish = (rawReply, toolLog) => {
    const { reply, routing } = extractRouting(rawReply, reqId);
    persist(reply);
    return {
      reply,
      requisition: getRequisition(reqId),
      toolLog,
      // Lượt silent là hệ thống tự hỏi (kickoff mở bước), không có câu hỏi nào của user để
      // đem sang khung chat khác — gắn nút chuyển ở đây chỉ gây rối.
      routing: opts.silent ? null : routing || fallbackRouting(message, reqId),
    };
  };

  const toolLog = [];
  for (let turn = 0; turn < 5; turn++) {
    const msg = await callChatModel({ system, messages, tools: TOOLS, model });
    const toolCalls = msg.tool_calls || [];

    if (!toolCalls.length) return finish(msg.content || "(Sonnet không trả lời gì)", toolLog);

    messages.push({ role: "assistant", content: msg.content || null, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      const outcome = await runTool(reqId, tc);
      toolLog.push({ tool: tc.function?.name, input: outcome.input, error: outcome.error, result: outcome.result });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(outcome.error ? { error: outcome.error } : outcome.result),
      });
    }
  }
  return finish("⚠️ Đã đạt giới hạn 5 lượt tool-call trong 1 tin nhắn — dừng lại để tránh vòng lặp. Hãy nhắn cụ thể hơn.", toolLog);
}

// ---------- Chat CHUNG — không gắn với 1 requisition cụ thể ----------
// Trước đây mọi tin nhắn ở tab Chat của hr-1 đều bị ép vào context của 1 requisition đang chọn
// trong dropdown (kể cả câu hỏi chung chung), làm bẩn chat-log của requisition đó. Đường này cho
// phép hỏi han/định hướng chung mà không đụng vào state hay tool của requisition nào.
const GENERAL_CHATLOG_PATH = path.join(HR_ROOT, "data", "chat-log-general.json");

function loadGeneralChatLog() {
  if (!fs.existsSync(GENERAL_CHATLOG_PATH)) return [];
  try {
    const raw = fs.readFileSync(GENERAL_CHATLOG_PATH, "utf8");
    const arr = raw && raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveGeneralChatLog(log) {
  ensureDir(path.dirname(GENERAL_CHATLOG_PATH));
  fs.writeFileSync(GENERAL_CHATLOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

function getGeneralChatLog() {
  return loadGeneralChatLog();
}

async function chatGeneral(message, opts = {}) {
  if (!message || typeof message !== "string") throw err(400, "Thiếu 'message'");
  const dispatcherMd = fs.readFileSync(path.join(SKILLS_DIR, "tuyen-dung", "SKILL.md"), "utf8");
  const persistedLog = loadGeneralChatLog();

  const system =
    `Bạn là hr-1 (HR Agent) trong AI OS. Đây là CHAT CHUNG — không gắn với 1 requisition cụ thể. ` +
    `Dùng để trả lời câu hỏi tổng quát về tuyển dụng/nhân sự, hoặc giúp user quyết định nên xử lý ` +
    `requisition nào tiếp theo. Bạn KHÔNG có tool nào ở đây (không sửa được file nào cả) — nếu user ` +
    `muốn thao tác thật trên 1 requisition cụ thể (viết JD, chấm CV, đổi bước, cập nhật ứng viên...), ` +
    `hướng dẫn họ chọn đúng requisition đó ở dropdown phía trên khung chat rồi hỏi lại ở đó.\n\n` +
    `PHẠM VI — bắt buộc tuân thủ: bạn CHỈ trả lời trong phạm vi tuyển dụng & hồ sơ nhân sự. Nếu user ` +
    `hỏi việc thuộc phòng ban khác (marketing, kế toán, pháp lý, kỹ thuật, CSKH...), từ chối RÕ RÀNG và ` +
    `định hướng sang đúng Agent phụ trách — KHÔNG tự ý trả lời một phần hay "hỗ trợ thêm" ngoài phạm vi.\n\n` +
    ROUTING_RULE_GENERAL +
    rulesBlock(opts) +
    `=== hr/skills/tuyen-dung/SKILL.md (điều phối, tham khảo) ===\n${dispatcherMd}\n\n` +
    `=== Danh sách requisition hiện có (thật) ===\n${JSON.stringify(listRequisitions(), null, 2)}`;

  const messages = [
    ...persistedLog.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: String(h.text || "") })),
    { role: "user", content: message },
  ];

  const msg = await callChatModel({ system, messages });
  const { reply, routing } = extractRouting(msg.content || "(không trả lời gì)", GENERAL_KEY);

  const entries = [];
  if (!opts.silent) entries.push({ role: "user", text: message, at: nowISO() });
  entries.push({ role: "agent", text: reply, at: nowISO() });
  saveGeneralChatLog([...persistedLog, ...entries]);

  return { reply, routing: opts.silent ? null : routing || fallbackRouting(message, GENERAL_KEY) };
}

// HTTP-facing: ghi form đánh giá phỏng vấn (deterministic) rồi đồng bộ Excel luôn, trả về đủ để
// frontend cập nhật UI ngay không cần gọi thêm request nào.
async function submitInterviewEvaluation(reqId, input) {
  const { ma_uv, requisition, uv, advancedToB7 } = recordInterviewEvaluation(reqId, input);
  const sheetSync = await syncCandidateToSheet(reqId, uv);
  return { ma_uv, requisition, sheetSync, advancedToB7 };
}

// Cho phép tải file thật đã tạo trong hồ sơ (offer letter, JD, shortlist...) qua trình duyệt —
// chỉ giới hạn trong hr/data/ho-so/ (chỗ chứa hồ sơ requisition), không phục vụ file server khác.
function resolveDownloadFile(relPath) {
  if (!relPath || typeof relPath !== "string") throw err(400, "Thiếu 'path'");
  const resolved = path.normalize(path.isAbsolute(relPath) ? relPath : path.join(AIOS_ROOT, relPath));
  const hosoNorm = path.normalize(HOSO_DIR);
  if (resolved !== hosoNorm && !resolved.startsWith(hosoNorm + path.sep)) {
    throw err(400, "Đường dẫn không hợp lệ — chỉ tải được file trong hr/data/ho-so/");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw err(404, `Không tìm thấy file "${relPath}"`);
  return resolved;
}

module.exports = {
  listRequisitions,
  getRequisition,
  createRequisition,
  getSkillMarkdown,
  chatOnRequisition,
  getChatLog,
  chatGeneral,
  getGeneralChatLog,
  submitInterviewEvaluation,
  resolveDownloadFile,
  // Hai hàm thuần của lớp định tuyến — export để kiểm thử được mà không phải gọi mô hình thật
  // (gọi thật sẽ ghi vào chat-log.json của requisition đang có).
  extractRouting,
  fallbackRouting,
};
