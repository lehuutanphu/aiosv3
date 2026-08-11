// Module Thu thập Lead — Lead Hunter Agent (sales-2)
//
// Ba việc THẬT ở đây, không mô phỏng:
//   1. /api/sales/fetch    — tải nội dung một URL từ phía server (frontend không tự tải được
//                            vì CORS). Facebook chặn khách chưa đăng nhập → trả blocked=true
//                            kèm lý do, KHÔNG bịa nội dung.
//   2. /api/sales/extract  — bóc tách lead từ văn bản. Luôn chạy lượt regex tất định
//                            (số điện thoại / email / khối bình luận). Có OPENROUTER_API_KEY
//                            thì chạy thêm lượt LLM để đặt tên, phân loại khách/partner và
//                            phân loại dịch vụ — nhưng mọi số điện thoại & email do LLM trả về
//                            phải xuất hiện NGUYÊN VĂN trong nguồn, nếu không thì loại bỏ.
//   3. /api/sales/leads    — sao lưu / khôi phục danh sách Lead ra file (localStorage của
//                            trình duyệt không phải chỗ giữ dữ liệu kinh doanh lâu dài).
//
// Xem sales/README.md mục "Giới hạn công cụ" để biết chỗ nào còn phải làm tay.

const fs = require("fs");
const path = require("path");
const { callChatModel } = require("./openrouter");

const SALES_ROOT = path.join(__dirname, "..", "sales");
const LEADS_DIR = path.join(SALES_ROOT, "data", "leads");
const LEADS_FILE = path.join(LEADS_DIR, "leads.json");

const FETCH_TIMEOUT_MS = 20000;
const MAX_TEXT_CHARS = 60000;

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ================= 1. TẢI NGUỒN ================= */

// Facebook trả trang đăng nhập cho khách vãng lai. Nhận diện để báo đúng lý do
// thay vì đưa cả trang login cho Agent bóc tách (sẽ ra 0 lead mà không rõ vì sao).
const LOGIN_WALL_MARKS = [
  "you must log in to continue",
  "bạn phải đăng nhập để tiếp tục",
  "log into facebook",
  "đăng nhập vào facebook",
  "content isn't available right now",
  "nội dung hiện không có sẵn",
  // mbasic trả trang "đổi trình duyệt đi" khi User-Agent quá mới — cũng là một dạng tường chặn
  "trình duyệt này không hỗ trợ facebook",
  "this browser is not supported",
  "unsupported browser",
];

function looksLikeLoginWall(text) {
  const t = text.toLowerCase();
  return LOGIN_WALL_MARKS.some((m) => t.includes(m)) || (t.length < 2500 && t.includes("facebook") && /đăng nhập|log in/i.test(t));
}

// HTML → text thô. Không dùng thư viện ngoài: bỏ script/style, đổi thẻ khối thành xuống dòng.
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// mbasic là bản HTML thuần của Facebook — đôi khi trả được nội dung công khai khi bản
// www chỉ trả khung ứng dụng rỗng. Thử thêm biến thể này trước khi kết luận là chặn.
function fbVariants(url) {
  const out = [url];
  try {
    const u = new URL(url);
    if (/(^|\.)facebook\.com$/i.test(u.hostname) && u.hostname !== "mbasic.facebook.com") {
      const m = new URL(url);
      m.hostname = "mbasic.facebook.com";
      out.push(m.toString());
    }
  } catch (e) { /* URL không hợp lệ — để bước gọi báo lỗi */ }
  return out;
}

async function fetchOne(url) {
  // mbasic là bản dành cho máy yếu/trình duyệt cũ — gửi User-Agent hiện đại vào đó sẽ nhận
  // trang "trình duyệt không hỗ trợ" thay vì nội dung.
  const isMbasic = /mbasic\.facebook\.com/i.test(url);
  const headers = {
    "User-Agent": isMbasic
      ? "Mozilla/5.0 (Linux; U; Android 4.4.2; vi-vn; SM-G900F Build/KOT49H) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    Accept: "text/html,application/xhtml+xml",
  };
  // Cookie tùy chọn cho trang cần đăng nhập — người dùng tự chịu trách nhiệm về
  // điều khoản dịch vụ của nền tảng (xem sales/README.md §3).
  if (process.env.FB_COOKIE && /facebook\.com/i.test(url)) headers.Cookie = process.env.FB_COOKIE;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    const html = await resp.text();
    return { status: resp.status, html };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(payload) {
  const url = String(payload.url || "").trim();
  if (!/^https?:\/\//i.test(url)) throw err(400, "URL phải bắt đầu bằng http:// hoặc https://");

  const tried = [];
  let best = null;

  for (const candidate of fbVariants(url)) {
    let res;
    try {
      res = await fetchOne(candidate);
    } catch (e) {
      tried.push({ url: candidate, error: e.name === "AbortError" ? `Quá ${FETCH_TIMEOUT_MS / 1000}s không phản hồi` : e.message });
      continue;
    }
    const text = htmlToText(res.html).slice(0, MAX_TEXT_CHARS);
    const blocked = res.status >= 400 || looksLikeLoginWall(text);
    tried.push({ url: candidate, status: res.status, chars: text.length, blocked });
    // Ngưỡng thấp: thà trả nội dung ngắn để bước bóc tách báo "0 lead" thật, còn hơn
    // kết luận "bị chặn" cho một trang chỉ đơn giản là ít chữ.
    if (!blocked && text.length >= 60) {
      return {
        ok: true, url: candidate, text, chars: text.length, blocked: false, tried,
        note: text.length < 400 ? `Nội dung tải về khá ngắn (${text.length} ký tự) — nhiều khả năng trang dựng bằng JavaScript nên phần bình luận không nằm trong HTML. Nếu thiếu Lead, hãy dán nội dung tay.` : undefined,
      };
    }
    if (!best || text.length > best.text.length) best = { url: candidate, text, status: res.status };
  }

  const isFb = /facebook\.com/i.test(url);
  return {
    ok: false,
    url,
    text: best ? best.text : "",
    chars: best ? best.text.length : 0,
    blocked: true,
    note: isFb
      ? (process.env.FB_COOKIE
        ? "Facebook vẫn chặn dù đã có FB_COOKIE — cookie có thể đã hết hạn, hoặc bài viết ở chế độ riêng tư/nhóm kín."
        : "Facebook không trả nội dung cho phía server chưa đăng nhập. Cách xử lý: mở bài viết, bấm 'Xem thêm bình luận' cho hết, bôi đen toàn bộ phần bình luận rồi dán vào ô 'Nội dung dán tay'.")
      : "Không lấy được nội dung có nghĩa từ URL này (trang rỗng, chặn bot, hoặc nội dung do JavaScript dựng sau khi tải).",
    tried,
  };
}

/* ================= 2. BÓC TÁCH LEAD ================= */

// Mẩu giao diện Facebook lẫn vào khi người dùng bôi đen ("2 giờ · Thích · Trả lời").
// Cắt theo dấu · rồi bỏ từng mẩu, vì chúng thường nằm chung dòng với nhau.
const NOISE_PART = /^(thích|like|trả lời|phản hồi|chia sẻ|xem thêm.*|xem \d+.*|ẩn bớt|đã chỉnh sửa|top comments|bình luận hàng đầu|mới nhất|tất cả bình luận|\d+\s*(phút|giờ|ngày|tuần|tháng|năm)( trước)?|\d+\s*[mhdwy])$/i;

function cleanLines(block) {
  return block
    .split("\n")
    .map((l) => l.split("·").map((s) => s.trim()).filter((s) => s && !NOISE_PART.test(s)).join(" · "))
    .filter(Boolean);
}

// Số điện thoại Việt Nam, chấp nhận dạng viết cách/chấm/gạch: 0912.345.678, +84 912 345 678.
// Dấu ngăn KHÔNG được gồm xuống dòng — nếu không, số cuối dòng sẽ nuốt luôn chữ số
// đầu dòng kế tiếp ("…+84987445566\n30 phút") và thành số 11 chữ số vô nghĩa.
const PHONE_CANDIDATE = /(?:\+?84|0)[ .\-]?(?:\d[ .\-]?){8,10}/g;
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;

function normPhone(raw) {
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+84")) d = "0" + d.slice(3);
  else if (/^84\d{9,10}$/.test(d)) d = "0" + d.slice(2);
  if (/^0(3|5|7|8|9)\d{8}$/.test(d)) return d;      // di động 10 số
  if (/^02\d{8,9}$/.test(d)) return d;               // cố định 10–11 số
  return null;
}

function findPhones(text) {
  const out = [];
  for (const m of String(text).matchAll(PHONE_CANDIDATE)) {
    const p = normPhone(m[0]);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function findEmails(text) {
  const out = [];
  for (const m of String(text).matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

// Tên người: dòng ngắn, không chứa số, viết hoa đầu từ — đúng dạng tên hiển thị Facebook.
function looksLikeName(line) {
  if (!line || line.length > 45) return false;
  if (/\d|@|https?:/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((w) => /^[\p{Lu}\p{L}][\p{L}'.\-]*$/u.test(w));
}

function splitBlocks(text) {
  const raw = String(text).replace(/\r/g, "");
  let blocks = raw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  // Dán từ Facebook thường không có dòng trống — khi đó tách theo dòng-tên:
  // mỗi lần gặp một dòng trông như tên người là bắt đầu một bình luận mới.
  if (blocks.length <= 2) {
    const lines = cleanLines(raw);
    const grouped = [];
    let cur = [];
    for (const l of lines) {
      if (looksLikeName(l) && cur.length) { grouped.push(cur.join("\n")); cur = [l]; }
      else cur.push(l);
    }
    if (cur.length) grouped.push(cur.join("\n"));
    if (grouped.length > blocks.length) blocks = grouped;
  }
  return blocks;
}

// Từ khóa phân loại — chỉ dùng khi KHÔNG có LLM, và luôn kèm cờ cần người xác nhận.
const PARTNER_KW = ["cho thuê", "bên mình có", "bên em có", "nhà mình có", "mình có", "em có", "nhận đặt", "cung cấp", "chuyên", "dịch vụ của", "liên hệ hợp tác", "hợp tác", "có xe", "có phòng", "nhận tour", "báo giá cho", "ib mình", "inbox mình", "nhà xe", "chủ homestay", "quán mình", "shop mình"];
const CUSTOMER_KW = ["cần thuê", "cần tìm", "muốn đặt", "cho hỏi", "bao nhiêu", "giá sao", "ai có", "tìm giúp", "cần book", "book giúp", "tư vấn giúp", "còn phòng không", "còn xe không", "xin giá", "cần người"];

const SERVICE_KW = {
  xe: ["xe", "ô tô", "oto", "limousine", "16 chỗ", "29 chỗ", "45 chỗ", "7 chỗ", "4 chỗ", "tài xế", "nhà xe", "xe máy", "đưa đón", "thuê xe", "vận chuyển"],
  homestay: ["homestay", "khách sạn", "resort", "villa", "phòng nghỉ", "lưu trú", "nhà nghỉ", "căn hộ", "bungalow"],
  "quan-an": ["quán ăn", "nhà hàng", "quán nhậu", "đặt bàn", "set menu", "buffet", "cơm", "hải sản", "quán cà phê", "cafe", "coffee"],
  tour: ["tour", "hướng dẫn viên", "hdv", "vé tham quan", "lịch trình", "combo du lịch", "tàu", "cano", "vé máy bay"],
  "spa-lam-dep": ["spa", "massage", "làm đẹp", "nail", "tóc", "trang điểm"],
};

function guessService(text) {
  const t = text.toLowerCase();
  let best = null, bestHits = 0;
  for (const [key, kws] of Object.entries(SERVICE_KW)) {
    const hits = kws.filter((k) => t.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = key; }
  }
  return bestHits ? best : "khac";
}

function guessType(text) {
  const t = text.toLowerCase();
  const p = PARTNER_KW.filter((k) => t.includes(k)).length;
  const c = CUSTOMER_KW.filter((k) => t.includes(k)).length;
  if (p > c) return "partner";
  if (c > p) return "khach";
  return "chua_ro";
}

// Lượt regex — luôn chạy, không cần API key. Đây là "sàn" chất lượng của tính năng.
function extractByRegex(text, source) {
  const leads = [];
  for (const block of splitBlocks(text)) {
    const lines = cleanLines(block);
    if (!lines.length) continue;
    const phones = findPhones(block);
    const emails = findEmails(block);
    if (!phones.length && !emails.length) continue; // không có cách liên hệ → không phải lead

    const ten = looksLikeName(lines[0]) ? lines[0] : "";
    const comment = (ten ? lines.slice(1) : lines).join(" ").trim().slice(0, 800);
    const hay = block.toLowerCase();
    leads.push({
      ten,
      sdt: phones[0] || "",
      sdt_khac: phones.slice(1),
      email: emails[0] || "",
      comment,
      nguon: source || "",
      loai: guessType(hay),
      dich_vu: guessService(hay),
      do_tin_cay: "thap",
      can_nguoi_xac_nhan: true,
      cach_boc_tach: "regex",
    });
  }
  return leads;
}

const EXTRACT_SYSTEM = [
  "Bạn là Lead Hunter Agent của một công ty Việt Nam, nhiệm vụ bóc tách thông tin liên hệ từ phần bình luận mạng xã hội.",
  "",
  "LUẬT BẮT BUỘC:",
  "1. Chỉ ghi lại thông tin CÓ THẬT trong văn bản nguồn. Không suy đoán, không hoàn thiện số điện thoại thiếu số, không tự thêm mã vùng.",
  "2. Không có số điện thoại lẫn email thì BỎ QUA bình luận đó — không tạo lead rỗng.",
  "3. Trường 'comment' phải là nguyên văn (có thể cắt bớt) bình luận của người đó, không viết lại theo ý bạn.",
  "4. 'loai' chỉ nhận: khach (người đang có nhu cầu mua/thuê dịch vụ) | partner (người đang chào bán/cung cấp dịch vụ, có thể mời hợp tác) | chua_ro.",
  "5. 'dich_vu' chỉ nhận: xe | homestay | quan-an | tour | spa-lam-dep | khac.",
  "6. 'do_tin_cay' nhận: cao | trung_binh | thap — hạ xuống thấp khi bình luận mơ hồ.",
  "",
  "Trả về DUY NHẤT một khối JSON, không kèm lời dẫn:",
  '{"leads":[{"ten":"","sdt":"","email":"","comment":"","loai":"khach","dich_vu":"xe","nhu_cau":"tóm tắt 1 câu nhu cầu hoặc dịch vụ họ cung cấp","do_tin_cay":"cao"}]}',
].join("\n");

function parseJsonBlock(content) {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function extractByLlm(text, source) {
  const message = await callChatModel({
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: `NGUỒN: ${source || "(người dùng dán tay)"}\n\nNỘI DUNG BÌNH LUẬN:\n${text.slice(0, 24000)}` }],
  });
  const data = parseJsonBlock(message.content);
  if (!data || !Array.isArray(data.leads)) throw err(502, "Mô hình không trả về khối JSON đúng định dạng {leads:[...]}");
  return data.leads;
}

async function extractLeads(payload) {
  const text = String(payload.text || "");
  const source = String(payload.url || "").trim();
  if (text.trim().length < 20) throw err(400, "Nội dung nguồn quá ngắn để bóc tách (cần ít nhất 20 ký tự)");

  const warnings = [];
  const base = extractByRegex(text, source);
  const phonesInSource = findPhones(text);
  const emailsInSource = findEmails(text);

  if (!process.env.OPENROUTER_API_KEY) {
    warnings.push("Chưa có OPENROUTER_API_KEY — chỉ chạy được lượt bóc tách tất định (regex). Tên và phân loại do luật từ khóa đoán, cần người rà lại.");
    return { leads: base, method: "regex", warnings, stats: { blocks: splitBlocks(text).length, phones: phonesInSource.length, emails: emailsInSource.length } };
  }

  let llmLeads;
  try {
    llmLeads = await extractByLlm(text, source);
  } catch (e) {
    warnings.push(`Lượt LLM lỗi (${e.message}) — giữ nguyên kết quả regex.`);
    return { leads: base, method: "regex", warnings, stats: { blocks: splitBlocks(text).length, phones: phonesInSource.length, emails: emailsInSource.length } };
  }

  // Rào chắn chống bịa: số điện thoại / email do mô hình trả về phải có trong nguồn.
  const kept = [];
  let droppedPhone = 0, droppedAll = 0;
  for (const l of llmLeads) {
    const phone = normPhone(l.sdt || "");
    const email = String(l.email || "").toLowerCase().trim();
    const okPhone = phone && phonesInSource.includes(phone);
    const okEmail = email && emailsInSource.includes(email);
    if (l.sdt && !okPhone) droppedPhone++;
    if (!okPhone && !okEmail) { droppedAll++; continue; }
    kept.push({
      ten: String(l.ten || "").trim().slice(0, 80),
      sdt: okPhone ? phone : "",
      sdt_khac: [],
      email: okEmail ? email : "",
      comment: String(l.comment || "").trim().slice(0, 800),
      nhu_cau: String(l.nhu_cau || "").trim().slice(0, 200),
      nguon: source,
      loai: ["khach", "partner", "chua_ro"].includes(l.loai) ? l.loai : "chua_ro",
      dich_vu: Object.keys(SERVICE_KW).concat("khac").includes(l.dich_vu) ? l.dich_vu : "khac",
      do_tin_cay: ["cao", "trung_binh", "thap"].includes(l.do_tin_cay) ? l.do_tin_cay : "trung_binh",
      can_nguoi_xac_nhan: l.do_tin_cay !== "cao",
      cach_boc_tach: "llm",
    });
  }
  if (droppedPhone) warnings.push(`Loại bỏ ${droppedPhone} số điện thoại mô hình đưa ra nhưng không có nguyên văn trong nguồn.`);
  if (droppedAll) warnings.push(`Bỏ ${droppedAll} lead không còn cách liên hệ nào kiểm chứng được.`);

  // Số điện thoại regex tìm ra mà lượt LLM bỏ sót thì bổ sung lại — thà thừa để người rà
  // còn hơn mất lead có thật.
  const seen = new Set(kept.map((l) => l.sdt).filter(Boolean));
  for (const l of base) {
    if (l.sdt && !seen.has(l.sdt)) { kept.push(l); seen.add(l.sdt); }
  }

  return { leads: kept, method: "llm+regex", warnings, stats: { blocks: splitBlocks(text).length, phones: phonesInSource.length, emails: emailsInSource.length } };
}

/* ================= 3. SAO LƯU DANH SÁCH LEAD ================= */

async function saveLeads(payload) {
  const leads = Array.isArray(payload.leads) ? payload.leads : null;
  if (!leads) throw err(400, "Thiếu mảng 'leads'");
  ensureDir(LEADS_DIR);
  const snapshot = { luu_luc: new Date().toISOString(), so_luong: leads.length, leads };
  fs.writeFileSync(LEADS_FILE, JSON.stringify(snapshot, null, 2), "utf8");

  // Đĩa local vẫn là nơi ghi chính. Đẩy lên Firestore chỉ khi SYNC_PII=true, vì kho lead
  // chứa SĐT/email của người ngoài công ty (Nghị định 13/2023) — mặc định KHÔNG đẩy.
  const dongBo = await require("./db").syncLeads(leads);
  return { saved: true, file: path.relative(path.join(__dirname, ".."), LEADS_FILE), count: leads.length, firestore: dongBo };
}

function loadLeads() {
  if (!fs.existsSync(LEADS_FILE)) return { leads: [], luu_luc: null, count: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
    return { leads: Array.isArray(data.leads) ? data.leads : [], luu_luc: data.luu_luc || null, count: (data.leads || []).length };
  } catch (e) {
    throw err(500, `File sao lưu lead hỏng (${LEADS_FILE}): ${e.message}`);
  }
}

module.exports = { fetchSource, extractLeads, saveLeads, loadLeads, normPhone, findPhones };
