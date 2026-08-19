// Dùng khi không gọi được backend (server tắt, mất mạng). Nội dung giữ giống
// hệt SYSTEM_DOWN_MESSAGE ở backend/fallback.js để học sinh thấy một thông báo
// nhất quán dù lỗi xảy ra ở tầng nào.

export const SUPPORT_EMAIL = "lanmc2k13@gmail.com";

export const SYSTEM_DOWN_MESSAGE =
  "Hệ thống AI hiện tại không hoạt động 😔\n" +
  "Bạn vui lòng tải lại ứng dụng và thử lại sau nhé.\n" +
  `Hoặc gửi email về cho chúng tôi ở ${SUPPORT_EMAIL} ` +
  "để phản hồi về tình trạng bạn gặp phải.";

// Chạm hạn mức lượt hỏi (20 lượt / 10 phút cho mỗi tài khoản — xem
// backend/rateLimit.js). Bình thường máy chủ gửi kèm câu có ghi rõ còn bao nhiêu
// phút; dòng dưới đây chỉ dùng khi vì lý do gì đó không đọc được câu đó, nên nó
// cố ý không nhắc tới con số nào.
export const RATE_LIMIT_MESSAGE =
  "Bạn hãy thử lại sau ít phút nhé! " +
  "Larry cần nghỉ ngơi một chút rồi mình cùng tiếp tục nói chuyện nhé!";

// --- Quên mật khẩu ----------------------------------------------------------
//
// Chưa có luồng tự đặt lại mật khẩu: học sinh đăng ký bằng SỐ ĐIỆN THOẠI và
// phần lớn để trống ô email, nên gửi link đặt lại qua email là gửi vào chỗ
// không có ai. Cách duy nhất hiện nay là nhắn cho người quản trị, nên nút "Quên
// mật khẩu?" nói thẳng ra điều đó thay vì mở một biểu mẫu không dẫn tới đâu.
//
// KHÁC với SUPPORT_EMAIL bên trên: đó là hòm thư nhận phản hồi khi hệ thống lỗi,
// còn đây là hòm thư của người cấp lại được mật khẩu. Hai việc khác nhau nên hai
// địa chỉ để riêng, đổi cái này không kéo theo cái kia.
export const PASSWORD_RESET_EMAIL = "larryai.bluemoon@gmail.com";

export const PASSWORD_RESET_HINT =
  `hãy gửi email liên hệ tới ${PASSWORD_RESET_EMAIL} để được cấp lại mật khẩu!`;
