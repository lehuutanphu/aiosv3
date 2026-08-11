// Module Marketing — phục vụ nội dung SKILL.md thật cho engine Content Cluster trong Dashboard.
//
// Lý do tồn tại: engine vòng lặp trong website/js/work.js trước đây nhúng prompt rút gọn ngay
// trong code, nên sửa SKILL.md xong thì engine vẫn chạy theo bản cũ — hai bên lệch nhau mà
// không ai biết. Giờ engine đọc thẳng file skill qua endpoint này, SKILL.md là nguồn sự thật duy nhất.

const fs = require("fs");
const path = require("path");

const MKT_ROOT = path.join(__dirname, "..", "marketing");

// Danh sách trắng — chặn path traversal, không nhận id tuỳ ý từ client
const SKILL_IDS = new Set([
  "content-cluster",
  "nghien-cuu-chu-de",
  "kien-truc-seo-cluster",
  "viet-bai-chuan-seo",
  "prompt-anh-ai",
  "dong-goi-cluster",
]);

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

// Bỏ frontmatter YAML — engine chỉ cần phần hướng dẫn, không cần metadata trigger
function stripFrontmatter(md) {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? md.slice(m[0].length) : md;
}

function getSkillMarkdown(id) {
  if (!SKILL_IDS.has(id)) {
    throw err(404, `Không có skill marketing "${id}". Hợp lệ: ${[...SKILL_IDS].join(", ")}`);
  }
  const filePath = path.join(MKT_ROOT, "skills", id, "SKILL.md");
  if (!fs.existsSync(filePath)) {
    throw err(404, `Thiếu file ${path.relative(path.join(__dirname, ".."), filePath)} — skill chưa được tạo.`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return { id, markdown: stripFrontmatter(raw).trim(), bytes: Buffer.byteLength(raw, "utf8") };
}

/* SKILL.md thường trỏ sang file template ("viết theo templates/bai-viet.template.md").
   Agent chạy qua OpenRouter không đọc được file, nên nếu chỉ gửi SKILL.md thì nó không
   biết khung bài viết gồm những gì — thực tế đã thiếu hẳn frontmatter SEO. Phục vụ luôn
   template để hai bên khớp nhau. */
const TEMPLATE_IDS = new Set([
  "bai-viet.template.md",
  "image-prompt-schema.md",
  "seo-blueprint-schema.md",
  "cluster.template.json",
]);

function getTemplate(id) {
  if (!TEMPLATE_IDS.has(id)) {
    throw err(404, `Không có template marketing "${id}". Hợp lệ: ${[...TEMPLATE_IDS].join(", ")}`);
  }
  const filePath = path.join(MKT_ROOT, "templates", id);
  if (!fs.existsSync(filePath)) throw err(404, `Thiếu file marketing/templates/${id}`);
  const raw = fs.readFileSync(filePath, "utf8");
  return { id, content: raw, bytes: Buffer.byteLength(raw, "utf8") };
}

function listSkills() {
  return [...SKILL_IDS].map((id) => {
    const p = path.join(MKT_ROOT, "skills", id, "SKILL.md");
    return { id, ton_tai: fs.existsSync(p) };
  });
}

/* ---------------------------------------------------------------------------
   Nạp nội dung nguồn cho agent.

   SKILL.md được viết cho runtime CÓ tool (Cowork/Claude Code) nên bảo agent tự
   `WebFetch` trang nguồn. Nhưng đường chạy qua OpenRouter chỉ là LLM trần: không
   tool, không đọc web. Nếu cứ thả prompt vào, model sẽ phát ra lệnh gọi tool rồi
   dừng — hoặc tệ hơn, viết theo trí nhớ về một trang nó chưa từng đọc, đúng thứ
   mà chính skill cấm. Vì vậy proxy đọc hộ trang nguồn rồi nhét text thật vào prompt.
--------------------------------------------------------------------------- */

const MAX_SOURCE_CHARS = 40000;

// Chặn SSRF ở mức cơ bản: chỉ http/https, không cho trỏ vào mạng nội bộ
function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { throw err(400, `URL không hợp lệ: ${raw}`); }
  if (!/^https?:$/.test(u.protocol)) throw err(400, "Chỉ nhận URL http/https");
  const h = u.hostname.toLowerCase();
  const chanBlock =
    h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) || h === "[::1]";
  if (chanBlock) throw err(400, `Không đọc URL trỏ vào mạng nội bộ: ${h}`);
  return u;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function fetchSource(rawUrl) {
  const u = assertPublicUrl(rawUrl);
  const timeoutMs = Number(process.env.SOURCE_FETCH_TIMEOUT_MS || 30000);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(u.href, {
      signal: ac.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-OS-ContentCluster/1.0)" },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === "AbortError") throw err(504, `Trang nguồn không phản hồi sau ${Math.round(timeoutMs / 1000)}s: ${u.href}`);
    throw err(502, `Không tải được trang nguồn: ${u.href}`);
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw err(502, `Trang nguồn trả lỗi ${resp.status}: ${u.href}`);

  const html = await resp.text();
  const text = htmlToText(html);
  const truncated = text.length > MAX_SOURCE_CHARS;
  return {
    url: u.href,
    ngay_truy_cap: new Date().toISOString().slice(0, 10),
    text: truncated ? text.slice(0, MAX_SOURCE_CHARS) : text,
    chars: text.length,
    truncated,
  };
}

module.exports = { getSkillMarkdown, getTemplate, listSkills, fetchSource, SKILL_IDS, TEMPLATE_IDS };
