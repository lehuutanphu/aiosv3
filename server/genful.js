// Sinh ảnh minh hoạ bằng Genful AI (Gommo) — gọi thẳng endpoint MCP qua JSON-RPC 2.0.
//
// VÌ SAO KHÔNG DÙNG MCP CLIENT: tool gommo_* chỉ tồn tại trong phiên Claude Code. Muốn vòng
// lặp Content Cluster của AI OS tự chạy được (kể cả khi không có ai ngồi trước máy) thì proxy
// phải tự gọi được. Endpoint MCP của Gommo nhận JSON-RPC thuần qua HTTP nên Node gọi trực tiếp
// được, không cần thư viện MCP.
//
// TIỀN THẬT: mỗi ảnh tốn credit (Nano Banana 2 ở 1k/vip2 = 400). Module này KHÔNG BAO GIỜ tự
// quyết định sinh bao nhiêu ảnh — số lượng do tầng gọi truyền xuống, và vẫn có trần cứng
// GENFUL_MAX_IMAGES chặn lại phòng khi vòng lặp có lỗi logic đốt credit ngoài ý muốn.

const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG_PATH = process.env.GENFUL_CONFIG ||
  path.join(os.homedir(), ".claude", "skills", "tripx-webpost", "genful.config.json");

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

let cfgCache;
function loadConfig() {
  if (cfgCache !== undefined) return cfgCache;
  if (!fs.existsSync(CONFIG_PATH)) {
    cfgCache = null;
    return null;
  }
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (!c.token || !c.mcpEndpoint || !c.imageDefaults) throw new Error("thiếu token/mcpEndpoint/imageDefaults");
    cfgCache = c;
  } catch (e) {
    console.warn("[genful] Không đọc được cấu hình:", e.message);
    cfgCache = null;
  }
  return cfgCache;
}

function sanSang() {
  return !!loadConfig();
}

/* ---------------------------------------------------------------------------
   JSON-RPC tới MCP endpoint. Kết quả nằm ở result.content[0].text dưới dạng
   chuỗi JSON (envelope chuẩn MCP), có structuredContent làm đường dự phòng.
--------------------------------------------------------------------------- */
let rpcId = 0;

async function rpc(toolName, args, timeoutMs) {
  const cfg = loadConfig();
  if (!cfg) throw err(500, `Chưa cấu hình Genful — không thấy ${CONFIG_PATH}`);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || 60000);
  let resp, raw;
  try {
    resp = await fetch(cfg.mcpEndpoint, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: toolName, arguments: args || {} } }),
    });
    raw = await resp.text();
  } catch (e) {
    if (e && e.name === "AbortError") throw err(504, `Genful không phản hồi sau ${Math.round((timeoutMs || 60000) / 1000)}s (${toolName})`);
    throw err(502, `Không gọi được Genful: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) { throw err(502, `Genful trả về không phải JSON: ${raw.slice(0, 200)}`); }
  if (data.error) throw err(502, `Genful lỗi: ${data.error.message || JSON.stringify(data.error).slice(0, 200)}`);

  const result = data.result || {};
  if (result.isError) throw err(502, `Genful báo lỗi khi gọi ${toolName}: ${JSON.stringify(result.content || "").slice(0, 300)}`);

  const text = result.content && result.content[0] && result.content[0].text;
  if (text) {
    try { return JSON.parse(text); } catch (e) { return { _text: text }; }
  }
  return result.structuredContent || result;
}

async function soDuCredit() {
  const d = await rpc("gommo.credit_balance", {}, 30000);
  return (d.balancesInfo && d.balancesInfo.credits_ai) || 0;
}

/* ---------------------------------------------------------------------------
   Sinh một ảnh.

   TUYỆT ĐỐI không tự bịa ratio/resolution/mode — đây là quy tắc bắt buộc của chính
   MCP server. Mọi giá trị lấy nguyên từ imageDefaults trong genful.config.json (đã
   được người dùng chốt và đối chiếu với gommo.models_list).
--------------------------------------------------------------------------- */
async function taoAnh(prompt) {
  const cfg = loadConfig();
  const d = cfg.imageDefaults;
  const res = await rpc("gommo.image_create", {
    model: d.model,
    prompt,
    ratio: d.ratio,
    resolution: d.resolution,
    mode: d.mode,
    num_outputs: 1,
    privacy: d.privacy || "PRIVATE",
  }, 90000);

  // Poll bằng id_base, KHÔNG dùng task_id nội bộ
  const idBase = (res.imageInfo && res.imageInfo.id_base) || (res.requestInfo && res.requestInfo.id_base) || res.id_base;
  if (!idBase) throw err(502, `Genful không trả id_base: ${JSON.stringify(res).slice(0, 300)}`);
  return idBase;
}

async function choAnhXong(idBase, { tongThoiGianMs = 600000, nhipMs = 10000 } = {}) {
  const hetHan = Date.now() + tongThoiGianMs;
  let lanCuoi = null;
  while (Date.now() < hetHan) {
    const d = await rpc("gommo.image_status", { id_base: idBase }, 30000);
    lanCuoi = d;
    // status SUCCESS là nguồn sự thật; field message đôi khi còn hiển thị "Đang xử lý" (giá trị tồn dư)
    const st = String(d.status || (d.imageInfo && d.imageInfo.status) || "").toUpperCase();
    const url = d.url || (d.imageInfo && d.imageInfo.url) ||
      (Array.isArray(d.images) && d.images[0] && (d.images[0].url || d.images[0].file_url));
    if (st === "SUCCESS" || (url && /^https?:\/\//.test(String(url)))) {
      if (!url) throw err(502, `Ảnh báo SUCCESS nhưng không có url: ${JSON.stringify(d).slice(0, 300)}`);
      return String(url);
    }
    if (st === "FAILED" || st === "ERROR") {
      throw err(502, `Genful sinh ảnh thất bại: ${d.message || JSON.stringify(d).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, nhipMs));
  }
  throw err(504, `Ảnh ${idBase} chưa xong sau ${Math.round(tongThoiGianMs / 60000)} phút. Trạng thái cuối: ${JSON.stringify(lanCuoi || {}).slice(0, 200)}`);
}

async function taiVe(url, outPath) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 120000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) throw err(502, `Tải ảnh lỗi ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buf);
    return { file: outPath, bytes: buf.length };
  } finally {
    clearTimeout(timer);
  }
}

/* Trần cứng cho cả tiến trình — nếu vòng lặp có lỗi logic thì credit vẫn dừng ở đây
   thay vì cháy sạch số dư. */
const MAX_IMAGES = Number(process.env.GENFUL_MAX_IMAGES || 40);
let daSinh = 0;

async function sinhAnh({ prompt, outPath }) {
  if (!sanSang()) throw err(500, "Chưa cấu hình Genful");
  if (!prompt || !String(prompt).trim()) throw err(400, "Thiếu prompt ảnh");
  if (daSinh >= MAX_IMAGES) {
    throw err(429, `Đã chạm trần ${MAX_IMAGES} ảnh cho lần chạy này (GENFUL_MAX_IMAGES) — dừng để không đốt thêm credit.`);
  }
  daSinh++;

  const idBase = await taoAnh(String(prompt).trim());
  const url = await choAnhXong(idBase);
  const duoi = /\.png(\?|$)/i.test(url) ? ".png" : ".jpg";
  const dich = outPath.replace(/\.(jpg|png)$/i, "") + duoi;
  const tai = await taiVe(url, dich);
  const cfg = loadConfig();
  return {
    id_base: idBase,
    url,
    file: tai.file,
    bytes: tai.bytes,
    credit: cfg.imageDefaults.creditPerImage || 0,
  };
}

function trangThai() {
  const cfg = loadConfig();
  return {
    sanSang: !!cfg,
    model: cfg ? cfg.imageDefaults.modelName || cfg.imageDefaults.model : null,
    creditMoiAnh: cfg ? cfg.imageDefaults.creditPerImage : null,
    daSinhTrongPhien: daSinh,
    tranAnh: MAX_IMAGES,
    configPath: fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : null,
  };
}

module.exports = { sanSang, sinhAnh, soDuCredit, trangThai, rpc };
