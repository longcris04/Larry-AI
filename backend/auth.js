// Xác thực JWT — tách khỏi server.js để cả routes/chat.js dùng được mà không
// phải import ngược vào server.js (sẽ thành vòng lặp).

const jwt = require("jsonwebtoken");
const { ROLES } = require("./accounts");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const GUEST_EXPIRES_IN = "1d";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearerToken || req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Chỉ cho quản trị viên đi qua. Dùng kèm authenticateToken:
//   app.get("/api/admin/...", authenticateToken, requireAdmin, handler)
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: "Chỉ quản trị viên mới truy cập được." });
  }
  next();
};

// Chỉ giáo viên chủ nhiệm ĐÃ ĐƯỢC DUYỆT. Trạng thái duyệt nằm trong token lúc
// đăng nhập, nhưng token sống 7 ngày — quản trị viên gỡ duyệt hôm nay mà token
// cũ vẫn dùng được tới tuần sau thì vòng duyệt không có tác dụng. Vì vậy route
// nào dùng middleware này cũng phải kiểm tra lại status trong account.json;
// getUserById được truyền vào chính là để làm việc đó.
const requireTeacher = (getUserById) => (req, res, next) => {
  if (req.user?.role !== ROLES.TEACHER) {
    return res.status(403).json({ error: "Chỉ giáo viên chủ nhiệm mới truy cập được." });
  }

  const account = typeof getUserById === "function" ? getUserById(req.user.id) : null;
  if (!account || account.role !== ROLES.TEACHER) {
    return res.status(403).json({ error: "Không tìm thấy tài khoản giáo viên." });
  }
  if (account.status !== "approved") {
    return res.status(403).json({
      error: "Tài khoản của bạn chưa được quản trị viên duyệt."
    });
  }

  req.teacher = account;
  next();
};

// Ngược lại: quản trị viên là tài khoản quản lý, không tham gia trò chuyện với
// Larry. Giáo viên chủ nhiệm cũng vậy — họ vào đây để xem tình hình lớp, không
// phải để tâm sự với Larry. Chặn ở đây để dù có gọi thẳng API cũng không tạo
// được phiên hội thoại đứng tên họ.
const blockAdmin = (req, res, next) => {
  if (req.user?.role === ROLES.ADMIN) {
    return res.status(403).json({
      error: "Tài khoản quản trị viên không sử dụng tính năng trò chuyện."
    });
  }
  if (req.user?.role === ROLES.TEACHER) {
    return res.status(403).json({
      error: "Tài khoản giáo viên chủ nhiệm không sử dụng tính năng trò chuyện."
    });
  }
  next();
};

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  GUEST_EXPIRES_IN,
  authenticateToken,
  requireAdmin,
  requireTeacher,
  blockAdmin
};
