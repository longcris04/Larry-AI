// Kiểm tra cấu hình gửi email cảnh báo cho giáo viên chủ nhiệm.
//
//   npm run test-email              → chỉ đăng nhập SMTP, KHÔNG gửi gì
//   npm run test-email -- --send    → gửi thật 1 email thử tới ALERT_EMAIL_TO
//   npm run test-email -- --send co@truong.edu.vn   → gửi tới địa chỉ khác
//
// Cố ý không gửi nếu thiếu cờ --send, để chạy kiểm tra bao nhiêu lần cũng được
// mà không làm phiền hộp thư người khác.

require("dotenv").config();

const { EMAIL_USER, ALERT_EMAIL_TO, verifyMailer, sendAlertEmail } = require("./alertEmail");

const args = process.argv.slice(2);
const shouldSend = args.includes("--send");
const to = args.find((a) => a.includes("@")) || ALERT_EMAIL_TO;

function line(label, value) {
  console.log(`${label.padEnd(22)}: ${value}`);
}

async function main() {
  console.log("--- Cấu hình email trong backend/.env ---");
  line("EMAIL_USER", EMAIL_USER || "❌ chưa đặt");
  line(
    "EMAIL_APP_PASSWORD",
    process.env.EMAIL_APP_PASSWORD
      ? `đã đặt (${process.env.EMAIL_APP_PASSWORD.replace(/\s+/g, "").length} ký tự, cần 16)`
      : "❌ chưa đặt"
  );
  line("ALERT_EMAIL_TO", ALERT_EMAIL_TO || "❌ chưa đặt");
  line("SMTP", process.env.EMAIL_HOST || "Gmail (mặc định)");

  console.log("\n--- Đăng nhập SMTP ---");
  const status = await verifyMailer();

  if (!status.ready) {
    console.log("❌ Không đăng nhập được:\n" + status.error);
    console.log(`
Kiểm tra theo thứ tự:
  1. Mở Gmail, bấm avatar góc phải — địa chỉ hiện ra CÓ ĐÚNG là ${EMAIL_USER || "<EMAIL_USER>"} không?
     Tên bạn đăng ký có thể đã bị Google đổi (thêm số) vì bị trùng.
  2. Vào https://myaccount.google.com/apppasswords khi ĐANG đăng nhập chính tài khoản đó.
     App Password tạo ở tài khoản khác thì không dùng cho tài khoản này được.
  3. Xoá App Password cũ, tạo cái mới, COPY (đừng gõ tay) 16 chữ cái vào .env.
  4. Lưu .env rồi chạy lại lệnh này — không cần khởi động lại gì khác.`);
    process.exit(1);
  }

  console.log(`✅ Đăng nhập thành công với ${EMAIL_USER} — App Password hợp lệ.`);

  if (!shouldSend) {
    console.log("\nChưa gửi email nào. Muốn gửi thử một email thật:");
    console.log("  npm run test-email -- --send");
    return;
  }

  console.log(`\n--- Gửi email thử tới ${to} ---`);
  const result = await sendAlertEmail({
    to,
    subject: "[Larry AI] Email thử — kiểm tra cấu hình gửi cảnh báo",
    body: `Đây là email thử của hệ thống Larry AI.

Nếu bạn nhận được email này, phần gửi cảnh báo cho giáo viên chủ nhiệm đã hoạt động.
Email thật sẽ do AI soạn từ bản tóm tắt phiên trò chuyện, và chỉ được gửi sau khi
quản trị viên đọc lại và bấm gửi.

Gửi lúc: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
  });

  console.log(`✅ Đã gửi. messageId = ${result.messageId}`);
  console.log(`Kiểm tra hộp thư ${to} (ngó cả mục Spam ở lần gửi đầu tiên).`);
}

main().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
