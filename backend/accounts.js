const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// Nơi lưu tài khoản. Dùng __dirname để chạy được dù gọi node từ thư mục nào.
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE
  ? path.resolve(process.env.ACCOUNTS_FILE)
  : path.join(__dirname, "account.json");

const ROLES = { USER: "user", ADMIN: "admin", TEACHER: "teacher" };

// Hồ sơ dùng chung cho cả ba vai trò — mỗi bên chỉ điền phần của mình:
//   học sinh          fullName, grade, school, className (lớp đang học)
//   giáo viên chủ nhiệm fullName, dateOfBirth, school, className (lớp chủ nhiệm)
//
// Cùng một shape vì đây chính là thứ dùng để GHÉP hai bên với nhau: giáo viên
// thấy được học sinh nào là dựa trên school + className khớp nhau (xem
// teachers.js). Tách thành hai shape khác nhau thì hai bên rất dễ trôi lệch tên
// field, và lúc đó việc ghép hỏng âm thầm chứ không báo lỗi.
const EMPTY_PROFILE = {
  fullName: "",    // Tên
  grade: "",       // Học sinh lớp mấy (giáo viên bỏ trống)
  school: "",      // Trường học
  className: "",   // Học sinh: lớp đang học. Giáo viên: lớp chủ nhiệm.
  dateOfBirth: ""  // Ngày sinh, dạng yyyy-mm-dd (chủ yếu cho giáo viên)
};

// Trạng thái duyệt. CHỈ tài khoản giáo viên chủ nhiệm mới đi qua vòng duyệt —
// học sinh đăng ký xong dùng được ngay, quản trị viên do developer tạo.
const STATUS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };

// So email không phân biệt hoa/thường và khoảng trắng thừa. "An@a.com" với
// "an@a.com " là CÙNG một hộp thư, nên phải chặn đăng ký trùng, và phải đăng
// nhập được dù gõ khác kiểu.
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sameEmail(a, b) {
  return normalizeEmail(a) === normalizeEmail(b) && normalizeEmail(a) !== "";
}

/**
 * Email này đã có ai dùng chưa — XÉT MỌI VAI TRÒ.
 *
 * Trước đây học sinh và quản trị viên được phép trùng email vì lúc đăng nhập
 * còn có dropdown "Bạn là" tách hai bên ra. Giờ có thêm giáo viên chủ nhiệm thì
 * một email trùng ba vai trò là ba tài khoản khác nhau — quá dễ nhầm, và lúc gửi
 * email cảnh báo thì không biết địa chỉ đó thuộc về ai.
 *
 * @param {number} [exceptId] Bỏ qua chính tài khoản này (dùng khi sửa hồ sơ)
 */
function findUserByAnyRoleEmail(users, email, exceptId = null) {
  return users.find((user) => sameEmail(user.email, email) && user.id !== exceptId);
}

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

const VALID_ROLES = new Set(Object.values(ROLES));

// Bổ sung field cho các tài khoản tạo từ phiên bản cũ (chưa có role/profile)
function normalizeUsers(users) {
  let changed = false;

  for (const user of users) {
    if (!VALID_ROLES.has(user.role)) {
      user.role = ROLES.USER;
      changed = true;
    }

    if (!user.profile || typeof user.profile !== "object") {
      user.profile = { ...EMPTY_PROFILE };
      changed = true;
    }

    // Field thêm sau — hồ sơ cũ nào thiếu thì bù chuỗi rỗng
    for (const key of Object.keys(EMPTY_PROFILE)) {
      if (typeof user.profile[key] !== "string") {
        user.profile[key] = "";
        changed = true;
      }
    }

    // Tài khoản có TỪ TRƯỚC khi có vòng duyệt đều đang dùng được, nên coi như đã
    // duyệt. Đặt "pending" ở đây sẽ khoá tất cả mọi người ra ngoài sau một lần
    // nâng cấp — đúng kiểu lỗi chỉ lộ ra trên máy chủ thật.
    if (!Object.values(STATUS).includes(user.status)) {
      user.status = STATUS.APPROVED;
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
  // Email là duy nhất trên toàn hệ thống, không riêng nhóm quản trị
  const taken = findUserByAnyRoleEmail(users, mail);
  if (taken) {
    throw new Error(`Email ${mail} đã được dùng cho một tài khoản ${taken.role}.`);
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
    status: STATUS.APPROVED,
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

// Tra theo email + vai trò, dùng lúc đăng nhập (dropdown "Bạn là" quyết định
// vai trò). Email giờ là duy nhất trên toàn hệ thống nên thực tế chỉ ra một kết
// quả, nhưng vẫn lọc theo vai trò để tài khoản cũ trùng email — có từ trước khi
// siết quy tắc — đăng nhập đúng chỗ của nó thay vì nhảy sang vai trò khác.
function findUserByEmail(users, email, role) {
  return users.find((user) => sameEmail(user.email, email) && user.role === role);
}

/**
 * Tạo quản trị viên từ biến môi trường, chạy lúc khởi động.
 *
 * Vì sao cần dù đã có `npm run create-admin`: lệnh đó phải gõ trong terminal, mà
 * nền tảng deploy gói miễn phí (Render Free chẳng hạn) KHÔNG cho mở shell. Nặng
 * hơn nữa, ổ đĩa ở đó là tạm — tài khoản tạo bằng tay sẽ mất sau mỗi lần deploy
 * lại. Đọc từ biến môi trường thì mỗi lần khởi động lại tự dựng lại đúng tài
 * khoản đó, không cần ai đụng tay.
 *
 * Chạy KHÔNG làm gì cả khi: không khai biến, hoặc đã có admin đúng email này
 * (giữ nguyên tài khoản đang có, không ghi đè mật khẩu).
 *
 * @returns {object|null} admin vừa tạo, hoặc null nếu không tạo gì
 */
function seedAdminFromEnv(users) {
  const email = String(process.env.ADMIN_EMAIL || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) return null;

  const username = String(process.env.ADMIN_USERNAME || "").trim() || "admin";

  if (users.some((u) => u.role === ROLES.ADMIN && u.email === email)) return null;

  const admin = addAdmin(users, { username, email, password });
  saveUsers(users);
  return admin;
}

module.exports = {
  ACCOUNTS_FILE,
  ROLES,
  STATUS,
  EMPTY_PROFILE,
  loadUsers,
  saveUsers,
  nextUserId,
  normalizeEmail,
  sameEmail,
  findUserByEmail,
  findUserByAnyRoleEmail,
  addAdmin,
  seedAdminFromEnv
};
