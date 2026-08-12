// Gọi OpenRouter (OpenAI-compatible Chat Completions API) — dùng để thực thi B2–B10 của
// skill Tuyển dụng tại local, không qua Hermes. Cần OPENROUTER_API_KEY trong .env.
// https://openrouter.ai/docs

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
const DEFAULT_MAX_TOKENS = 4096;

// { system, messages: [{role,content}], tools: OpenAI function-tool format, plugins: OpenRouter plugins (vd file-parser cho PDF),
//   model: override model cho riêng lượt gọi này (vd đọc CV bằng model có vision thay vì DEFAULT_MODEL) }
// -> trả nguyên văn choices[0].message (OpenAI Chat Completions shape)
// maxTokens: nới trần output cho lượt gọi này. 4096 đủ cho các bước HR, nhưng KHÔNG đủ
// cho Content Cluster — blueprint SEO và bài viết 1.200–2.500 từ đều vượt, và khi vượt thì
// phản hồi bị cắt giữa chừng (JSON hỏng, bài viết cụt) mà không có lỗi nào báo ra.
async function callChatModel({ system, messages, tools, plugins, model, maxTokens }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Thiếu OPENROUTER_API_KEY trong .env — cần key thật để mô hình thực thi B2-B10 tại local."), { status: 500 });
  }

  // Không có timeout thì một lượt bị treo ở phía nhà cung cấp sẽ chặn cả vòng lặp Content
  // Cluster vô hạn, không báo lỗi, không chạy tiếp — phải để nó thất bại rõ ràng.
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 180000);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  // Đồng hồ phải bao trọn CẢ phần đọc body: OpenRouter trả header gần như tức thì rồi mới
  // stream dần nội dung, nên nếu tắt đồng hồ ngay sau khi fetch resolve thì một lượt sinh
  // chậm/đứng ở giữa body vẫn treo vô hạn — đúng chỗ hay hỏng nhất ở tier free.
  let resp, data;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:64667",
        "X-Title": "AI OS - HR Agent (tuyen-dung)",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
        messages: [{ role: "system", content: system }, ...messages],
        tools,
        ...(plugins ? { plugins } : {}),
      }),
    });
    // KHÔNG dùng .catch(() => ({})) ở đây: nó nuốt luôn AbortError khi timeout bắn giữa lúc
    // đọc body, khiến lỗi hiện ra thành "sai định dạng Chat Completions" — sai bản chất và
    // rất khó lần ra. Chỉ nuốt lỗi phân tích JSON thật sự.
    const rawBody = await resp.text();
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      data = { __parseError: rawBody.slice(0, 300) };
    }
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw Object.assign(
        new Error(`Model "${model || DEFAULT_MODEL}" không phản hồi xong sau ${Math.round(timeoutMs / 1000)}s — nhiều khả năng đang xếp hàng ở tier free. Đổi sang model trả phí hoặc nâng OPENROUTER_TIMEOUT_MS.`),
        { status: 504 }
      );
    }
    throw Object.assign(new Error("Không kết nối được tới openrouter.ai"), { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const msg = data?.error?.message || `OpenRouter API lỗi ${resp.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const choice = data?.choices?.[0];
  if (!choice?.message) {
    const chiTiet = data?.__parseError ? ` Thân phản hồi: ${data.__parseError}` : "";
    throw Object.assign(new Error(`Phản hồi OpenRouter không đúng định dạng Chat Completions.${chiTiet}`), { status: 502 });
  }
  return choice.message; // { role, content, tool_calls? }
}

/* ---------------------------------------------------------------------------
   Sinh ảnh — POST /api/v1/images, khác hẳn Chat Completions ở trên.

   Xác nhận bằng lượt gọi API thật (không suy đoán từ tài liệu, vì tài liệu công khai
   của OpenRouter mâu thuẫn nhau giữa "dùng chat completions + modalities" và "dùng
   endpoint /images riêng"): endpoint /api/v1/images hoạt động, trả về
   { created, data: [{ b64_json, media_type }], usage: { cost, ... } }.
   Tham số "size" là tham số THẬT (không phải gợi ý trong prompt) — đã đo cost thật:
   1024x576 (khớp mức "1k"/16:9 mà marketing team đang dùng ở Genful) = $0.04/ảnh,
   đúng giá quảng cáo; không truyền size thì model tự chọn độ phân giải cao hơn và
   tính phí cao hơn ($0.075 đo được ở 2752x1536).
--------------------------------------------------------------------------- */
const DEFAULT_IMAGE_TIMEOUT_MS = 120000;

async function createImage({ prompt, model, size }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Thiếu OPENROUTER_API_KEY trong .env"), { status: 500 });
  }
  if (!prompt || !String(prompt).trim()) {
    throw Object.assign(new Error("Thiếu prompt ảnh"), { status: 400 });
  }

  const timeoutMs = Number(process.env.OPENROUTER_IMAGE_TIMEOUT_MS || DEFAULT_IMAGE_TIMEOUT_MS);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let resp, data;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:64667",
        "X-Title": "AI OS - Agent Image",
      },
      body: JSON.stringify({ model, prompt: String(prompt).trim(), ...(size ? { size } : {}) }),
    });
    const raw = await resp.text();
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = { __parseError: raw.slice(0, 300) };
    }
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw Object.assign(new Error(`Model "${model}" không sinh ảnh xong sau ${Math.round(timeoutMs / 1000)}s`), { status: 504 });
    }
    throw Object.assign(new Error("Không kết nối được tới openrouter.ai"), { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const msg = data?.error?.message || `OpenRouter API lỗi ${resp.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const item = data?.data?.[0];
  if (!item?.b64_json) {
    const chiTiet = data?.__parseError ? ` Thân phản hồi: ${data.__parseError}` : "";
    throw Object.assign(new Error(`OpenRouter không trả về ảnh.${chiTiet}`), { status: 502 });
  }
  return {
    b64: item.b64_json,
    mediaType: item.media_type || "image/png",
    cost: (data.usage && typeof data.usage.cost === "number") ? data.usage.cost : null,
  };
}

module.exports = { callChatModel, createImage, DEFAULT_MODEL };
