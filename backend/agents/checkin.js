// Làm sạch phiếu cảm xúc trước khi cho vào prompt.
//
// Chuyển nguyên vẹn từ server.js của bản một-agent — logic này đã được cân nhắc
// kỹ và không có lý do gì để viết lại khi lên multi-agent.
//
// Mục tiêu: cắt bỏ phần RA LỆNH cho model và phần ĐÒI nội dung người lớn,
// trước khi ghép vào system prompt.
//
// Nguyên tắc quan trọng: nội dung học sinh TỐ GIÁC việc mình bị hại thì KHÔNG
// được lọc, dù nó chứa từ nhạy cảm. Xoá đi đồng nghĩa với vứt bỏ lời cầu cứu
// và Larry sẽ vô tư chúc mừng em "đang vui". Vì vậy luôn kiểm tra dấu hiệu
// nguy hiểm TRƯỚC, và mặc định là GIỮ LẠI khi không chắc.

const MAX_CHECKIN_ITEMS = 8;
const MAX_CHECKIN_ITEM_LENGTH = 60;
const MAX_CHECKIN_DETAIL_LENGTH = 500;

// Dấu hiệu em đang kể chuyện bị hại — gặp là giữ nguyên, không lọc
const DISCLOSURE_HINTS = [
  "sờ", "chạm", "đụng", "xâm hại", "hiếp", "cưỡng",
  "bắt em", "bắt con", "ép em", "ép con", "dụ", "rủ em", "rủ con",
  "giữ bí mật", "bí mật của hai", "cho em tiền", "cho con tiền",
  "gửi ảnh", "chụp ảnh", "cho em xem", "cho con xem",
  "đánh em", "đánh con", "bạo hành", "bị bắt nạt", "bị trêu",
  "không muốn sống", "muốn chết", "tự tử", "tự làm đau", "làm hại bản thân"
];

// Câu ra lệnh nhằm đổi vai / vô hiệu hoá quy tắc
const INJECTION_HINTS = [
  "bỏ qua hướng dẫn", "bỏ qua chỉ dẫn", "bỏ qua quy tắc", "quên hướng dẫn",
  "không cần tuân thủ", "không bị giới hạn", "bỏ giới hạn", "gỡ giới hạn",
  "bạn giờ là", "bây giờ bạn là", "từ giờ bạn là", "đóng vai", "nhập vai",
  "giả vờ là", "giả sử bạn là", "system prompt", "prompt hệ thống",
  "ignore previous", "ignore all", "you are now", "act as", "jailbreak",
  "developer mode", "chế độ nhà phát triển"
];

// Đòi nội dung không phù hợp lứa tuổi (khác với kể chuyện bị hại)
const ADULT_REQUEST_HINTS = [
  "viết truyện sex", "viết truyện người lớn", "kể chuyện sex",
  "phim sex", "phim người lớn", "phim khiêu dâm", "web sex", "ảnh sex",
  "dạy em quan hệ", "cách quan hệ", "cách làm tình", "làm tình",
  "cách mua ma tuý", "cách mua ma túy", "cách hút cần", "cách cá độ",
  "cách chơi cờ bạc", "cách tự tử", "cách chết"
];

function containsAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// true = nội dung nên bị lọc bỏ khỏi phiếu
function shouldFilterOut(text) {
  if (!text) return false;
  // Ưu tiên tuyệt đối: em đang kể chuyện bị hại thì giữ lại
  if (containsAny(text, DISCLOSURE_HINTS)) return false;
  return containsAny(text, INJECTION_HINTS) || containsAny(text, ADULT_REQUEST_HINTS);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " ").slice(0, MAX_CHECKIN_ITEM_LENGTH))
    .filter(Boolean)
    .filter((item) => !shouldFilterOut(item))
    .slice(0, MAX_CHECKIN_ITEMS);
}

// Học sinh tự nhập được nên phải cắt gọn trước khi đưa vào prompt
function sanitizeCheckin(input) {
  if (!input || typeof input !== "object") return null;

  const level = Number.isInteger(input.level) ? input.level : null;

  const rawDetail =
    typeof input.detail === "string"
      ? input.detail.trim().slice(0, MAX_CHECKIN_DETAIL_LENGTH)
      : "";

  // Phần kể thêm bị lọc thì bỏ hẳn, các phần còn lại của phiếu vẫn dùng bình thường
  const detailFiltered = shouldFilterOut(rawDetail);
  if (detailFiltered) {
    console.warn("Đã lọc bỏ nội dung không phù hợp trong phiếu cảm xúc.");
  }

  const checkin = {
    scope: input.scope === "today" ? "today" : input.scope === "now" ? "now" : null,
    level: level !== null && level >= 0 && level <= 4 ? level : null,
    emotions: cleanList(input.emotions),
    reasons: cleanList(input.reasons),
    detail: detailFiltered ? "" : rawDetail,
    detailFiltered
  };

  // Không có thông tin nào đáng kể thì coi như học sinh bỏ qua
  const hasContent =
    checkin.level !== null ||
    checkin.emotions.length > 0 ||
    checkin.reasons.length > 0 ||
    checkin.detail;

  return hasContent ? checkin : null;
}

// Phiếu có đủ thông tin để supervisor khỏi phải hỏi lại từ đầu hay không.
// "Điền thiếu" (chỉ kéo thanh trượt, không chọn cảm xúc, không kể gì) vẫn tính
// là chưa đủ — supervisor sẽ trò chuyện tiếp cho tới khi đủ.
function isCheckinSubstantial(checkin) {
  if (!checkin) return false;
  return checkin.emotions.length > 0 && (checkin.reasons.length > 0 || Boolean(checkin.detail));
}

module.exports = { sanitizeCheckin, shouldFilterOut, isCheckinSubstantial };
