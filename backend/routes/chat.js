// Route trò chuyện — cửa vào duy nhất của hệ multi-agent.
//
//   POST /chat/stream       SSE, phát sự kiện từng agent (đường chính)
//   POST /chat              JSON một cục, tương thích client cũ
//   POST /api/session/end   Chốt bản tóm tắt cuối của phiên
//
// Vùng nhớ hội thoại nằm ở checkpointer của graph (khoá theo sessionId), nên
// client KHÔNG cần gửi lại toàn bộ history mỗi lượt như bản một-agent.

const express = require("express");

const { authenticateToken, blockAdmin } = require("../auth");
const { SYSTEM_DOWN_MESSAGE } = require("../fallback");
const { sanitizeCheckin } = require("../agents/checkin");
const { hasApiKey } = require("../agents/llm");
const { missingModelConfig } = require("../models");
const { runTurn } = require("../agents/runner");
const { SUPERVISOR } = require("../agents/registry");
const { touchSession, refreshSummary, applyAgentGroups, persistSessions } = require("../sessionStore");

const MAX_MESSAGE_LENGTH = 2000;

function createChatRouter({ getUserById } = {}) {
  const router = express.Router();
  const chatOnly = [authenticateToken, blockAdmin];

  // Hồ sơ học sinh để agent xưng hô và hiểu bối cảnh lớp học
  function studentOf(reqUser) {
    const account = typeof getUserById === "function" ? getUserById(reqUser.id) : null;
    return {
      username: reqUser.username || "Bạn nhỏ",
      ...(account?.profile || {})
    };
  }

  function readTurnInput(req) {
    const { sessionId, message, emotion = "", checkin: rawCheckin } = req.body || {};

    if (!sessionId || typeof sessionId !== "string") {
      return { error: "Thiếu sessionId." };
    }

    const text = typeof message === "string" ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";

    return {
      sessionId: sessionId.trim().slice(0, 80),
      text,
      // Không điền / bỏ qua phiếu thì trả về null, prompt giữ nguyên như khi không có phiếu
      checkin: sanitizeCheckin(rawCheckin),
      cameraEmotion: typeof emotion === "string" ? emotion : "",
      student: studentOf(req.user)
    };
  }

  // Ghi vùng nhớ phiên SAU KHI đã trả lời học sinh; tóm tắt chạy nền để không
  // làm chậm cuộc trò chuyện. Khách chưa đăng nhập thì bỏ qua toàn bộ.
  function recordSession(req, { sessionId, checkin, cameraEmotion }, result) {
    const session = touchSession(req.user, sessionId, result.history, {
      checkin,
      emotion: cameraEmotion
    });
    if (!session) return;

    // Nhóm do supervisor xác định nâng sàn rủi ro của phiên cho giáo viên
    applyAgentGroups(session, result.groups);
    persistSessions();

    refreshSummary(session, result.history, { checkin }).catch((err) =>
      console.error("refreshSummary:", err.message)
    );
  }

  // --- SSE ------------------------------------------------------------------

  router.post("/chat/stream", ...chatOnly, async (req, res) => {
    const input = readTurnInput(req);
    if (input.error) return res.status(400).json({ error: input.error });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx/Render đệm response theo mặc định, không tắt thì SSE về thành một cục
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();

    // Đệm mở đầu: nhiều trình duyệt (và proxy) giữ lại vài KB đầu của response
    // trước khi giao cho ReadableStream, nên sự kiện đầu tiên có thể tới chậm
    // vài giây. Một dòng comment SSE (bắt đầu bằng ":") đủ dài sẽ đẩy ngưỡng đó
    // qua ngay lập tức. Client bỏ qua dòng này vì nó không có field "data:".
    res.write(`:${" ".repeat(2048)}\n\n`);

    // Phải nghe trên RES, không phải REQ: từ Node 16, req phát "close" ngay khi
    // đọc xong body chứ không phải lúc client ngắt kết nối — nghe nhầm chỗ thì
    // mọi sự kiện đều bị coi là "client đã đóng" và response ra rỗng.
    let closed = false;
    res.on("close", () => {
      closed = true;
    });

    const send = (event, payload) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    // Thiếu khoá, hoặc thiếu tên model: cả hai đều là LỖI CẤU HÌNH, và cả hai đều
    // phải báo lỗi thật chứ không được tự chọn model thay người vận hành.
    const configError = describeConfigError();
    if (configError) {
      send("message", {
        agent: SUPERVISOR.id,
        displayName: SUPERVISOR.displayName,
        icon: SUPERVISOR.icon,
        color: SUPERVISOR.color,
        text: SYSTEM_DOWN_MESSAGE
      });
      send("error", { warning: configError });
      return res.end();
    }

    try {
      const result = await runTurn(input, send);
      send("done", { groups: result.groups, agents: result.routedAgents });
      res.end();

      recordSession(req, input, result);
    } catch (err) {
      console.error("Chat stream error:", err.message);

      // Không tự đoán câu trả lời thay LLM — chỉ báo hệ thống đang lỗi
      send("message", {
        agent: SUPERVISOR.id,
        displayName: SUPERVISOR.displayName,
        icon: SUPERVISOR.icon,
        color: SUPERVISOR.color,
        text: SYSTEM_DOWN_MESSAGE
      });
      send("error", { warning: describeError(err) });
      res.end();
    }
  });

  // --- JSON một cục (dự phòng) ----------------------------------------------

  router.post("/chat", ...chatOnly, async (req, res) => {
    const input = readTurnInput(req);
    if (input.error) return res.status(400).json({ error: input.error });

    const configError = describeConfigError();
    if (configError) {
      return res.json({
        messages: [{ agent: SUPERVISOR.id, text: SYSTEM_DOWN_MESSAGE }],
        fallback: true,
        warning: configError
      });
    }

    try {
      const result = await runTurn({ ...input, streamTokens: false });

      res.json({
        messages: result.replies,
        groups: result.groups,
        agents: result.routedAgents,
        // Cùng dữ liệu mà đường SSE phát qua sự kiện "knowledge"
        knowledge: result.knowledge,
        fallback: false,
        usedCheckin: Boolean(input.checkin)
      });

      recordSession(req, input, result);
    } catch (err) {
      console.error("Chat error:", err.message);
      res.json({
        messages: [{ agent: SUPERVISOR.id, text: SYSTEM_DOWN_MESSAGE }],
        fallback: true,
        warning: describeError(err)
      });
    }
  });

  // --- Chốt phiên -----------------------------------------------------------

  router.post("/api/session/end", ...chatOnly, async (req, res) => {
    const { sessionId, history = [], emotion = "", checkin: rawCheckin } = req.body || {};

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: "history phải là mảng." });
    }

    // Phiếu được gửi lại ở đây để bản tóm tắt cuối vẫn đọc được nó — hệ thống cố ý
    // không lưu phần học sinh tự kể xuống file phiên.
    const checkin = sanitizeCheckin(rawCheckin);

    const session = touchSession(req.user, sessionId, history, { checkin, emotion });
    if (!session) return res.json({ saved: false });

    await refreshSummary(session, history, { force: true, checkin });
    res.json({ saved: true });
  });

  return router;
}

// Cấu hình thiếu thì nói rõ THIẾU CÁI GÌ. Trước đây chỉ kiểm tra mỗi API key, nên
// quên đặt tên model sẽ hiện ra thành một lỗi gọi API khó hiểu.
function describeConfigError() {
  if (!hasApiKey()) return "Chưa cấu hình OPENROUTER_API_KEY trong backend/.env.";

  const missing = missingModelConfig();
  if (missing.length) {
    return `Chưa cấu hình tên model: thiếu ${missing.join(", ")} trong backend/.env.`;
  }

  return "";
}

function describeError(err) {
  const msg = err.message || "";
  const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate limit");
  return isRateLimit
    ? "Hệ thống AI đang quá tải (429/rate limit)."
    : `Không gọi được OpenRouter: ${msg.slice(0, 200)}`;
}

module.exports = { createChatRouter };
