// AI OS ↔ Hermes Agent Backend Proxy
// Giữ API key (Hermes API Server + Mem0) an toàn phía server, không lộ ra frontend.
// Xem HERMES_INTEGRATION.md ở thư mục cha để hiểu kiến trúc tổng thể.

const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const genful = require("./genful");
const hr = require("./hr");
const tripx = require("./tripx");
const marketing = require("./marketing");
const { callChatModel } = require("./openrouter");
const sales = require("./sales");

const ROOT = __dirname;

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile();

const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "agents.config.json"), "utf8"));
const PROXY_PORT = Number(process.env.PROXY_PORT || 8787);
// Hỗ trợ nhiều origin cùng lúc (phân cách bằng dấu phẩy) — vd chạy song song dashboard local
// (http://localhost:64667) và bản đã deploy (https://workers.ai-os.vn), vì proxy này luôn chạy trên
// MÁY của người mở dashboard (kể cả khi mở bản deploy) nên phải nhận diện đúng origin đang gọi tới
// thì mới trả lại đúng Access-Control-Allow-Origin — trả sai origin sẽ bị trình duyệt chặn ở tầng CORS
// dù request vẫn "thành công" ở tầng mạng (dễ nhầm là proxy không chạy).
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGIN || "http://localhost:64667")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
function pickAllowedOrigin(req) {
  const reqOrigin = req.headers.origin;
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0];
}
const MOCK_MODE = String(process.env.MOCK_MODE || "true").toLowerCase() === "true";

function hermesKeyEnvName(agentId) {
  return "HERMES_KEY_" + agentId.toUpperCase().replace(/-/g, "_");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": res.__corsOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

// maxBytes nới riêng cho từng route: 2MB đủ cho chat/requisition, nhưng KHÔNG đủ cho
// ảnh gửi dạng base64 (/api/db/media) hay cả khối công việc sau vài chục vòng cluster.
function readJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error(`Request body quá lớn (>${Math.round(maxBytes / 1024 / 1024)}MB)`), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("JSON không hợp lệ"));
      }
    });
    req.on("error", reject);
  });
}

// ---------- Chat: proxy tới Hermes API Server (OpenAI-compatible) ----------
async function handleChat(agentId, agentCfg, payload) {
  const { message, history } = payload;
  if (!message || typeof message !== "string") {
    throw Object.assign(new Error("Thiếu 'message'"), { status: 400 });
  }

  // Agent khai báo backend "openrouter" trong agents.config.json chạy THẬT qua OpenRouter,
  // KHÔNG đi qua Hermes và KHÔNG bị MOCK_MODE chặn — MOCK_MODE chỉ dành cho nhánh Hermes.
  // Đây là đường của đội marketing (Content Cluster) để không phải dựng 4 Hermes Profile.
  if (agentCfg.backend === "openrouter") {
    const model = agentCfg.model || process.env.OPENROUTER_MODEL;
    const msg = await callChatModel({
      system: `Bạn là ${agentCfg.name} trong hệ thống AI OS của doanh nghiệp. Trả lời bằng tiếng Việt, đi thẳng vào kết quả bàn giao được, không hỏi lại.`,
      messages: [
        ...(Array.isArray(history) ? history : []).map((h) => ({
          role: h.role === "agent" ? "assistant" : "user",
          content: String(h.text || h.content || ""),
        })),
        { role: "user", content: message },
      ],
      model,
      maxTokens: agentCfg.maxTokens,
    });
    const reply = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content) ? msg.content.map((c) => c.text || "").join("") : "";
    if (!reply.trim()) {
      throw Object.assign(new Error(`Model "${model}" trả về nội dung rỗng`), { status: 502 });
    }
    return { reply, mock: false, backend: "openrouter", model };
  }

  if (MOCK_MODE) {
    return {
      reply: `[MOCK — chưa nối Hermes thật] Agent "${agentCfg.name}" (profile "${agentId}") đã nhận: "${message}". ` +
        `Bật MOCK_MODE=false và điền HERMES_KEY_* trong .env để nhận phản hồi thật từ Hermes.`,
      mock: true,
    };
  }

  const apiKey = process.env[hermesKeyEnvName(agentId)];
  if (!apiKey) {
    throw Object.assign(
      new Error(`Thiếu API key cho agent "${agentId}" — đặt biến ${hermesKeyEnvName(agentId)} trong .env`),
      { status: 500 }
    );
  }

  const messages = [
    ...(Array.isArray(history) ? history : []).map((h) => ({
      role: h.role === "agent" ? "assistant" : "user",
      content: String(h.text || h.content || ""),
    })),
    { role: "user", content: message },
  ];

  const url = `http://${CONFIG.hermesHost}:${agentCfg.port}/v1/chat/completions`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: agentId, messages, stream: false }),
    });
  } catch (e) {
    throw Object.assign(
      new Error(`Không kết nối được Hermes Profile "${agentId}" tại ${url}. Đã chạy "hermes -p ${agentId} gateway start" chưa?`),
      { status: 502 }
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(new Error(`Hermes trả lỗi ${resp.status}: ${text.slice(0, 300)}`), { status: 502 });
  }

  const data = await resp.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw Object.assign(new Error("Phản hồi Hermes không đúng định dạng OpenAI Chat Completions"), { status: 502 });
  return { reply, mock: false };
}

// ---------- Knowledge: ghi thẳng vào Mem0 theo agent_id ----------
// LƯU Ý: cấu trúc request Mem0 dưới đây suy ra từ tài liệu Hermes mô tả plugin Mem0
// (không lấy trực tiếp từ docs API chính thức của Mem0) — hãy đối chiếu lại với
// https://docs.mem0.ai trước khi dùng production, endpoint/field có thể đã đổi.
async function handleKnowledge(agentId, agentCfg, payload) {
  const { text } = payload;
  if (!text || typeof text !== "string") {
    throw Object.assign(new Error("Thiếu 'text'"), { status: 400 });
  }

  if (MOCK_MODE) {
    return {
      stored: true,
      mock: true,
      note: `[MOCK] Đã "ghi" vào Mem0 cho agent_id="${agentId}": "${text.slice(0, 80)}". Bật MOCK_MODE=false + điền MEM0_API_KEY để ghi thật.`,
    };
  }

  const mem0Key = process.env.MEM0_API_KEY;
  if (!mem0Key) {
    throw Object.assign(new Error("Thiếu MEM0_API_KEY trong .env"), { status: 500 });
  }

  let resp;
  try {
    resp = await fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${mem0Key}` },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
        user_id: CONFIG.mem0UserId,
        agent_id: agentId,
      }),
    });
  } catch (e) {
    throw Object.assign(new Error("Không kết nối được tới api.mem0.ai"), { status: 502 });
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw Object.assign(new Error(`Mem0 trả lỗi ${resp.status}: ${errText.slice(0, 300)}`), { status: 502 });
  }

  const data = await resp.json().catch(() => ({}));
  return { stored: true, mock: false, mem0: data };
}

// ---------- HTTP server (không dùng framework ngoài) ----------
const server = http.createServer(async (req, res) => {
  res.__corsOrigin = pickAllowedOrigin(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": res.__corsOrigin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","agents",":id","chat"]

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        mockMode: MOCK_MODE,
        agents: Object.keys(CONFIG.agents),
      });
    }

    /* ---------- Kho dữ liệu: Firestore + bản sao đĩa ----------
       Gom ba nơi lưu trữ rời rạc về một mối. Quan trọng nhất là /api/db/articles:
       trước đây bài viết Content Cluster chỉ nằm trong localStorage của trình duyệt
       nên xoá cache là mất trắng. */
    if (parts[0] === "api" && parts[1] === "db") {
      if (parts[2] === "status" && req.method === "GET") {
        return sendJson(res, 200, db.status());
      }

      if (parts[2] === "work" && parts.length === 3) {
        if (req.method === "GET") return sendJson(res, 200, await db.loadWork());
        if (req.method === "POST") {
          // Khối công việc phình theo số vòng cluster (mỗi vòng thêm ~24 công việc kèm báo cáo)
          const payload = await readJsonBody(req, 12 * 1024 * 1024);
          return sendJson(res, 200, await db.saveWork(payload.state || payload));
        }
      }

      if (parts[2] === "articles" && parts.length === 3 && req.method === "POST") {
        const payload = await readJsonBody(req, 8 * 1024 * 1024);
        return sendJson(res, 201, await db.saveArticle(payload));
      }

      if (parts[2] === "clusters" && req.method === "GET") {
        if (parts.length === 3) return sendJson(res, 200, { clusters: db.listClusters() });
        if (parts.length === 5 && parts[4] === "articles") {
          return sendJson(res, 200, await db.listArticles(decodeURIComponent(parts[3])));
        }
      }

      if (parts[2] === "media" && parts.length === 3 && req.method === "POST") {
        // base64 phình ~33% so với nhị phân — nới trần tương ứng MEDIA_MAX_MB
        const payload = await readJsonBody(req, 25 * 1024 * 1024);
        return sendJson(res, 201, await db.saveMedia(payload));
      }

      if (parts[2] === "agents" && parts.length === 3) {
        if (req.method === "GET") return sendJson(res, 200, await db.loadAgents());
        if (req.method === "POST") {
          const payload = await readJsonBody(req, 8 * 1024 * 1024);
          return sendJson(res, 200, await db.saveAgents(payload));
        }
      }
    }

    /* ---------- TripX: sinh ảnh thật + đăng bài lên SEO-CMS ----------
       Hai chặng cuối của vòng lặp Content Cluster. Tách làm hai endpoint để mỗi chặng
       vẫn là một công việc riêng có báo cáo riêng trong phiếu, đúng cách các chặng
       S1-S3 đang chạy — chứ không gộp thành một hộp đen. */
    if (parts[0] === "api" && parts[1] === "tripx") {
      if (parts[2] === "status" && req.method === "GET") {
        return sendJson(res, 200, {
          tripx: tripx.trangThai(),
          genful: genful.trangThai(),
          credit: genful.sanSang() ? await genful.soDuCredit().catch((e) => ({ loi: e.message })) : null,
        });
      }

      // S4: sinh ảnh thật từ prompt, chèn watermark rồi upload lên thư viện media TripX
      if (parts[2] === "images" && req.method === "POST") {
        const p = await readJsonBody(req);
        const prompts = Array.isArray(p.prompts) ? p.prompts.filter((x) => x && String(x).trim()) : [];
        if (!prompts.length) return sendJson(res, 400, { error: "Thiếu mảng 'prompts'" });
        if (!genful.sanSang()) return sendJson(res, 503, { error: "Chưa cấu hình Genful (genful.config.json)" });

        const thuMuc = path.join(ROOT, "..", "marketing", "data", "bai-viet", String(p.cluster || "chung"), "anh");
        const anh = [];
        for (let i = 0; i < prompts.length; i++) {
          const ten = `${p.ma_bai || "BAI"}-${i === 0 ? "cover" : i}`;
          try {
            const g = await genful.sinhAnh({ prompt: prompts[i], outPath: path.join(thuMuc, `${ten}.jpg`) });
            const url = await tripx.uploadAnh(g.file); // luôn kèm watermark logo TripX
            anh.push({ vi_tri: i === 0 ? "cover" : `body-${i}`, prompt: prompts[i], url_tripx: url,
                       file_local: path.relative(path.join(ROOT, ".."), g.file).replace(/\\/g, "/"),
                       id_base: g.id_base, credit: g.credit, ok: true });
          } catch (e) {
            // Một ảnh hỏng KHÔNG được làm hỏng cả bài — bài vẫn đăng được, chỉ thiếu ảnh đó
            anh.push({ vi_tri: i === 0 ? "cover" : `body-${i}`, prompt: prompts[i], ok: false, loi: e.message });
          }
        }
        const tonCredit = anh.filter((a) => a.ok).reduce((s, a) => s + (a.credit || 0), 0);
        return sendJson(res, 200, { anh, so_thanh_cong: anh.filter((a) => a.ok).length, credit_da_dung: tonCredit });
      }

      // S5: thay placeholder bằng URL ảnh thật rồi tạo + xuất bản bài
      if (parts[2] === "publish" && req.method === "POST") {
        const p = await readJsonBody(req, 8 * 1024 * 1024);
        if (!p.markdown || !String(p.markdown).trim()) return sendJson(res, 400, { error: "Thiếu 'markdown'" });
        if (!tripx.sanSang()) return sendJson(res, 503, { error: "Chưa cấu hình TripX (config.json trong skill tripx-webpost)" });

        let md = String(p.markdown);
        const anh = Array.isArray(p.anh) ? p.anh.filter((a) => a && a.ok && a.url_tripx) : [];
        const cover = (anh.find((a) => a.vi_tri === "cover") || {}).url_tripx || null;

        // Placeholder trong bài có dạng /images/blog/<slug>-1.jpg — thay theo thứ tự ảnh thân bài
        const than = anh.filter((a) => a.vi_tri !== "cover");
        than.forEach((a, i) => {
          const re = new RegExp(`\\(/images/blog/[^)]*-${i + 1}\\.(jpg|png)\\)`, "g");
          md = md.replace(re, `(${a.url_tripx})`);
        });
        // Placeholder còn sót (ảnh sinh lỗi) phải gỡ bỏ — để lại là bài đăng lên bị vỡ ảnh
        const conSot = md.match(/!\[[^\]]*\]\(\/images\/blog\/[^)]+\)/g) || [];
        md = md.replace(/!\[[^\]]*\]\(\/images\/blog\/[^)]+\)\s*/g, "");

        const thuMuc = path.join(ROOT, "..", "marketing", "data", "bai-viet", String(p.cluster || "chung"));
        fs.mkdirSync(thuMuc, { recursive: true });
        const fileMd = path.join(thuMuc, `${p.ma_bai || "BAI"}-tripx.md`);
        fs.writeFileSync(fileMd, md, "utf8");

        const kq = await tripx.dangBai({ fileMarkdown: fileMd, publish: p.publish !== false, coverImage: cover });
        return sendJson(res, 200, { ...kq, cover, so_anh_gan: than.length, placeholder_da_go: conSot.length });
      }
    }

    // ---------- HR: Tuyển dụng thật (B1 deterministic) + SKILL.md thật ----------
    if (parts[0] === "api" && parts[1] === "hr" && parts[2] === "requisitions") {
      if (parts.length === 3 && req.method === "GET") {
        return sendJson(res, 200, { requisitions: hr.listRequisitions() });
      }
      if (parts.length === 3 && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = hr.createRequisition(payload);
        return sendJson(res, 201, result);
      }
      if (parts.length === 4 && req.method === "GET") {
        const data = hr.getRequisition(decodeURIComponent(parts[3]));
        return sendJson(res, 200, { requisition: data });
      }
      if (parts.length === 5 && parts[4] === "chat" && req.method === "GET") {
        const log = hr.getChatLog(decodeURIComponent(parts[3]));
        return sendJson(res, 200, { log });
      }
      if (parts.length === 5 && parts[4] === "chat" && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = await hr.chatOnRequisition(decodeURIComponent(parts[3]), payload.message, {
          silent: !!payload.silent,
          rules: Array.isArray(payload.rules) ? payload.rules : [],
          globalRules: Array.isArray(payload.globalRules) ? payload.globalRules : [],
        });
        return sendJson(res, 200, result);
      }
      if (parts.length === 5 && parts[4] === "interview-evaluation" && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = await hr.submitInterviewEvaluation(decodeURIComponent(parts[3]), payload);
        return sendJson(res, 200, result);
      }
    }

    // ---------- HR: Chat CHUNG (không gắn 1 requisition cụ thể) ----------
    if (parts[0] === "api" && parts[1] === "hr" && parts[2] === "chat") {
      if (parts.length === 3 && req.method === "GET") {
        return sendJson(res, 200, { log: hr.getGeneralChatLog() });
      }
      if (parts.length === 3 && req.method === "POST") {
        const payload = await readJsonBody(req);
        const result = await hr.chatGeneral(payload.message, {
          silent: !!payload.silent,
          rules: Array.isArray(payload.rules) ? payload.rules : [],
          globalRules: Array.isArray(payload.globalRules) ? payload.globalRules : [],
        });
        return sendJson(res, 200, result);
      }
    }

    // ---------- HR: tải file thật đã tạo trong hồ sơ (offer letter, JD, shortlist...) ----------
    if (parts[0] === "api" && parts[1] === "hr" && parts[2] === "files" && req.method === "GET") {
      const relPath = url.searchParams.get("path");
      const absPath = hr.resolveDownloadFile(relPath);
      const filename = path.basename(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const mime =
        ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        ext === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
        ext === ".pdf" ? "application/pdf" :
        ext === ".csv" ? "text/csv; charset=utf-8" :
        ext === ".md" ? "text/markdown; charset=utf-8" :
        "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Access-Control-Allow-Origin": res.__corsOrigin,
      });
      return fs.createReadStream(absPath).pipe(res);
    }

    // ---------- Marketing: phục vụ SKILL.md thật cho engine Content Cluster ----------
    if (parts[0] === "api" && parts[1] === "marketing" && parts[2] === "skills" && req.method === "GET") {
      if (parts.length === 3) return sendJson(res, 200, { skills: marketing.listSkills() });
      if (parts.length === 4) return sendJson(res, 200, marketing.getSkillMarkdown(decodeURIComponent(parts[3])));
    }

    if (parts[0] === "api" && parts[1] === "marketing" && parts[2] === "templates" && parts[3] && req.method === "GET") {
      return sendJson(res, 200, marketing.getTemplate(decodeURIComponent(parts[3])));
    }

    // Đọc hộ trang nguồn cho agent (LLM qua OpenRouter không có tool duyệt web)
    if (parts[0] === "api" && parts[1] === "marketing" && parts[2] === "fetch" && req.method === "GET") {
      const target = url.searchParams.get("url");
      if (!target) return sendJson(res, 400, { error: "Thiếu tham số ?url=" });
      const result = await marketing.fetchSource(target);
      return sendJson(res, 200, result);
    }

    if (parts[0] === "api" && parts[1] === "hr" && parts[2] === "skills" && parts[3] && req.method === "GET") {
      const result = hr.getSkillMarkdown(decodeURIComponent(parts[3]));
      return sendJson(res, 200, result);
    }

    // ---------- Sales: thu thập Lead thật (tải nguồn + bóc tách + sao lưu) ----------
    if (parts[0] === "api" && parts[1] === "sales") {
      if (parts[2] === "fetch" && req.method === "POST") {
        const payload = await readJsonBody(req);
        return sendJson(res, 200, await sales.fetchSource(payload));
      }
      if (parts[2] === "extract" && req.method === "POST") {
        const payload = await readJsonBody(req);
        return sendJson(res, 200, await sales.extractLeads(payload));
      }
      if (parts[2] === "leads" && req.method === "POST") {
        const payload = await readJsonBody(req);
        return sendJson(res, 200, await sales.saveLeads(payload));
      }
      if (parts[2] === "leads" && req.method === "GET") {
        return sendJson(res, 200, sales.loadLeads());
      }
    }

    if (parts[0] === "api" && parts[1] === "agents" && parts[3] && req.method === "POST") {
      const agentId = decodeURIComponent(parts[2]);
      const action = parts[3]; // "chat" | "knowledge"
      const agentCfg = CONFIG.agents[agentId];
      if (!agentCfg) return sendJson(res, 404, { error: `Không tìm thấy agent "${agentId}" trong agents.config.json` });

      const payload = await readJsonBody(req);

      if (action === "chat") {
        const result = await handleChat(agentId, agentCfg, payload);
        return sendJson(res, 200, result);
      }
      if (action === "knowledge") {
        const result = await handleKnowledge(agentId, agentCfg, payload);
        return sendJson(res, 200, result);
      }
      return sendJson(res, 404, { error: `Không rõ hành động "${action}"` });
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    const status = err.status || 500;
    sendJson(res, status, { error: err.message || "Lỗi không xác định" });
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`AI OS ↔ Hermes proxy đang chạy tại http://localhost:${PROXY_PORT}`);
  console.log(`MOCK_MODE=${MOCK_MODE} — ALLOWED_ORIGINS=${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`Agents cấu hình: ${Object.keys(CONFIG.agents).join(", ")}`);
});
