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

// Ngược lại: quản trị viên là tài khoản quản lý, không tham gia trò chuyện với
// Larry. Chặn ở đây để dù có gọi thẳng API cũng không tạo được phiên hội thoại.
const blockAdmin = (req, res, next) => {
  if (req.user?.role === ROLES.ADMIN) {
    return res.status(403).json({
      error: "Tài khoản quản trị viên không sử dụng tính năng trò chuyện."
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
  blockAdmin
};
