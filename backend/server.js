require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { SESSIONS_FILE } = require("./sessions");
const { summaryModel } = require("./summarizer");
const { RISK_ORDER, riskCategoryLabels } = require("./risk");
const {
  alertModel,
  EMAIL_USER,
  ALERT_EMAIL_TO,
  isMailerConfigured,
  isValidEmail,
  draftAlertEmail,
  sendAlertEmail,
  verifyMailer
} = require("./alertEmail");
const {
  ACCOUNTS_FILE,
  ROLES,
  STATUS,
  EMPTY_PROFILE,
  loadUsers,
  saveUsers,
  nextUserId,
  findUserByEmail,
  findUserByAnyRoleEmail,
  seedAdminFromEnv
} = require("./accounts");
const {
  classKey,
  findHomeroomTeacher,
  findStudentsOfTeacher,
  describeClass
} = require("./teachers");
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  GUEST_EXPIRES_IN,
  authenticateToken,
  requireAdmin,
  requireTeacher
} = require("./auth");
const {
  SETTINGS_FILE,
  getPublicSettings,
  isGuestModeEnabled,
  setGuestMode
} = require("./settings");
const { sessions, persistSessions } = require("./sessionStore");
const { createChatRouter } = require("./routes/chat");
const { createVoiceRouter } = require("./routes/voice");
const { hasApiKey } = require("./agents/llm");
const { chatModel, sttModel, ttsModel, missingBackgroundModels } = require("./models");
const { voiceStatus } = require("./voice");
const {
  AGENTS,
  SUPERVISOR,
  agentById,
  modelForAgent,
  modelTable,
  missingAgentModels
} = require("./agents/registry");
const { MAX_PROBE_TURNS } = require("./agents/routing");
const { toPublicGraph } = require("./knowledge/publicView");

const app = express();
const PORT = process.env.PORT || 5000;

// Tài khoản được nạp từ account.json lúc khởi động và ghi lại mỗi lần đăng ký
// (đủ dùng cho demo — production nên thay bằng database)
const users = loadUsers();

// Dựng lại quản trị viên từ ADMIN_EMAIL/ADMIN_PASSWORD nếu có. Cần cho nơi deploy
// không mở được shell và có ổ đĩa tạm — xem seedAdminFromEnv trong accounts.js.
// Khai sai (mật khẩu ngắn, trùng tên) thì CẢNH BÁO rồi chạy tiếp: thiếu trang quản
// trị vẫn hơn là cả dịch vụ không khởi động được.
try {
  const seeded = seedAdminFromEnv(users);
  if (seeded) {
    console.log(`✅ Đã tạo quản trị viên từ biến môi trường: ${seeded.username} <${seeded.email}>`);
  }
} catch (err) {
  console.warn(`⚠️  Không tạo được quản trị viên từ ADMIN_*: ${err.message}`);
}

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(cookieParser());

// Chỉ giữ lại các field hồ sơ đã biết, cắt bớt chuỗi quá dài
function sanitizeProfile(input = {}) {
  const profile = { ...EMPTY_PROFILE };

  for (const key of Object.keys(EMPTY_PROFILE)) {
    const value = input[key];
    if (typeof value === "string") {
      profile[key] = value.trim().slice(0, 120);
    }
  }

  return profile;
}

// Không bao giờ trả password ra ngoài
function toPublicUser(user) {
  const { password: _, ...publicUser } = user;
  return publicUser;
}

// Hệ agent cần hồ sơ học sinh để xưng hô và hiểu bối cảnh lớp học
app.use(createChatRouter({ getUserById: (id) => users.find((u) => u.id === id) }));

// Micro và loa: đổi qua lại giữa tiếng nói và chữ. Lượt chat vẫn đi qua router
// bên trên — xem routes/voice.js.
app.use(createVoiceRouter());

// Register endpoint — một cửa cho CẢ HAI loại tài khoản.
//
// `role` do nút chọn ở đầu form quyết định: "user" (học sinh) hoặc "teacher"
// (giáo viên chủ nhiệm). Không nhận "admin" ở đây — quyền quản trị chỉ cấp được
// bằng lệnh create-admin chạy trên máy chủ.
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password, profile, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    const isTeacher = role === ROLES.TEACHER;
    const newRole = isTeacher ? ROLES.TEACHER : ROLES.USER;

    // Email là DUY NHẤT trên toàn hệ thống, xét cả ba vai trò. Trước đây học sinh
    // và quản trị viên được phép trùng email vì dropdown "Bạn là" tách hai bên
    // ra; thêm vai trò thứ ba thì một email hoá ra ba tài khoản, và lúc gửi cảnh
    // báo không biết địa chỉ đó là của ai.
    const taken = findUserByAnyRoleEmail(users, email);
    if (taken) {
      return res.status(400).json({ error: "Email này đã được dùng cho một tài khoản khác." });
    }

    // Tên tài khoản vẫn chỉ cần khác nhau trong cùng vai trò — trùng tên không
    // gây nhầm lẫn ở đâu cả vì mọi thứ đều tra theo email.
    if (users.some((u) => u.role === newRole && u.username === username)) {
      return res.status(400).json({ error: "Tên tài khoản này đã có người dùng." });
    }

    const cleanProfile = sanitizeProfile(profile);

    // Giáo viên PHẢI khai trường và lớp chủ nhiệm: thiếu là không ghép được với
    // học sinh nào, tài khoản duyệt xong cũng không thấy gì. Chặn ngay từ đây
    // dễ hiểu hơn nhiều so với một trang trống rỗng sau khi được duyệt.
    if (isTeacher) {
      if (!cleanProfile.school || !cleanProfile.className) {
        return res.status(400).json({
          error: "Giáo viên chủ nhiệm cần khai đủ trường và lớp chủ nhiệm."
        });
      }

      // Một lớp chỉ có một giáo viên chủ nhiệm
      const existingHomeroom = users.find(
        (u) =>
          u.role === ROLES.TEACHER &&
          u.status !== STATUS.REJECTED &&
          classKey(u.profile?.school, u.profile?.className) ===
            classKey(cleanProfile.school, cleanProfile.className)
      );
      if (existingHomeroom) {
        return res.status(400).json({
          error: `Lớp ${cleanProfile.className} (${cleanProfile.school}) đã có tài khoản giáo viên chủ nhiệm.`
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = {
      id: nextUserId(users),
      username,
      email: String(email).trim(),
      password: hashedPassword,
      role: newRole,
      // Học sinh dùng được ngay; giáo viên phải chờ quản trị viên duyệt vì tài
      // khoản đó đọc được hội thoại của cả lớp.
      status: isTeacher ? STATUS.PENDING : STATUS.APPROVED,
      profile: cleanProfile,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Ghi xuống file để không mất tài khoản khi khởi động lại backend
    try {
      saveUsers(users);
    } catch (writeError) {
      users.pop();
      console.error("Không ghi được file tài khoản:", writeError.message);
      return res.status(500).json({ error: "Không lưu được tài khoản. Vui lòng thử lại." });
    }

    if (isTeacher) {
      console.log(
        `🧑‍🏫 Giáo viên chủ nhiệm mới chờ duyệt: ${newUser.username} <${newUser.email}> — ${describeClass(newUser)}`
      );
    }

    // KHÔNG cấp token/cookie ở đây: đăng ký xong quay lại màn hình đăng nhập để
    // tự đăng nhập, chứ không vào thẳng giao diện bên trong.
    res.status(201).json({
      user: toPublicUser(newUser),
      pendingApproval: isTeacher,
      message: isTeacher
        ? "Đã gửi yêu cầu tạo tài khoản giáo viên chủ nhiệm. Quản trị viên sẽ duyệt trước khi bạn đăng nhập được."
        : "Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu."
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Vai trò do người dùng chọn ở dropdown "Bạn là", mặc định là học sinh
    const requestedRole =
      role === ROLES.ADMIN ? ROLES.ADMIN : role === ROLES.TEACHER ? ROLES.TEACHER : ROLES.USER;

    // Tra theo email + vai trò. Email đã là duy nhất toàn hệ thống, nhưng vẫn lọc
    // theo vai trò để tài khoản trùng email có từ trước vào đúng chỗ của nó.
    const user = findUserByEmail(users, email, requestedRole);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Kiểm tra duyệt SAU khi đã xác minh mật khẩu: báo "chưa được duyệt" trước
    // khi biết mật khẩu có đúng không thì vô tình xác nhận cho người lạ rằng
    // email đó có tồn tại trong hệ thống.
    if (user.status === STATUS.PENDING) {
      return res.status(403).json({
        error:
          "Tài khoản giáo viên chủ nhiệm của bạn đang chờ quản trị viên duyệt. " +
          "Vui lòng đăng nhập lại sau khi được duyệt."
      });
    }
    if (user.status === STATUS.REJECTED) {
      return res.status(403).json({
        error: "Yêu cầu tạo tài khoản của bạn đã bị từ chối. Liên hệ quản trị viên để biết thêm."
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ user: toPublicUser(user), token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cài đặt CÔNG KHAI — trang đăng nhập gọi khi chưa có ai đăng nhập, nên không
// đặt sau authenticateToken. Chỉ trả những gì người lạ được biết (xem
// getPublicSettings trong settings.js).
app.get("/api/settings", (req, res) => {
  res.json(getPublicSettings());
});

// Guest endpoint — vào chat ngay, không cần tài khoản.
// Vẫn phát JWT để /chat giữ nguyên cơ chế bảo vệ, chỉ khác là không ghi vào account.json.
app.post("/api/guest", (req, res) => {
  // Chặn Ở ĐÂY mới là chặn thật. Giao diện có giấu nút đi thì cũng chỉ là giấu —
  // ai biết địa chỉ API vẫn gọi thẳng vào đây tạo được phiên khách. Quản trị viên
  // tắt chế độ khách là để KHÔNG CÒN hội thoại nào không gắn với một tài khoản,
  // nên cửa phải khoá ở máy chủ.
  if (!isGuestModeEnabled()) {
    return res.status(403).json({
      error: "Chế độ khách đang tắt. Hãy đăng nhập hoặc đăng ký tài khoản để trò chuyện với Larry."
    });
  }

  const guestUser = {
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: "Bạn nhỏ",
    role: ROLES.USER,
    guest: true
  };

  const token = jwt.sign(guestUser, JWT_SECRET, { expiresIn: GUEST_EXPIRES_IN });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000 // 1 ngày
  });

  res.json({ user: guestUser, token });
});

// Logout endpoint
app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });
  res.json({ message: "Logged out successfully" });
});

// Get current user (protected route)
app.get("/api/me", authenticateToken, (req, res) => {
  // Khách không có trong account.json — trả thẳng thông tin từ token
  if (req.user.guest) {
    return res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: ROLES.USER,
        guest: true
      }
    });
  }

  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user: toPublicUser(user) });
});

// ---------------------------------------------------------------------------
// KHU VỰC QUẢN TRỊ VIÊN — mọi route đều cần authenticateToken + requireAdmin
// ---------------------------------------------------------------------------

const adminOnly = [authenticateToken, requireAdmin];

// Bật/tắt chế độ khách.
//
// Không có route GET tương ứng ở đây vì trạng thái này KHÔNG bí mật — trang quản
// trị đọc chung /api/settings với trang đăng nhập. Thêm một route đọc riêng chỉ
// tạo ra hai nguồn sự thật cho cùng một giá trị.
app.patch("/api/admin/settings/guest-mode", adminOnly, (req, res) => {
  const { enabled } = req.body || {};

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "Cần trường 'enabled' là true hoặc false." });
  }

  try {
    const settings = setGuestMode(enabled);
    console.log(
      `⚙️  ${req.user.username} ${enabled ? "BẬT" : "TẮT"} chế độ khách (trò chuyện không cần đăng nhập).`
    );
    res.json({ guestMode: settings.guestMode });
  } catch (err) {
    console.error("Không lưu được cài đặt:", err);
    res.status(500).json({ error: "Không lưu được cài đặt. Xem log máy chủ." });
  }
});

// Danh sách tài khoản, kèm thống kê nhanh về các phiên hội thoại
app.get("/api/admin/users", adminOnly, (req, res) => {
  const list = users.map((user) => {
    const userSessions = sessions.filter((s) => s.userId === user.id);

    // Giáo viên không trò chuyện nên mọi con số phiên đều bằng 0. Thứ quản trị
    // viên cần biết ở dòng đó là lớp họ chủ nhiệm và đã ghép được bao nhiêu em.
    const teacherInfo =
      user.role === ROLES.TEACHER
        ? {
            classLabel: describeClass(user),
            studentCount: findStudentsOfTeacher(users, user).length
          }
        : null;

    return {
      ...toPublicUser(user),
      teacherInfo,
      sessionCount: userSessions.length,
      // Mọi phiên có dấu hiệu tiêu cực, không riêng bắt nạt
      flaggedCount: userSessions.filter((s) => s.flagged).length,
      highRiskCount: userSessions.filter((s) => s.riskLevel === "high").length,
      lastSessionAt: userSessions.reduce(
        (latest, s) => (s.endedAt > latest ? s.endedAt : latest),
        ""
      )
    };
  });

  res.json({ users: list });
});

// --- Duyệt tài khoản giáo viên chủ nhiệm --------------------------------------
//
// Tài khoản này đọc được tóm tắt hội thoại của cả một lớp, nên không thể để ai
// tự khai là giáo viên rồi vào xem ngay. Học sinh thì KHÔNG qua bước này.

app.post("/api/admin/users/:id/approval", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  if (user.role !== ROLES.TEACHER) {
    return res.status(400).json({
      error: "Chỉ tài khoản giáo viên chủ nhiệm mới cần duyệt."
    });
  }

  const { status } = req.body || {};
  if (status !== STATUS.APPROVED && status !== STATUS.REJECTED) {
    return res.status(400).json({ error: 'status phải là "approved" hoặc "rejected".' });
  }

  // Duyệt cho một lớp đã có giáo viên chủ nhiệm khác thì hai người cùng đọc được
  // một lớp. Chặn ở đây vì lúc đăng ký lớp đó có thể còn trống.
  if (status === STATUS.APPROVED) {
    const key = classKey(user.profile?.school, user.profile?.className);
    const clash = users.find(
      (u) =>
        u.id !== user.id &&
        u.role === ROLES.TEACHER &&
        u.status === STATUS.APPROVED &&
        classKey(u.profile?.school, u.profile?.className) === key
    );
    if (clash) {
      return res.status(400).json({
        error: `Lớp này đã có giáo viên chủ nhiệm được duyệt: ${clash.username} <${clash.email}>.`
      });
    }
  }

  user.status = status;
  user.approvedAt = new Date().toISOString();
  user.approvedBy = req.user.username || req.user.email || `admin#${req.user.id}`;
  saveUsers(users);

  console.log(
    `${status === STATUS.APPROVED ? "✅ Đã duyệt" : "⛔ Đã từ chối"} giáo viên ` +
      `${user.username} <${user.email}> (bởi ${user.approvedBy}).`
  );

  res.json({ user: toPublicUser(user) });
});

// Sửa thông tin tài khoản
app.patch("/api/admin/users/:id", adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });

    const { username, email, password, role, profile } = req.body;

    // Vai trò KHÔNG sửa được qua web. Cấp quyền admin chỉ làm được bằng lệnh
    // `npm run create-admin` phía developer.
    if (role !== undefined && role !== user.role) {
      return res.status(403).json({
        error: "Không đổi được vai trò từ giao diện. Dùng lệnh create-admin ở phía máy chủ."
      });
    }

    if (typeof username === "string" && username.trim()) user.username = username.trim();

    if (typeof email === "string" && email.trim()) {
      // Sửa tay cũng phải giữ email duy nhất, nếu không quy tắc ở /api/register
      // chỉ là hàng rào phía trước một cánh cửa vẫn mở
      const taken = findUserByAnyRoleEmail(users, email, user.id);
      if (taken) {
        return res.status(400).json({ error: "Email này đã được dùng cho một tài khoản khác." });
      }
      user.email = email.trim();
    }

    if (profile && typeof profile === "object") {
      user.profile = { ...user.profile, ...sanitizeProfile(profile) };
    }

    if (typeof password === "string" && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    saveUsers(users);
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Admin update error:", error);
    res.status(500).json({ error: "Không cập nhật được tài khoản." });
  }
});

// Xoá tài khoản, kèm toàn bộ phiên hội thoại của tài khoản đó
app.delete("/api/admin/users/:id", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  if (id === req.user.id) {
    return res.status(400).json({ error: "Không thể tự xoá tài khoản đang đăng nhập." });
  }

  const remainingAdmins = users.filter((u) => u.role === ROLES.ADMIN && u.id !== id);
  if (users[index].role === ROLES.ADMIN && remainingAdmins.length === 0) {
    return res.status(400).json({ error: "Đây là quản trị viên cuối cùng, không thể xoá." });
  }

  users.splice(index, 1);
  saveUsers(users);

  // Xoá luôn dữ liệu hội thoại để không giữ lại thông tin của người đã bị xoá
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].userId === id) sessions.splice(i, 1);
  }
  persistSessions();

  res.json({ message: "Đã xoá tài khoản." });
});

// Các phiên hội thoại của một tài khoản, mới nhất lên đầu
app.get("/api/admin/users/:id/sessions", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  // Quản trị viên không trò chuyện nên không có hội thoại để xem
  if (user.role === ROLES.ADMIN) {
    return res.status(400).json({
      error: "Tài khoản quản trị viên không có hội thoại."
    });
  }

  const list = sessions
    .filter((s) => s.userId === id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  res.json({ user: toPublicUser(user), sessions: list });
});

// Tất cả phiên có dấu hiệu tiêu cực — màn hình cảnh báo nhanh cho giáo viên.
// Nguy hiểm nhất lên trước, cùng mức thì mới nhất lên trước.
app.get("/api/admin/flagged", adminOnly, (req, res) => {
  const list = sessions
    .filter((s) => s.flagged)
    .sort(
      (a, b) =>
        (RISK_ORDER[b.riskLevel] || 0) - (RISK_ORDER[a.riskLevel] || 0) ||
        b.endedAt.localeCompare(a.endedAt)
    );

  res.json({ sessions: list });
});

// --- Cảnh báo cho giáo viên chủ nhiệm ----------------------------------------
//
// Hai bước tách rời: soạn (draft) rồi mới gửi (send). Quản trị viên luôn được
// đọc và sửa nội dung do AI viết trước khi email thật sự đi ra ngoài.

function findSessionForAlert(sessionId) {
  const id = String(sessionId || "").trim();
  const session = sessions.find((s) => s.id === id);
  if (!session) return { error: "Không tìm thấy phiên hội thoại." };

  const student = users.find((u) => u.id === session.userId);
  if (!student) return { error: "Không tìm thấy học sinh của phiên này." };

  return { session, student };
}

// Trạng thái cấu hình email, để giao diện biết có gửi được hay không
app.get("/api/admin/alert/config", adminOnly, async (req, res) => {
  const status = await verifyMailer();
  res.json({
    ready: status.ready,
    error: status.error,
    from: EMAIL_USER,
    defaultTo: ALERT_EMAIL_TO,
    model: alertModel()
  });
});

// Nhờ AI soạn nháp email dựa trên bản tóm tắt phiên — CHƯA gửi gì cả
app.post("/api/admin/sessions/:sessionId/alert/draft", adminOnly, async (req, res) => {
  const { session, student, error } = findSessionForAlert(req.params.sessionId);
  if (error) return res.status(404).json({ error });

  if (!session.summary && !session.checkinNote) {
    return res.status(400).json({
      error: "Phiên này chưa có tóm tắt lẫn phiếu cảm xúc, chưa đủ dữ liệu để soạn email."
    });
  }

  try {
    const draft = await draftAlertEmail({
      session,
      student,
      categoryLabels: riskCategoryLabels(session.categories || [])
    });

    // Giáo viên chủ nhiệm của chính em này, ghép theo trường + lớp. Trả về đây
    // để quản trị viên THẤY TRƯỚC ai sẽ nhận email, thay vì phát hiện sau khi
    // đã bấm gửi. Chưa ghép được (giáo viên lớp đó chưa đăng ký, hoặc em chưa
    // khai lớp) thì là null và email chỉ đi tới ALERT_EMAIL_TO.
    const teacher = findHomeroomTeacher(users, student);

    res.json({
      ...draft,
      to: ALERT_EMAIL_TO,
      from: EMAIL_USER,
      homeroomTeacher: teacher
        ? {
            username: teacher.username,
            email: teacher.email,
            classLabel: describeClass(teacher)
          }
        : null,
      studentClass: describeClass(student),
      mailerReady: isMailerConfigured(),
      // Nhắc lại lần gửi trước để quản trị viên không gửi trùng
      alerts: session.alerts || []
    });
  } catch (err) {
    console.error("Soạn email cảnh báo thất bại:", err.message);
    res.status(502).json({ error: `Không soạn được email: ${err.message.slice(0, 200)}` });
  }
});

// Gửi đúng nội dung quản trị viên đã xác nhận
app.post("/api/admin/sessions/:sessionId/alert/send", adminOnly, async (req, res) => {
  const { session, student, error } = findSessionForAlert(req.params.sessionId);
  if (error) return res.status(404).json({ error });

  const { to, subject, body } = req.body;

  if (!isValidEmail(to)) {
    return res.status(400).json({ error: "Địa chỉ email người nhận không hợp lệ." });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return res.status(400).json({ error: "Thiếu tiêu đề email." });
  }
  if (typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "Thiếu nội dung email." });
  }

  // Người nhận = địa chỉ quản trị viên điền (mặc định ALERT_EMAIL_TO) CỘNG THÊM
  // giáo viên chủ nhiệm của chính em này, nếu ghép được. Tính lại ở server chứ
  // không tin danh sách client gửi lên: đây là dữ liệu nhạy cảm về một học sinh,
  // người nhận phải do máy chủ quyết định.
  //
  // Ghép không ra thì gửi đúng một địa chỉ như trước — KHÔNG chặn việc gửi. Lớp
  // chưa có giáo viên đăng ký là chuyện thường, và cảnh báo vẫn phải tới được
  // bộ phận tư vấn.
  const teacher = findHomeroomTeacher(users, student);
  const recipients = [to.trim(), ...(teacher?.email ? [teacher.email] : [])];

  try {
    const result = await sendAlertEmail({
      to: recipients,
      subject,
      body: body.slice(0, 8000)
    });

    const record = {
      sentAt: new Date().toISOString(),
      // Giữ `to` là chuỗi như cũ để giao diện và bản ghi cũ vẫn đọc được
      to: result.recipients.join(", "),
      recipients: result.recipients,
      homeroomTeacherEmail: teacher?.email || "",
      subject: subject.trim().slice(0, 200),
      sentBy: req.user.username || req.user.email || `admin#${req.user.id}`
    };
    session.alerts = [...(session.alerts || []), record].slice(-10);
    persistSessions();

    console.log(
      `✉️  Đã gửi cảnh báo phiên ${session.id} tới ${record.to} (bởi ${record.sentBy})` +
        `${teacher ? ` — có GVCN ${teacher.username}` : " — chưa ghép được GVCN"}.`
    );

    res.json({
      sent: true,
      alert: record,
      messageId: result.messageId,
      homeroomTeacher: teacher
        ? { username: teacher.username, email: teacher.email }
        : null
    });
  } catch (err) {
    console.error("Gửi email cảnh báo thất bại:", err.message);
    res.status(502).json({ error: `Không gửi được email: ${err.message.slice(0, 200)}` });
  }
});

// ---------------------------------------------------------------------------
// KHU VỰC GIÁO VIÊN CHỦ NHIỆM — CHỈ ĐỌC
//
// Giáo viên thấy học sinh lớp mình, trường mình (ghép theo profile — xem
// teachers.js) và đọc được tóm tắt từng phiên hội thoại kèm tình trạng email
// cảnh báo. KHÔNG có route sửa hay xoá nào trong khu vực này: đó là quyền của
// quản trị viên, và việc thiếu hẳn route là cách bảo đảm chắc chắn hơn mọi kiểm
// tra quyền viết trong thân hàm.
//
// Nội dung trả về chỉ là BẢN TÓM TẮT do model viết — sessions.json không lưu
// nguyên văn lời học sinh, nên không có đường nào để giáo viên đọc lại hội thoại gốc.
// ---------------------------------------------------------------------------

const teacherOnly = [authenticateToken, requireTeacher((id) => users.find((u) => u.id === id))];

// Tóm tắt tình hình lớp: danh sách học sinh kèm số phiên và số phiên đáng lo
app.get("/api/teacher/students", teacherOnly, (req, res) => {
  const teacher = req.teacher;
  const students = findStudentsOfTeacher(users, teacher);

  const list = students.map((student) => {
    const studentSessions = sessions.filter((s) => s.userId === student.id);
    return {
      id: student.id,
      username: student.username,
      email: student.email,
      profile: student.profile,
      sessionCount: studentSessions.length,
      flaggedCount: studentSessions.filter((s) => s.flagged).length,
      highRiskCount: studentSessions.filter((s) => s.riskLevel === "high").length,
      // Đã có email cảnh báo nào gửi đi cho em này chưa
      alertCount: studentSessions.reduce((sum, s) => sum + (s.alerts?.length || 0), 0),
      lastSessionAt: studentSessions.reduce(
        (latest, s) => (s.endedAt > latest ? s.endedAt : latest),
        ""
      )
    };
  });

  // Em cần chú ý nhất lên đầu: nhiều phiên khẩn cấp trước, rồi tới phiên có dấu
  // hiệu, cuối cùng mới tới thứ tự thời gian.
  list.sort(
    (a, b) =>
      b.highRiskCount - a.highRiskCount ||
      b.flaggedCount - a.flaggedCount ||
      b.lastSessionAt.localeCompare(a.lastSessionAt)
  );

  res.json({
    teacher: {
      username: teacher.username,
      email: teacher.email,
      profile: teacher.profile,
      classLabel: describeClass(teacher)
    },
    students: list
  });
});

// Các phiên của MỘT học sinh trong lớp mình
app.get("/api/teacher/students/:id/sessions", teacherOnly, (req, res) => {
  const id = Number(req.params.id);
  const student = users.find((u) => u.id === id);
  if (!student) return res.status(404).json({ error: "Không tìm thấy học sinh." });

  // Chốt chặn thật sự: giáo viên chỉ đọc được học sinh CÙNG lớp cùng trường.
  // Không có bước này thì đổi số trong URL là đọc được hội thoại của cả trường.
  const mine = findStudentsOfTeacher(users, req.teacher).some((s) => s.id === id);
  if (!mine) {
    return res.status(403).json({ error: "Học sinh này không thuộc lớp bạn chủ nhiệm." });
  }

  const list = sessions
    .filter((s) => s.userId === id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  res.json({
    student: {
      id: student.id,
      username: student.username,
      email: student.email,
      profile: student.profile
    },
    sessions: list
  });
});

// Mọi phiên đáng lo của cả lớp, gộp lại một chỗ — màn hình cần nhìn trước nhất
app.get("/api/teacher/flagged", teacherOnly, (req, res) => {
  const students = findStudentsOfTeacher(users, req.teacher);
  const byId = new Map(students.map((s) => [s.id, s]));

  const list = sessions
    .filter((s) => s.flagged && byId.has(s.userId))
    .map((s) => ({
      ...s,
      studentName: byId.get(s.userId)?.profile?.fullName || byId.get(s.userId)?.username || ""
    }))
    .sort(
      (a, b) =>
        (RISK_ORDER[b.riskLevel] || 0) - (RISK_ORDER[a.riskLevel] || 0) ||
        b.endedAt.localeCompare(a.endedAt)
    );

  res.json({ sessions: list });
});

// --- Kho tri thức, bản công khai ----------------------------------------------
//
// Cho trang giới thiệu vẽ đồ thị kho tri thức mà Larry truy vấn. KHÔNG cần đăng
// nhập: đây là tài liệu tham khảo chuyên môn về tâm lý học đường, không chứa một
// dòng nào của học sinh. Hội thoại của các em nằm ở sessions.json, và không có
// đường nào từ đây tới đó.
app.get("/api/knowledge/graph", (req, res) => {
  try {
    // Graph nạp một lần rồi cache trong tiến trình (xem knowledge/index.js), nên
    // gọi nhiều lần không đọc lại đĩa. Cho trình duyệt giữ 1 giờ vì đây là dữ
    // liệu tĩnh, chỉ đổi khi ai đó sửa file trong graph/.
    res.set("Cache-Control", "public, max-age=3600");
    res.json(toPublicGraph());
  } catch (err) {
    // Graph sai cấu trúc thì buildGraph() ném lỗi kèm danh sách chỗ sai
    console.error("Không dựng được knowledge graph:", err.message);
    res.status(500).json({ error: "Không đọc được kho tri thức." });
  }
});

// --- Link khảo sát ý kiến ------------------------------------------------------
//
// Hai đường link nằm trong backend/.env chứ không phải trong mã nguồn frontend,
// nên đổi form là sửa biến môi trường rồi khởi động lại, không phải build lại
// giao diện. Không cần đăng nhập: đây là địa chỉ công khai của hai biểu mẫu.
app.get("/api/feedback-links", (req, res) => {
  res.json({
    student: String(process.env.STUDENT_FEEDBACK_FORM || "").trim(),
    teacher: String(process.env.TEACHER_FEEDBACK_FORM || "").trim()
  });
});

// --- Link tài liệu hướng dẫn sử dụng ------------------------------------------
//
// Hiện thành một nút ở mục "Dùng Larry như thế nào?" của trang giới thiệu. Để
// trống thì nút không hiện ra — trang vẫn nguyên vẹn, chỉ thiếu đường tới tài liệu.
//
// Tách riêng khỏi /api/feedback-links dù cùng kiểu "link khai trong .env": hai
// thứ này phục vụ hai trang khác nhau (đây là trang giới thiệu, kia là cột trái
// khung chat), và trang giới thiệu đi hỏi một đường tên "feedback-links" để lấy
// tài liệu hướng dẫn thì người đọc code sau sẽ khựng lại.
app.get("/api/guide", (req, res) => {
  res.json({ url: String(process.env.USER_GUIDE_URL || "").trim() });
});

// Health check — tiện để kiểm tra server đã chạy và đã nạp API key hay chưa
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "openrouter",
    apiKey: hasApiKey() ? "loaded" : "missing",
    architecture: "multi-agent (langgraph)",
    // Model của từng thành phần, khai riêng trong backend/.env (xem models.js).
    // Biến nào còn thiếu thì hiện ở missingModelConfig thay vì im lặng chạy bằng
    // một tên model ghi cứng trong mã nguồn.
    chatModel: chatModel(),
    supervisorModel: modelForAgent(SUPERVISOR.id),
    agentModels: Object.fromEntries(AGENTS.map((a) => [a.id, modelForAgent(a.id)])),
    summaryModel: summaryModel(),
    alertModel: alertModel(),
    // Giọng nói là tính năng THÊM: thiếu hai model này thì khung chat gõ chữ vẫn
    // chạy đủ, nên chúng KHÔNG nằm trong missingModelConfig bên dưới.
    sttModel: sttModel(),
    ttsModel: ttsModel(),
    voice: voiceStatus(),
    // Rỗng = mọi thành phần đều giải ra được model. CHAT_MODEL trống KHÔNG phải
    // lỗi nếu từng thành phần đã khai riêng.
    missingModelConfig: [...missingAgentModels(), ...missingBackgroundModels()],
    // Tên cũ, giữ cho công cụ/script cũ còn đọc được
    model: chatModel(),
    routing: {
      // Mỗi lượt supervisor chỉ gọi ĐÚNG MỘT agent — nhóm ưu tiên cao nhất thắng
      agentsPerTurn: 1,
      maxProbeTurns: MAX_PROBE_TURNS
    },
    accounts: users.length,
    sessions: sessions.length
  });
});

// Danh sách agent để frontend hiển thị đúng tên/icon/màu mà không phải chép cứng
app.get("/api/agents", (req, res) => {
  const strip = ({ envModel, ...rest }) => rest;
  res.json({
    supervisor: strip(SUPERVISOR),
    agents: AGENTS.map(strip)
  });
});

// --- Điều khoản & Chính sách bảo mật -----------------------------------------
//
// Nội dung để ở file .txt trong backend/documents/ để sửa được mà không phải
// build lại frontend. Danh sách trắng cố định — KHÔNG ghép tên file từ URL,
// tránh đọc lung tung ra ngoài thư mục này.

const DOCUMENTS_DIR = path.join(__dirname, "documents");

const DOCUMENTS = {
  "dieu-khoan": { file: "dieukhoan.txt", title: "Điều khoản sử dụng" },
  "chinh-sach-bao-mat": { file: "chinhsachbaomat.txt", title: "Chính sách bảo mật" }
};

app.get("/api/documents/:slug", (req, res) => {
  const doc = DOCUMENTS[req.params.slug];
  if (!doc) return res.status(404).json({ error: "Không có văn bản này." });

  fs.readFile(path.join(DOCUMENTS_DIR, doc.file), "utf8", (err, content) => {
    if (err) {
      console.error(`Không đọc được ${doc.file}:`, err.message);
      return res.status(500).json({ error: "Không đọc được nội dung văn bản." });
    }

    if (!content.trim()) {
      return res.status(503).json({ error: "Văn bản này chưa có nội dung." });
    }

    res.json({ slug: req.params.slug, title: doc.title, content });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `OPENROUTER_API_KEY: ${
      hasApiKey() ? "loaded ✓" : "MISSING ✗ — /chat sẽ báo hệ thống AI không hoạt động"
    }`
  );
  console.log(`Kiến trúc      : multi-agent (LangGraph) — 1 supervisor + ${AGENTS.length} agent`);

  // In đúng model của từng agent: đọc log là biết ngay .env đã vào chưa, thay vì
  // phải đoán xem giá trị mặc định nào đang được dùng.
  console.log(
    `Model nền (CHAT_MODEL): ${
      chatModel() || "(không đặt — mỗi thành phần dùng biến riêng bên dưới)"
    }`
  );
  for (const [id, model] of Object.entries(modelTable())) {
    const agent = agentById(id);
    console.log(`  ${agent.icon} ${id.padEnd(16)} ${model || "CHƯA ĐẶT ✗"}`);
  }
  console.log(`Model tóm tắt   : ${summaryModel() || "CHƯA ĐẶT ✗"}`);
  console.log(`Model soạn email: ${alertModel() || "CHƯA ĐẶT ✗"}`);

  // Hai model giọng nói. Thiếu thì KHÔNG cảnh báo như các model trên: chúng là
  // tuỳ chọn, bỏ trống chỉ có nghĩa là học sinh gõ chữ như trước.
  const voice = voiceStatus();
  console.log(
    `Micro (STT_MODEL): ${sttModel() || "(không đặt — nút micro sẽ ẩn)"}` +
      (voice.stt ? ` — ngôn ngữ ${voice.language}` : "")
  );
  console.log(
    `Loa (TTS_MODEL)  : ${ttsModel() || "(không đặt — Larry chỉ hiện chữ)"}` +
      (voice.tts ? ` — giọng ${voice.voice}` : "")
  );

  const missing = [...missingAgentModels(), ...missingBackgroundModels()];
  if (missing.length) {
    console.warn(
      `⚠️  Chưa có model cho: ${missing.join(", ")}. Đặt các biến đó, hoặc đặt ` +
        "CHAT_MODEL làm model nền, trong biến môi trường của backend."
    );
  }
  console.log(
    `Định tuyến     : đúng 1 agent/lượt (ưu tiên cao nhất), ` +
      `tối đa ${MAX_PROBE_TURNS} lượt khai thác`
  );
  console.log(`Tài khoản: ${users.length} — lưu tại ${ACCOUNTS_FILE}`);

  if (!users.some((u) => u.role === ROLES.ADMIN)) {
    console.warn(
      "⚠️  Chưa có tài khoản quản trị nào. Tạo bằng lệnh:  npm run create-admin"
    );
  }
  console.log(`Phiên hội thoại: ${sessions.length} — lưu tại ${SESSIONS_FILE}`);

  // In ra để lúc deploy nhìn log là biết cài đặt có rơi vào ổ đĩa lâu dài không.
  // Nằm trong thư mục mã nguồn nghĩa là mỗi lần deploy sẽ mất — xem settings.js.
  console.log(
    `Chế độ khách: ${isGuestModeEnabled() ? "BẬT" : "TẮT"} — lưu tại ${SETTINGS_FILE}`
  );
});
