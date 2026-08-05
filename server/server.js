// AI OS ↔ Hermes Agent Backend Proxy
// Giữ API key (Hermes API Server + Mem0) an toàn phía server, không lộ ra frontend.
// Xem HERMES_INTEGRATION.md ở thư mục cha để hiểu kiến trúc tổng thể.

const http = require("http");
const fs = require("fs");
const path = require("path");
const hr = require("./hr");

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error("Request body quá lớn (>2MB)"));
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

    if (parts[0] === "api" && parts[1] === "hr" && parts[2] === "skills" && parts[3] && req.method === "GET") {
      const result = hr.getSkillMarkdown(decodeURIComponent(parts[3]));
      return sendJson(res, 200, result);
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
