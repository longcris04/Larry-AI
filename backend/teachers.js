// Ghép giáo viên chủ nhiệm với học sinh của mình.
//
// Không có bảng phân công lớp riêng: cả hai bên đều đã tự khai TRƯỜNG và LỚP lúc
// đăng ký, nên chỗ ghép chính là hai field đó. Giáo viên chủ nhiệm lớp 6A1
// trường THCS Đoàn Thị Điểm thấy được mọi học sinh khai đúng trường đó, lớp đó.
//
// Hệ quả phải chấp nhận: em nào gõ lệch tên lớp thì không ai chủ nhiệm em cả.
// Vì vậy việc so sánh ở đây cố ý DỄ TÍNH — bỏ qua hoa/thường và khoảng trắng
// thừa, để "6a1", "6A1" và " 6A1 " là một lớp. Nhưng KHÔNG đoán xa hơn thế:
// "6A1" với "6/1" là hai chuỗi khác nhau, và tự ý gộp chúng lại thì có ngày một
// giáo viên đọc được hội thoại của lớp không phải lớp mình.

const { ROLES, STATUS } = require("./accounts");

// Chìa khoá so lớp. Rỗng ở bất kỳ vế nào nghĩa là KHÔNG ghép được — trả về "" và
// mọi so sánh phía dưới đều bỏ qua. Thiếu bước này thì tất cả tài khoản chưa
// khai trường/lớp sẽ khớp lẫn với nhau vì cùng là chuỗi rỗng.
function classKey(school, className) {
  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const s = normalize(school);
  const c = normalize(className);
  if (!s || !c) return "";

  return `${s}|${c}`;
}

function keyOfUser(user) {
  return classKey(user?.profile?.school, user?.profile?.className);
}

// Chỉ giáo viên ĐÃ ĐƯỢC DUYỆT mới nhận lớp. Tài khoản còn chờ duyệt mà đã ghép
// được học sinh thì vòng duyệt của quản trị viên thành vô nghĩa.
function isActiveTeacher(user) {
  return user?.role === ROLES.TEACHER && user?.status === STATUS.APPROVED;
}

function isStudent(user) {
  return user?.role === ROLES.USER;
}

/**
 * Giáo viên chủ nhiệm của một học sinh, hoặc null nếu chưa ghép được.
 *
 * Chưa ghép được là chuyện BÌNH THƯỜNG, không phải lỗi: giáo viên lớp đó có thể
 * chưa đăng ký, hoặc học sinh chưa khai lớp. Nơi gọi phải xử lý được null (xem
 * luồng gửi email cảnh báo trong server.js).
 */
function findHomeroomTeacher(users, student) {
  const key = keyOfUser(student);
  if (!key) return null;

  return users.find((u) => isActiveTeacher(u) && keyOfUser(u) === key) || null;
}

/** Danh sách học sinh thuộc lớp của một giáo viên. */
function findStudentsOfTeacher(users, teacher) {
  const key = keyOfUser(teacher);
  if (!key) return [];

  return users.filter((u) => isStudent(u) && keyOfUser(u) === key);
}

/** Mọi phiên thuộc học sinh của đúng lớp giáo viên này. */
function findSessionsOfTeacher(users, sessions, teacher) {
  const studentIds = new Set(findStudentsOfTeacher(users, teacher).map((student) => student.id));
  return sessions.filter((session) => studentIds.has(session.userId));
}

/** Mô tả lớp cho giao diện, ví dụ "6A1 · THCS Đoàn Thị Điểm". */
function describeClass(user) {
  const school = user?.profile?.school || "";
  const className = user?.profile?.className || "";
  if (!school && !className) return "";
  if (!className) return school;
  if (!school) return className;
  return `${className} · ${school}`;
}

module.exports = {
  classKey,
  findHomeroomTeacher,
  findStudentsOfTeacher,
  findSessionsOfTeacher,
  describeClass,
  isActiveTeacher
};
