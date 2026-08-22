// Phạm vi chỉ đọc của phòng tâm lý học đường: mọi tài khoản thuộc đúng trường
// đã đăng ký. So sánh bỏ qua hoa/thường và khoảng trắng thừa, nhưng không đoán
// hai tên trường khác nhau là cùng một nơi.

const { ROLES } = require("./accounts");

function schoolKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findUsersOfCounselorSchool(users, counselor) {
  const key = schoolKey(counselor?.profile?.school);
  if (!key) return [];

  return users.filter(
    (user) => user.role !== ROLES.ADMIN && schoolKey(user.profile?.school) === key
  );
}

function findStudentsOfCounselorSchool(users, counselor) {
  return findUsersOfCounselorSchool(users, counselor).filter(
    (user) => user.role === ROLES.USER
  );
}

function findSessionsOfCounselorSchool(users, sessions, counselor) {
  const studentIds = new Set(
    findStudentsOfCounselorSchool(users, counselor).map((student) => student.id)
  );
  return sessions.filter((session) => studentIds.has(session.userId));
}

module.exports = {
  schoolKey,
  findUsersOfCounselorSchool,
  findStudentsOfCounselorSchool,
  findSessionsOfCounselorSchool
};
