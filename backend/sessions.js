const fs = require("fs");
const path = require("path");

// Mỗi phiên hội thoại của học sinh ĐÃ ĐĂNG NHẬP được lưu thành một bản ghi.
// Khách (guest) không có userId nên không bao giờ được ghi vào đây.
const SESSIONS_FILE = process.env.SESSIONS_FILE
  ? path.resolve(process.env.SESSIONS_FILE)
  : path.join(__dirname, "sessions.json");

function saveSessions(sessions) {
  const tempFile = `${SESSIONS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(sessions, null, 2), "utf8");
  fs.renameSync(tempFile, SESSIONS_FILE);
}

function loadSessions() {
  let raw;
  try {
    raw = fs.readFileSync(SESSIONS_FILE, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    saveSessions([]);
    return [];
  }

  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSession) : [];
  } catch (err) {
    const backupFile = `${SESSIONS_FILE}.broken-${Date.now()}`;
    fs.renameSync(SESSIONS_FILE, backupFile);
    console.error(
      `⚠️  ${path.basename(SESSIONS_FILE)} hỏng — đã đổi tên thành ${path.basename(
        backupFile
      )} và bắt đầu lại từ danh sách rỗng.`
    );
    saveSessions([]);
    return [];
  }
}

// Vùng nhớ của một phiên hội thoại
function createSession({ sessionId, user }) {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    userId: user.id,
    username: user.username,
    email: user.email || "",
    startedAt: now,
    endedAt: now,
    messageCount: 0,
    // Phiếu cảm xúc học sinh điền trước khi chat: chỉ lưu phần chọn sẵn dưới dạng
    // một dòng mô tả, KHÔNG lưu nguyên văn phần em tự kể (xem risk.js).
    checkinNote: "",
    cameraEmotion: "",
    // Do model tóm tắt sinh ra, xem summarizer.js
    summary: "",
    // flagged = phiên có bất kỳ dấu hiệu tiêu cực nào về học sinh, không chỉ bắt nạt
    flagged: false,
    riskLevel: "none", // none | low | medium | high
    categories: [],
    bullyingDetected: false,
    concerns: [],
    summarizedAtCount: 0,
    summaryError: "",
    // Lịch sử email cảnh báo đã gửi cho giáo viên chủ nhiệm (xem alertEmail.js)
    alerts: []
  };
}

// Bản ghi cũ chỉ có bullyingDetected. Suy ra cờ mới để trang quản trị không phải
// xử lý hai định dạng, và để phiên cũ có dấu hiệu đáng lo vẫn nổi lên.
function normalizeSession(session) {
  if (!session || typeof session !== "object") return session;

  // Field thêm sau này — bản ghi cũ nào thiếu thì bù giá trị rỗng
  const withDefaults = {
    ...session,
    checkinNote: session.checkinNote || "",
    cameraEmotion: session.cameraEmotion || "",
    alerts: Array.isArray(session.alerts) ? session.alerts : []
  };

  if (typeof session.flagged === "boolean") return withDefaults;

  const bullying = session.bullyingDetected === true;
  const concerns = Array.isArray(session.concerns) ? session.concerns : [];
  const flagged = bullying || concerns.length > 0;

  return {
    ...withDefaults,
    flagged,
    riskLevel: bullying ? "high" : flagged ? "medium" : "none",
    categories: flagged ? (bullying ? ["bullying"] : ["other"]) : [],
    concerns
  };
}

module.exports = { SESSIONS_FILE, loadSessions, saveSessions, createSession, normalizeSession };
