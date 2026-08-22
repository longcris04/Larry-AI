// Vùng nhớ phiên hội thoại dành cho quản trị viên.
//
// Chuyển ra khỏi server.js để routes/chat.js ghi được vào đây.
// Đây là TẦNG ĐÁNH GIÁ NGUỘI — chạy độc lập với supervisor của hệ agent:
//   - supervisor  → đánh giá NÓNG, để định tuyến và nói với học sinh
//   - tầng này    → đánh giá NGUỘI, để gắn cờ cho giáo viên và soạn email cảnh báo
// Cố ý không gộp: lỗi ở tầng định tuyến không được phép kéo theo mất cảnh báo.

const {
  loadSessions,
  saveSessions,
  createSession,
  normalizeMessages,
  countMessages
} = require("./sessions");
const { summarizeSession } = require("./summarizer");
const { maxRiskLevel, mergeCategories, analyzeCheckin, describeCheckin } = require("./risk");
const { ROLES } = require("./accounts");

const sessions = loadSessions();

// Tóm tắt lại sau mỗi ngần này tin nhắn mới, để không gọi model tóm tắt liên tục
const SUMMARY_EVERY_N_MESSAGES = Number(process.env.SUMMARY_EVERY_N_MESSAGES) || 4;

function persistSessions() {
  try {
    saveSessions(sessions);
  } catch (err) {
    console.error("Không ghi được file phiên hội thoại:", err.message);
  }
}

// Nâng mức rủi ro của phiên lên ít nhất bằng mức chấm được, không bao giờ hạ xuống
function applyRiskFloor(session, floor) {
  if (!floor || floor.level === "none") return;

  session.flagged = true;
  session.riskLevel = maxRiskLevel(session.riskLevel, floor.level);
  session.categories = mergeCategories(session.categories || [], floor.categories);
}

// Nhóm do supervisor xác định → sàn rủi ro của phiên.
// Đây là chỗ DUY NHẤT hai tầng đánh giá gặp nhau.
const GROUP_RISK = {
  self_harm: { level: "high", categories: ["self_harm"] },
  victim: { level: "medium", categories: ["bullying"] },
  actor: { level: "medium", categories: ["bullying"] }
  // "general" cố ý không có mặt: trò chuyện thường ngày không nâng sàn
};

function applyAgentGroups(session, groups = []) {
  if (!session || groups.length === 0) return;

  for (const group of groups) {
    const floor = GROUP_RISK[group];
    if (floor) applyRiskFloor(session, floor);
  }

  // Lưu lại đường đi của hệ agent để trang quản trị dựng được dòng thời gian
  session.agentGroups = mergeAgentGroups(session.agentGroups || [], groups);

  const last = session.groupHistory?.[session.groupHistory.length - 1];
  if (!last || last.groups.join(",") !== groups.join(",")) {
    session.groupHistory = [
      ...(session.groupHistory || []),
      { at: new Date().toISOString(), groups: [...groups] }
    ].slice(-20);
  }
}

function mergeAgentGroups(current, incoming) {
  return [...new Set([...current, ...incoming])].slice(0, 8);
}

// Tạo mới hoặc cập nhật vùng nhớ của phiên. Trả về null nếu không được phép ghi
// (khách chưa đăng nhập, hoặc frontend không gửi sessionId).
function touchSession(reqUser, sessionId, history, { checkin = null, emotion = "" } = {}) {
  if (!reqUser || reqUser.guest || !sessionId || typeof sessionId !== "string") {
    return null;
  }
  // Các vai trò chỉ đọc không trò chuyện nên không bao giờ có phiên hội thoại.
  if ([ROLES.ADMIN, ROLES.TEACHER, ROLES.COUNSELOR].includes(reqUser.role)) return null;

  const id = sessionId.trim().slice(0, 80);
  if (!id) return null;

  let session = sessions.find((s) => s.id === id && s.userId === reqUser.id);

  if (!session) {
    session = createSession({ sessionId: id, user: reqUser });
    sessions.push(session);
  }

  session.endedAt = new Date().toISOString();
  session.messages = normalizeMessages(history);
  session.messageCount = countMessages(history);
  if (emotion) session.cameraEmotion = emotion;

  // Phiếu cảm xúc là căn cứ độc lập với hội thoại: học sinh điền phiếu xong có
  // thể không nhắn câu nào, nhưng giáo viên vẫn cần thấy tình trạng của em.
  // Chấm ngay bằng luật để phiên được gắn cờ kể cả khi model tóm tắt chưa chạy
  // hoặc gọi lỗi. Chỉ lưu phần chọn sẵn, không lưu nguyên văn em tự kể.
  if (checkin) {
    session.checkinNote = describeCheckin(checkin);
    applyRiskFloor(session, analyzeCheckin(checkin));
  }

  persistSessions();

  return session;
}

// Gọi model tóm tắt rồi ghi kết quả vào vùng nhớ. Chạy nền, không chặn /chat.
async function refreshSummary(session, history, { force = false, checkin = null } = {}) {
  if (!session) return;

  history = normalizeMessages(history);

  const floor = analyzeCheckin(checkin);

  // Phiếu có dấu hiệu tiêu cực thì tóm tắt ngay từ lượt đầu — hội thoại kiểu này
  // thường rất ngắn, đợi đủ SUMMARY_EVERY_N_MESSAGES tin nhắn thì không bao giờ tới.
  const urgent = floor.level !== "none" && session.summarizedAtCount === 0;
  const newMessages = session.messageCount - session.summarizedAtCount;
  if (!force && !urgent && newMessages < SUMMARY_EVERY_N_MESSAGES) return;
  if (history.length === 0 && !checkin) return;

  try {
    const result = await summarizeSession(history, {
      checkin,
      emotion: session.cameraEmotion || ""
    });
    session.summary = result.summary;
    session.flagged = result.flagged;
    session.riskLevel = result.riskLevel;
    session.categories = result.categories;
    session.bullyingDetected = result.bullying;
    session.concerns = result.concerns;
    session.summaryError = "";
    session.summarizedAtCount = session.messageCount;

    // Model không được phép hạ cờ xuống dưới mức phiếu đã tự nói lên
    applyRiskFloor(session, floor);

    // ...cũng không được hạ xuống dưới mức mà hệ agent đã xác định
    applyAgentGroups(session, session.agentGroups || []);

    if (session.flagged) {
      console.warn(
        `🚩 Dấu hiệu cần chú ý (${session.riskLevel}: ${session.categories.join(", ")}) — ` +
          `user "${session.username}" (phiên ${session.id}).`
      );
    }
  } catch (err) {
    session.summaryError = err.message.slice(0, 200);
    console.error("Tóm tắt phiên thất bại:", err.message);
  }

  persistSessions();
}

module.exports = {
  sessions,
  persistSessions,
  applyRiskFloor,
  applyAgentGroups,
  touchSession,
  refreshSummary,
  SUMMARY_EVERY_N_MESSAGES
};
