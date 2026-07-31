// Gọi OpenRouter (OpenAI-compatible Chat Completions API) — dùng để thực thi B2–B10 của
// skill Tuyển dụng tại local, không qua Hermes. Cần OPENROUTER_API_KEY trong .env.
// https://openrouter.ai/docs

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
const DEFAULT_MAX_TOKENS = 4096;

// { system, messages: [{role,content}], tools: OpenAI function-tool format, plugins: OpenRouter plugins (vd file-parser cho PDF) }
// -> trả nguyên văn choices[0].message (OpenAI Chat Completions shape)
async function callChatModel({ system, messages, tools, plugins }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Thiếu OPENROUTER_API_KEY trong .env — cần key thật để mô hình thực thi B2-B10 tại local."), { status: 500 });
  }

  let resp;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:64667",
        "X-Title": "AI OS - HR Agent (tuyen-dung)",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "system", content: system }, ...messages],
        tools,
        ...(plugins ? { plugins } : {}),
      }),
    });
  } catch (e) {
    throw Object.assign(new Error("Không kết nối được tới openrouter.ai"), { status: 502 });
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
