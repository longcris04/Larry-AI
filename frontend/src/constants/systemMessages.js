// Dùng khi không gọi được backend (server tắt, mất mạng). Nội dung giữ giống
// hệt SYSTEM_DOWN_MESSAGE ở backend/fallback.js để học sinh thấy một thông báo
// nhất quán dù lỗi xảy ra ở tầng nào.

export const SUPPORT_EMAIL = "lanmc2k13@gmail.com";

export const SYSTEM_DOWN_MESSAGE =
  "Hệ thống AI hiện tại không hoạt động 😔\n" +
  "Bạn vui lòng tải lại ứng dụng và thử lại sau nhé.\n" +
  `Hoặc gửi email về cho chúng tôi ở ${SUPPORT_EMAIL} ` +
  "để phản hồi về tình trạng bạn gặp phải.";
