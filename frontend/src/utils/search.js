// Tìm kiếm tiếng Việt — gõ không dấu vẫn ra kết quả.
//
// Ô tìm kiếm ở trang quản trị dò trên tên người, tên trường và tên lớp — toàn
// những thứ có dấu. Nếu so khớp thẳng chuỗi thì gõ "doan thi diem" không ra
// "Đoàn Thị Điểm", và người dùng sẽ kết luận là trường đó chưa có trong hệ thống.
// Với một bảng vài trăm dòng thì đó là một kết luận sai rất tốn thời gian.
//
// Cách làm: hạ chữ thường, tách dấu ra khỏi chữ cái (NFD) rồi bỏ phần dấu đi.
// Riêng "đ/Đ" phải xử lý tay — nó là một CHỮ CÁI RIÊNG trong bảng chữ cái tiếng
// Việt chứ không phải "d" có dấu, nên NFD không tách được nó.

/**
 * Bỏ dấu, hạ chữ thường, gộp khoảng trắng thừa.
 * @param {string} text
 * @returns {string}
 */
export function normalizeVi(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bản ghi có khớp với câu truy vấn không?
 *
 * Mỗi TỪ trong câu truy vấn phải xuất hiện ở đâu đó trong các trường được dò,
 * không cần đúng thứ tự và không cần cùng một trường. Nhờ vậy "6a1 diem" tìm ra
 * em lớp 6A1 trường Đoàn Thị Điểm — cách người ta thật sự gõ khi đang nhớ mang
 * máng vài mẩu thông tin, thay vì phải nhớ chính xác một chuỗi liền mạch.
 *
 * @param {string} query
 * @param {Array<string|number|null|undefined>} fields
 */
export function matchesQuery(query, fields) {
  const words = normalizeVi(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;

  const haystack = fields.map((f) => normalizeVi(f)).join(" | ");
  return words.every((word) => haystack.includes(word));
}
