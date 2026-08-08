// Cầu nối duy nhất giữa hệ agent và OpenRouter.
//
// OpenRouter tương thích API của OpenAI nên dùng thẳng ChatOpenAI, chỉ đổi
// baseURL. Mọi agent đều đi qua đây để chỗ nào cũng có cùng timeout, cùng header
// và cùng cách chọn model.

const { ChatOpenAI } = require("@langchain/openai");

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

// OPENROUTER_MODEL là tên cũ của CHAT_MODEL, giữ lại để .env cũ vẫn chạy
const DEFAULT_MODEL =
  process.env.CHAT_MODEL || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";

const REQUEST_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS) || 30000;

// OpenRouter dùng 2 header này để thống kê app trên bảng xếp hạng của họ
const SITE_URL = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
const SITE_NAME = process.env.OPENROUTER_SITE_NAME || "Larry AI";

function hasApiKey() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Tạo một LLM client.
 *
 * @param {string}   [opts.model]        Tên model OpenRouter, mặc định CHAT_MODEL
 * @param {number}   [opts.temperature]  0.1 cho việc phân loại, 0.6 cho trò chuyện
 * @param {string[]} [opts.tags]         Nhãn để lọc sự kiện lúc stream — luôn
 *                                       truyền id của agent vào đây, nếu không
 *                                       thì token stream về không biết của ai.
 */
function makeLLM({ model, temperature = 0.6, tags = [] } = {}) {
  return new ChatOpenAI({
    model: model || DEFAULT_MODEL,
    temperature,
    apiKey: process.env.OPENROUTER_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    // maxRetries của SDK đã lo phần 429/5xx tạm thời, không cần tự viết vòng lặp
    maxRetries: 2,
    tags,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME
      }
    }
  });
}

module.exports = { makeLLM, hasApiKey, DEFAULT_MODEL, OPENROUTER_BASE_URL };
