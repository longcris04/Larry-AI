// Nơi DUY NHẤT trong backend biết tên model là gì.
//
// Luật: KHÔNG viết tên model vào mã nguồn, ở bất kỳ đâu. Tất cả đọc từ
// backend/.env — đổi model là sửa biến môi trường rồi khởi động lại, không phải
// sửa code và deploy lại.
//
// Trước đây mỗi chỗ tự đặt một giá trị mặc định ("google/gemini-2.5-flash-lite"
// trong agents/llm.js, "google/gemini-2.5-flash" trong summarizer.js và
// alertEmail.js). Hệ quả: đổi model trong .env mà quên một biến thì phần đó vẫn
// im lặng chạy bằng model cũ ghi trong code, không có dấu hiệu gì báo ra.
//
// Đọc LƯỜI (đọc process.env lúc gọi, không phải lúc nạp module): dotenv được nạp
// ở đầu server.js và dev-run.js, nên chốt giá trị ngay lúc require sẽ phụ thuộc
// vào thứ tự require — thứ rất dễ vỡ khi thêm file mới.

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

// Chuỗi dự phòng: biến đầu tiên có giá trị thì thắng. Hết chuỗi mà vẫn rỗng thì
// trả "" — KHÔNG bịa ra một tên model nào.
function resolve(...envNames) {
  for (const name of envNames) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

// OPENROUTER_MODEL là tên cũ của CHAT_MODEL, giữ lại để .env cũ vẫn chạy
const CHAT_CHAIN = ["CHAT_MODEL", "OPENROUTER_MODEL"];

// Model nền: agent nào không khai riêng thì dùng cái này
function chatModel() {
  return resolve(...CHAT_CHAIN);
}

// Model của một agent, theo tên biến khai trong agents/registry.js
function agentModel(envName) {
  return envName ? resolve(envName, ...CHAT_CHAIN) : chatModel();
}

// Tóm tắt hội thoại + chấm mức độ nguy cơ cho quản trị viên
function summaryModel() {
  return resolve("SUMMARY_MODEL", ...CHAT_CHAIN);
}

// Soạn email cảnh báo gửi giáo viên chủ nhiệm
function alertModel() {
  return resolve("ALERT_MODEL", "SUMMARY_MODEL", ...CHAT_CHAIN);
}

/**
 * Biến bắt buộc còn thiếu.
 *
 * Chỉ cần CHAT_MODEL là mọi thứ chạy được, vì tất cả các chuỗi dự phòng đều kết
 * thúc ở đó. Thiếu nó thì không gọi được model nào — và hệ thống phải BÁO LỖI
 * chứ không được bịa câu trả lời cho học sinh (xem fallback.js).
 */
function missingModelConfig() {
  return chatModel() ? [] : ["CHAT_MODEL"];
}

// Bảng model đang dùng, cho log lúc khởi động và cho /api/health
function describeModels() {
  return {
    chat: chatModel(),
    summary: summaryModel(),
    alert: alertModel()
  };
}

module.exports = {
  chatModel,
  agentModel,
  summaryModel,
  alertModel,
  missingModelConfig,
  describeModels
};
