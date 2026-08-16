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

// --- Hai model giọng nói --------------------------------------------------
//
// KHÔNG có chuỗi dự phòng về CHAT_MODEL như các model trên. Model chat nhận chữ
// và trả về chữ; model giọng nói nhận tiếng nói hoặc trả về tiếng nói. Rơi về
// CHAT_MODEL nghĩa là gửi tệp âm thanh cho một model không nghe được — lỗi khó
// hiểu ở tận trong lời gọi API, thay vì một câu báo "chưa cấu hình" đọc ra hiểu
// ngay. Thiếu thì trả "" và nút micro tự ẩn đi.

// Nghe tiếng nói của học sinh, trả về chữ
function sttModel() {
  return resolve("STT_MODEL");
}

// Đọc câu trả lời của Larry thành tiếng
function ttsModel() {
  return resolve("TTS_MODEL");
}

/**
 * Hai tác vụ nền còn thiếu model.
 *
 * "Thiếu" nghĩa là KHÔNG GIẢI RA ĐƯỢC tên model nào, chứ không phải "biến đó
 * trống". Khai riêng đủ cho từng thành phần thì bỏ trống CHAT_MODEL vẫn hợp lệ —
 * đó chính là cách .env.example khuyến khích, và cũng là cách đang chạy trên
 * Render. Kiểm tra riêng mỗi CHAT_MODEL là từ chối nhầm một cấu hình đúng.
 */
function missingBackgroundModels() {
  const missing = [];
  if (!summaryModel()) missing.push("SUMMARY_MODEL");
  if (!alertModel()) missing.push("ALERT_MODEL");
  return missing;
}

// Bảng model đang dùng, cho log lúc khởi động và cho /api/health
function describeModels() {
  return {
    chat: chatModel(),
    summary: summaryModel(),
    alert: alertModel(),
    stt: sttModel(),
    tts: ttsModel()
  };
}

module.exports = {
  chatModel,
  agentModel,
  summaryModel,
  alertModel,
  sttModel,
  ttsModel,
  missingBackgroundModels,
  describeModels
};
