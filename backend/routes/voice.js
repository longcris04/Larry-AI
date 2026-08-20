// Route giọng nói — hai chiều của cùng một cuộc trò chuyện.
//
//   GET  /api/voice/config   Có bật được micro/loa không (frontend hỏi lúc mở chat)
//   POST /api/voice/stt      Byte thu âm  → chữ, để đưa vào /chat/stream
//   POST /api/voice/tts      Chữ Larry nói → byte âm thanh cho loa
//
// Route này CỐ Ý không đụng tới hệ agent. Nó chỉ đổi qua lại giữa tiếng và chữ;
// mọi thứ còn lại (supervisor, phân nhóm, vùng nhớ phiên) vẫn đi đúng đường cũ
// qua /chat/stream. Nhờ vậy nói và gõ là hai cách nhập của CÙNG một luồng, không
// phải hai luồng song song phải giữ cho khớp nhau.

const express = require("express");

const { authenticateToken, blockAdmin } = require("../auth");
const { hasApiKey } = require("../agents/llm");
const { isTtsEnabled } = require("../settings");
const {
  transcribeAudio,
  synthesizeSpeech,
  voiceStatus,
  MAX_AUDIO_BYTES
} = require("../voice");

// Định dạng trình duyệt gửi lên được. Frontend chuyển sang WAV trước khi gửi (xem
// utils/audio.js) vì đó là định dạng mọi model ASR đều đọc được; mấy dòng còn lại
// để phòng khi gọi thẳng API bằng tệp có sẵn.
const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/wave", "audio/webm", "audio/mpeg", "audio/mp4"];

function createVoiceRouter() {
  const router = express.Router();
  const voiceOnly = [authenticateToken, blockAdmin];

  // Không có khoá thì cả hai chiều đều tắt, dù đã khai tên model.
  //
  // Chiều NÓI còn phụ thuộc công tắc của quản trị viên (settings.ttsEnabled) —
  // công tắc tiết kiệm token, tắt là không gọi model TTS nữa. Đọc mỗi lượt chứ
  // không nhớ lại lúc dựng router: quản trị viên bấm tắt lúc 9h thì 9h01 học
  // sinh đang mở sẵn khung chat cũng thôi phát tiếng, không cần khởi động lại.
  function ready() {
    const status = voiceStatus();
    const keyed = hasApiKey();
    return {
      ...status,
      stt: status.stt && keyed,
      tts: status.tts && keyed && isTtsEnabled()
    };
  }

  // --- Micro có bật được không ----------------------------------------------

  // Frontend hỏi trước khi vẽ nút. Thiếu cấu hình thì nút không hiện ra, thay vì
  // hiện rồi báo lỗi lúc em bấm vào — với học sinh tiểu học, một cái nút bấm vào
  // không chạy khó hiểu hơn nhiều so với một cái nút không có.
  router.get("/api/voice/config", authenticateToken, (req, res) => {
    res.json(ready());
  });

  // --- Nghe -----------------------------------------------------------------

  router.post(
    "/api/voice/stt",
    ...voiceOnly,
    express.raw({ type: AUDIO_TYPES, limit: MAX_AUDIO_BYTES }),
    async (req, res) => {
      if (!ready().stt) {
        return res.status(503).json({ error: "Chưa cấu hình STT_MODEL trong backend/.env." });
      }

      // express.raw bỏ qua thân request nếu Content-Type không nằm trong danh sách
      // trên — lúc đó req.body là {} chứ không phải Buffer.
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          error: `Thiếu dữ liệu âm thanh. Gửi byte thô kèm Content-Type là một trong: ${AUDIO_TYPES.join(", ")}.`
        });
      }

      try {
        const { text, seconds } = await transcribeAudio(req.body, req.headers["content-type"]);
        res.json({ text, seconds });
      } catch (err) {
        console.error("Voice STT error:", err.message);
        res.status(502).json({ error: describeError(err) });
      }
    }
  );

  // --- Nói ------------------------------------------------------------------

  router.post("/api/voice/tts", ...voiceOnly, async (req, res) => {
    // Phân biệt hai lý do câm, vì cách sửa khác hẳn nhau: một cái là quản trị
    // viên bấm tắt trên trang quản trị, một cái là máy chủ chưa khai model.
    if (!isTtsEnabled()) {
      return res
        .status(503)
        .json({ error: "Quản trị viên đang tắt giọng đọc của Larry." });
    }

    if (!ready().tts) {
      return res.status(503).json({ error: "Chưa cấu hình TTS_MODEL trong backend/.env." });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Thiếu nội dung cần đọc." });

    try {
      const { audio, contentType } = await synthesizeSpeech(text);

      res.set({
        "Content-Type": contentType,
        "Content-Length": String(audio.length),
        // Cùng một câu luôn ra cùng một giọng, nhưng đây là nội dung riêng của một
        // học sinh trong một lượt — không để proxy dùng chung giữ lại.
        "Cache-Control": "private, no-store"
      });
      res.send(audio);
    } catch (err) {
      console.error("Voice TTS error:", err.message);
      res.status(502).json({ error: describeError(err) });
    }
  });

  return router;
}

function describeError(err) {
  const msg = err.message || "";
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
    return "Model giọng nói đang quá tải (429/rate limit).";
  }
  return msg.slice(0, 300) || "Không gọi được model giọng nói.";
}

module.exports = { createVoiceRouter };
