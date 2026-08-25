// Bốn vai trò của hệ thống. Chuỗi phải khớp TỪNG KÝ TỰ với ROLES trong
// backend/accounts.js — chúng đi thẳng vào body của /api/register và /api/login.
export const ROLES = {
  STUDENT: "user",
  TEACHER: "teacher",
  COUNSELOR: "counselor",
  ADMIN: "admin"
};

// Trạng thái duyệt, khớp với STATUS trong backend/accounts.js.
// Giáo viên chủ nhiệm và phòng tâm lý học đường đi qua vòng duyệt.
export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Học sinh",
  [ROLES.TEACHER]: "Giáo viên chủ nhiệm",
  [ROLES.COUNSELOR]: "Phòng tâm lý học đường",
  [ROLES.ADMIN]: "Quản trị viên"
};

export const STATUS_LABELS = {
  [STATUS.PENDING]: "Chờ duyệt",
  [STATUS.APPROVED]: "Đã duyệt",
  [STATUS.REJECTED]: "Đã từ chối"
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "—";
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

// Mỗi vai trò về đúng khu vực của mình sau khi đăng nhập. Học sinh mới là người
// vào khung chat; ba vai trò còn lại vào khu quản lý của họ.
//
// Là "/chat" chứ không phải "/": địa chỉ gốc luôn mở trang giới thiệu, nên trả
// về "/" ở đây thì vừa đăng nhập xong đã bị đá ngược ra trang giới thiệu.
export function homePathForRole(role) {
  if (role === ROLES.ADMIN) return "/admin";
  if (role === ROLES.TEACHER) return "/teacher";
  if (role === ROLES.COUNSELOR) return "/counselor";
  return "/chat";
}
