// Cầu nối duy nhất giữa hệ agent và OpenRouter.
//
// OpenRouter tương thích API của OpenAI nên dùng thẳng ChatOpenAI, chỉ đổi
// baseURL. Mọi agent đều đi qua đây để chỗ nào cũng có cùng timeout, cùng header
// và cùng cách chọn model.

const { ChatOpenAI } = require("@langchain/openai");

const { chatModel } = require("../models");

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

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
 * @param {string}   [opts.model]        Tên model OpenRouter; bỏ trống thì lấy
 *                                       CHAT_MODEL trong .env (xem models.js)
 * @param {number}   [opts.temperature]  0.1 cho việc phân loại, 0.6 cho trò chuyện
 * @param {string[]} [opts.tags]         Nhãn để lọc sự kiện lúc stream — luôn
 *                                       truyền id của agent vào đây, nếu không
 *                                       thì token stream về không biết của ai.
 */
function makeLLM({ model, temperature = 0.6, tags = [] } = {}) {
  const resolved = model || chatModel();

  // Không có tên model thì DỪNG ở đây với lời báo rõ ràng. Đoán bừa một tên model
  // trong code chính là thứ vừa được gỡ bỏ: nó khiến .env cấu hình sai vẫn chạy
  // êm bằng một model không ai chọn.
  if (!resolved) {
    throw new Error(
      "Chưa cấu hình tên model. Đặt CHAT_MODEL (và nếu muốn, model riêng cho từng " +
        "agent: SUPERVISOR_MODEL, AGENT_SELF_HARM_MODEL, AGENT_VICTIM_MODEL, " +
        "AGENT_ACTOR_MODEL, AGENT_HOMEROOM_MODEL) trong backend/.env."
    );
  }

  return new ChatOpenAI({
    model: resolved,
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

module.exports = { makeLLM, hasApiKey, OPENROUTER_BASE_URL };
