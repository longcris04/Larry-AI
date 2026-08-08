const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// Nơi lưu tài khoản. Dùng __dirname để chạy được dù gọi node từ thư mục nào.
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE
  ? path.resolve(process.env.ACCOUNTS_FILE)
  : path.join(__dirname, "account.json");

const ROLES = { USER: "user", ADMIN: "admin" };

const EMPTY_PROFILE = {
  fullName: "",  // Tên
  grade: "",     // Học sinh lớp mấy
  school: "",    // Trường học
  className: ""  // Lớp đang học
};

// Ghi ra file tạm rồi đổi tên — nếu server tắt giữa chừng thì account.json cũ
// vẫn nguyên vẹn thay vì bị cắt cụt.
function saveUsers(users) {
  const tempFile = `${ACCOUNTS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), "utf8");
  fs.renameSync(tempFile, ACCOUNTS_FILE);
}

// File hỏng thì giữ lại làm bản sao thay vì ghi đè mất dữ liệu
function quarantineBrokenFile(reason) {
  const backupFile = `${ACCOUNTS_FILE}.broken-${Date.now()}`;
  fs.renameSync(ACCOUNTS_FILE, backupFile);
  console.error(
    `⚠️  ${path.basename(ACCOUNTS_FILE)} không đọc được (${reason}).\n` +
      `    Đã đổi tên thành ${path.basename(backupFile)} và bắt đầu với danh sách rỗng.`
  );
}

function readFromDisk() {
  let raw;
  try {
    raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    return []; // Lần chạy đầu tiên, chưa có file
  }

  if (!raw.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    quarantineBrokenFile("JSON không hợp lệ");
    return [];
  }

  if (!Array.isArray(parsed)) {
    quarantineBrokenFile("nội dung không phải mảng");
    return [];
  }

  return parsed;
}

// Hash bcrypt luôn có dạng $2a$ / $2b$ / $2y$ + chi phí, ví dụ "$2b$10$..."
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_PATTERN.test(value);
}

// Bổ sung field cho các tài khoản tạo từ phiên bản cũ (chưa có role/profile)
function normalizeUsers(users) {
  let changed = false;

  for (const user of users) {
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.USER) {
      user.role = ROLES.USER;
      changed = true;
    }

    if (!user.profile || typeof user.profile !== "object") {
      user.profile = { ...EMPTY_PROFILE };
      changed = true;
    }

    // Cho phép sửa mật khẩu trực tiếp trong account.json bằng chữ thường:
    // lúc khởi động sẽ tự hash lại rồi ghi đè. Nếu không có bước này,
    // bcrypt.compare() so mật khẩu với chuỗi thô sẽ luôn trả về false
    // và đăng nhập báo sai mật khẩu dù gõ đúng.
    if (typeof user.password === "string" && user.password && !isBcryptHash(user.password)) {
      user.password = bcrypt.hashSync(user.password, 10);
      changed = true;
      console.log(
        `🔐 Mật khẩu của "${user.username}" đang để dạng chữ thường trong ${path.basename(
          ACCOUNTS_FILE
        )} — đã tự hash lại.`
      );
    }
  }

  return changed;
}

// Không dùng users.length + 1 vì id sẽ trùng nếu về sau có xoá tài khoản
function nextUserId(users) {
  return users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;
}

// Tài khoản quản trị KHÔNG được tạo tự động và không tạo được từ giao diện web.
// Chỉ developer tạo bằng lệnh: npm run create-admin  (xem create-admin.js)
function addAdmin(users, { username, email, password }) {
  const name = String(username || "").trim();
  const mail = String(email || "").trim();
  const pass = String(password || "");

  if (!name || !mail || !pass) {
    throw new Error("Cần đủ username, email và password.");
  }
  if (pass.length < 8) {
    throw new Error("Mật khẩu quản trị phải có ít nhất 8 ký tự.");
  }
  if (users.some((u) => u.role === ROLES.ADMIN && u.email === mail)) {
    throw new Error(`Đã có tài khoản quản trị dùng email ${mail}.`);
  }
  if (users.some((u) => u.role === ROLES.ADMIN && u.username === name)) {
    throw new Error(`Đã có tài khoản quản trị tên ${name}.`);
  }

  const admin = {
    id: nextUserId(users),
    username: name,
    email: mail,
    password: bcrypt.hashSync(pass, 10),
    role: ROLES.ADMIN,
    profile: { ...EMPTY_PROFILE },
    createdAt: new Date().toISOString()
  };

  users.push(admin);
  return admin;
}

function loadUsers() {
  const users = readFromDisk();

  const normalized = normalizeUsers(users);

  // Ghi lại nếu vừa migrate, hoặc file chưa tồn tại
  if (normalized || !fs.existsSync(ACCOUNTS_FILE)) {
    saveUsers(users);
  }

  return users;
}

// Email có thể trùng giữa tài khoản user và admin, nên phải tra theo cả vai trò
function findUserByEmail(users, email, role) {
  return users.find((user) => user.email === email && user.role === role);
}

module.exports = {
  ACCOUNTS_FILE,
  ROLES,
  EMPTY_PROFILE,
  loadUsers,
  saveUsers,
  nextUserId,
  findUserByEmail,
  addAdmin
};
