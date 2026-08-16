// Ba vai trò của hệ thống. Chuỗi phải khớp TỪNG KÝ TỰ với ROLES trong
// backend/accounts.js — chúng đi thẳng vào body của /api/register và /api/login.
export const ROLES = {
  STUDENT: "user",
  TEACHER: "teacher",
  ADMIN: "admin"
};

// Trạng thái duyệt, khớp với STATUS trong backend/accounts.js.
// Chỉ tài khoản giáo viên chủ nhiệm mới đi qua vòng duyệt.
export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Học sinh",
  [ROLES.TEACHER]: "Giáo viên chủ nhiệm",
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
