// Đăng bài lên TripX SEO-CMS — gọi lại post_article.py của skill tripx-webpost.
//
// VÌ SAO GỌI LẠI SCRIPT PYTHON THAY VÌ TỰ GỌI API: script đó đã xử lý sẵn và đã được kiểm
// chứng thực tế những phần dễ sai nhất — chuyển markdown sang HTML đúng thứ sanitizer của
// TripX giữ lại (h1-h4, table có thead/tbody, không class/style), upload media multipart, và
// chèn watermark logo TripX vào mọi ảnh do AI sinh. Viết lại bằng Node là nhân đôi chỗ có thể
// sai mà chẳng được gì. "Đúng skill" ở đây nghĩa là dùng chính công cụ của skill.

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILL_DIR = process.env.TRIPX_SKILL_DIR ||
  path.join(os.homedir(), ".claude", "skills", "tripx-webpost");
const SCRIPT = path.join(SKILL_DIR, "post_article.py");
const CONFIG = path.join(SKILL_DIR, "config.json");
const PYTHON = process.env.PYTHON_BIN || "python";

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

function sanSang() {
  return fs.existsSync(SCRIPT) && (fs.existsSync(CONFIG) || !!process.env.TRIPX_SEO_API_KEY);
}

/* Script chạy bằng Python trên Windows nên đường dẫn phải ở dạng Windows (C:/...),
   KHÔNG phải dạng Git-Bash (/c/...) — os.path bên Python không resolve được dạng kia. */
function duongDanWindows(p) {
  return path.resolve(p).replace(/\\/g, "/");
}

function chay(args, { timeoutMs = 180000 } = {}) {
  if (!fs.existsSync(SCRIPT)) {
    return Promise.reject(err(500, `Không thấy post_article.py tại ${SCRIPT} — skill tripx-webpost chưa cài?`));
  }
  return new Promise((resolve, reject) => {
    execFile(PYTHON, ["-X", "utf8", SCRIPT, ...args], {
      cwd: SKILL_DIR,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      encoding: "utf8",
    }, (e, stdout, stderr) => {
      const out = String(stdout || "") + String(stderr || "");
      if (e) {
        if (e.killed) return reject(err(504, `post_article.py ${args[0]} quá ${Math.round(timeoutMs / 1000)}s chưa xong`));
        return reject(err(502, `post_article.py ${args[0]} lỗi: ${out.trim().slice(0, 500) || e.message}`));
      }
      resolve(out);
    });
  });
}

async function ping() {
  const out = await chay(["ping"], { timeoutMs: 30000 });
  return { ok: /✅|hợp lệ/i.test(out), out: out.trim() };
}

/* Upload một ảnh local lên thư viện media TripX, LUÔN kèm watermark: mọi ảnh do AI sinh
   phải mang logo TripX mờ ở góc để nhận diện xuất xứ (quy định trong SKILL.md). */
async function uploadAnh(fileLocal) {
  const abs = duongDanWindows(fileLocal);
  if (!fs.existsSync(abs)) throw err(400, `Không thấy file ảnh ${abs}`);
  const out = await chay(["media", "--file", abs, "--watermark"], { timeoutMs: 120000 });
  const m = out.match(/absoluteUrl\s*:\s*(\S+)/);
  if (!m) throw err(502, `Không đọc được absoluteUrl từ đầu ra upload: ${out.trim().slice(0, 300)}`);
  return m[1];
}

/* Tạo bài từ file markdown (đã có front-matter TripX). Mọi metadata lấy từ front-matter,
   chỉ truyền cờ khi cần ghi đè. */
async function dangBai({ fileMarkdown, publish = false, coverImage, overrides = {} }) {
  const abs = duongDanWindows(fileMarkdown);
  if (!fs.existsSync(abs)) throw err(400, `Không thấy file bài viết ${abs}`);

  const args = ["create", "--file", abs];
  if (coverImage) args.push("--coverImage", coverImage, "--ogImage", coverImage);
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== null && String(v).trim()) args.push(`--${k}`, String(v));
  }
  if (publish) args.push("--publish");

  const out = await chay(args, { timeoutMs: 180000 });

  const mTao = out.match(/slug=([^,)\s]+),\s*id=([^)\s]+)/);
  const mUrl = out.match(/Đã xuất bản:\s*(\S+)/);
  if (!mTao) throw err(502, `Không đọc được id/slug từ đầu ra tạo bài: ${out.trim().slice(0, 400)}`);

  return {
    id: mTao[2],
    slug: mTao[1],
    published: !!mUrl,
    url: mUrl ? mUrl[1] : null,
    out: out.trim(),
  };
}

async function xuatBan(id) {
  const out = await chay(["publish", "--id", String(id)], { timeoutMs: 60000 });
  const m = out.match(/Đã xuất bản:\s*(\S+)/);
  return { published: !!m, url: m ? m[1] : null, out: out.trim() };
}

async function kiemTraSlug(slug) {
  const out = await chay(["check-slug", "--slug", String(slug)], { timeoutMs: 30000 });
  return { out: out.trim(), conTrong: !/đã (tồn tại|dùng)|taken/i.test(out) };
}

function trangThai() {
  return {
    sanSang: sanSang(),
    script: fs.existsSync(SCRIPT) ? SCRIPT : null,
    coConfig: fs.existsSync(CONFIG),
  };
}

module.exports = { sanSang, ping, uploadAnh, dangBai, xuatBan, kiemTraSlug, trangThai, duongDanWindows };
