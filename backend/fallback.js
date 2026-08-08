// Khi không gọi được LLM, Larry KHÔNG tự bịa câu trả lời bằng cách dò từ khoá
// nữa — làm vậy dễ trả lời sai ngữ cảnh và nguy hiểm với người dùng là học sinh.
// Thay vào đó báo thẳng là hệ thống đang không hoạt động.

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "lanmc2k13@gmail.com";

const SYSTEM_DOWN_MESSAGE =
  "Hệ thống AI hiện tại không hoạt động 😔\n" +
  "Bạn vui lòng tải lại ứng dụng và thử lại sau nhé.\n" +
  `Hoặc gửi email về cho chúng tôi ở ${SUPPORT_EMAIL} ` +
  "để phản hồi về tình trạng bạn gặp phải.";

module.exports = { SYSTEM_DOWN_MESSAGE, SUPPORT_EMAIL };
