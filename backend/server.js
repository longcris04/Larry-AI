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
  EMPTY_PROFILE,
  loadUsers,
  saveUsers,
  nextUserId,
  findUserByEmail,
  seedAdminFromEnv
} = require("./accounts");
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  GUEST_EXPIRES_IN,
  authenticateToken,
  requireAdmin
} = require("./auth");
const { sessions, persistSessions } = require("./sessionStore");
const { createChatRouter } = require("./routes/chat");
const { hasApiKey } = require("./agents/llm");
const { chatModel, missingBackgroundModels } = require("./models");
const {
  AGENTS,
  SUPERVISOR,
  agentById,
  modelForAgent,
  modelTable,
  missingAgentModels
} = require("./agents/registry");
const { MAX_PROBE_TURNS } = require("./agents/routing");

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

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password, profile } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    // Chỉ so trùng trong nhóm tài khoản người dùng — email của admin không chặn
    // học sinh đăng ký, vì hai bên được phân biệt bằng vai trò lúc đăng nhập.
    const existingUser = users.find(
      u => u.role === ROLES.USER && (u.email === email || u.username === username)
    );
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email or username" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = {
      id: nextUserId(users),
      username,
      email,
      password: hashedPassword,
      role: ROLES.USER,
      // Thông tin học sinh — tất cả đều không bắt buộc
      profile: sanitizeProfile(profile),
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

    // KHÔNG cấp token/cookie ở đây: đăng ký xong học sinh quay lại màn hình
    // đăng nhập để tự đăng nhập, chứ không vào thẳng giao diện chat.
    res.status(201).json({
      user: toPublicUser(newUser),
      message: "Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu."
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
    const requestedRole = role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;

    // Tra theo email + vai trò: một email có thể vừa là tài khoản user vừa là admin
    const user = findUserByEmail(users, email, requestedRole);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
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

// Guest endpoint — vào chat ngay, không cần tài khoản.
// Vẫn phát JWT để /chat giữ nguyên cơ chế bảo vệ, chỉ khác là không ghi vào account.json.
app.post("/api/guest", (req, res) => {
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

// Danh sách tài khoản, kèm thống kê nhanh về các phiên hội thoại
app.get("/api/admin/users", adminOnly, (req, res) => {
  const list = users.map((user) => {
    const userSessions = sessions.filter((s) => s.userId === user.id);
    return {
      ...toPublicUser(user),
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
    if (typeof email === "string" && email.trim()) user.email = email.trim();
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

    res.json({
      ...draft,
      to: ALERT_EMAIL_TO,
      from: EMAIL_USER,
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
  const { session, error } = findSessionForAlert(req.params.sessionId);
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

  try {
    const result = await sendAlertEmail({ to, subject, body: body.slice(0, 8000) });

    const record = {
      sentAt: new Date().toISOString(),
      to: to.trim(),
      subject: subject.trim().slice(0, 200),
      sentBy: req.user.username || req.user.email || `admin#${req.user.id}`
    };
    session.alerts = [...(session.alerts || []), record].slice(-10);
    persistSessions();

    console.log(
      `✉️  Đã gửi cảnh báo phiên ${session.id} tới ${record.to} (bởi ${record.sentBy}).`
    );

    res.json({ sent: true, alert: record, messageId: result.messageId });
  } catch (err) {
    console.error("Gửi email cảnh báo thất bại:", err.message);
    res.status(502).json({ error: `Không gửi được email: ${err.message.slice(0, 200)}` });
  }
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
});
