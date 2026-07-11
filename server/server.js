// AI OS ↔ Hermes Agent Backend Proxy
// Giữ API key (Hermes API Server + Mem0) an toàn phía server, không lộ ra frontend.
// Xem HERMES_INTEGRATION.md ở thư mục cha để hiểu kiến trúc tổng thể.

const http = require("http");
const fs = require("fs");
const path = require("path");

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
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:64667";
const MOCK_MODE = String(process.env.MOCK_MODE || "true").toLowerCase() === "true";

function hermesKeyEnvName(agentId) {
  return "HERMES_KEY_" + agentId.toUpperCase().replace(/-/g, "_");
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
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
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
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
  console.log(`MOCK_MODE=${MOCK_MODE} — ALLOWED_ORIGIN=${ALLOWED_ORIGIN}`);
  console.log(`Agents cấu hình: ${Object.keys(CONFIG.agents).join(", ")}`);
});
