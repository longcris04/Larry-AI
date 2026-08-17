// Số điện thoại là DANH TÍNH của tài khoản (xem backend/accounts.js).
//
// Hai hàm dưới đây phải khớp với normalizePhone/isValidPhone ở backend. Chép lại
// thay vì gọi API chỉ để kiểm tra một ô nhập: người dùng thấy lỗi ngay tại chỗ
// đang gõ, thay vì sau một vòng gọi mạng. Máy chủ vẫn kiểm tra lại — đây chỉ là
// lớp cho êm tay, không phải hàng rào.

export function normalizePhone(value) {
  let digits = String(value || "").replace(/[^\d+]/g, "");

  // Dạng quốc tế: +84… hoặc 0084… → đưa hết về 0…
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;

  return digits;
}

// 0 + 9 chữ số (di động), nới tới 11 số cho vài số cố định dạng cũ
const PHONE_PATTERN = /^0\d{9,10}$/;

export function isValidPhone(value) {
  return PHONE_PATTERN.test(normalizePhone(value));
}

export const PHONE_HINT =
  "Số điện thoại không hợp lệ. Hãy nhập số Việt Nam gồm 10 chữ số, ví dụ 0912345678.";
