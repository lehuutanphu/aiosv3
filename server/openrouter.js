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

  let resp;
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
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === "AbortError") {
      throw Object.assign(
        new Error(`Model "${model || DEFAULT_MODEL}" không phản hồi sau ${Math.round(timeoutMs / 1000)}s — nhiều khả năng đang xếp hàng ở tier free. Đổi sang model trả phí hoặc nâng OPENROUTER_TIMEOUT_MS.`),
        { status: 504 }
      );
    }
    throw Object.assign(new Error("Không kết nối được tới openrouter.ai"), { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || `OpenRouter API lỗi ${resp.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  const choice = data?.choices?.[0];
  if (!choice?.message) {
    throw Object.assign(new Error("Phản hồi OpenRouter không đúng định dạng Chat Completions"), { status: 502 });
  }
  return choice.message; // { role, content, tool_calls? }
}

module.exports = { callChatModel, DEFAULT_MODEL };
