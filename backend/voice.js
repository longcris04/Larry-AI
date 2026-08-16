// Cầu nối duy nhất giữa Larry và hai model giọng nói của OpenRouter.
//
//   nghe:  POST {base}/audio/transcriptions   (multipart)  → { text }
//   nói:   POST {base}/audio/speech           (JSON)       → byte âm thanh thô
//
// Hai đường này KHÁC đường của hệ agent (agents/llm.js). Agent nói chuyện qua
// /chat/completions nên dùng được ChatOpenAI của LangChain; hai endpoint âm thanh
// không phải chat completion, LangChain không bọc chúng, nên gọi thẳng bằng fetch.
// Node 18 trở lên đã có sẵn fetch/FormData/Blob — không thêm thư viện nào.
//
// Tên model chỉ nằm trong .env, giống mọi model khác (xem models.js).

const { sttModel, ttsModel } = require("./models");

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

// Âm thanh chậm hơn chữ: một câu trả lời dài của Larry mất vài giây để đọc thành
// tiếng, nên không dùng chung AGENT_TIMEOUT_MS (30s) vốn đo cho một lượt chat.
const VOICE_TIMEOUT_MS = Number(process.env.VOICE_TIMEOUT_MS) || 45000;

// Giọng đọc của Larry. Mỗi model TTS có bộ giọng riêng nên đây là biến môi
// trường chứ không phải hằng số trong mã nguồn.
const TTS_VOICE = String(process.env.TTS_VOICE || "Kore").trim();

// Gợi ý ngôn ngữ cho model nghe. Để trống thì model tự đoán — nhưng học sinh nói
// tiếng Việt, và nói rõ ra thì model đỡ nhầm sang ngôn ngữ gần âm.
const STT_LANGUAGE = String(process.env.STT_LANGUAGE || "vi").trim();

// Chặn ở cửa vào cho rõ lỗi. 10MB ≈ 5 phút thu âm ở 16kHz mono 16-bit — dài hơn
// nhiều so với một lượt nói của học sinh.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// Cắt phần đọc thành tiếng. Câu trả lời của Larry hiếm khi dài tới đây; đặt hạn
// để một lượt lỗi không đọc hết hạn mức của cả ngày.
const MAX_TTS_CHARS = 3000;

const SITE_URL = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
const SITE_NAME = process.env.OPENROUTER_SITE_NAME || "Larry AI";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": SITE_URL,
    "X-Title": SITE_NAME
  };
}

// Gọi kèm hạn giờ. fetch không tự bỏ cuộc, thiếu cái này thì một lần OpenRouter
// treo là giữ luôn kết nối của học sinh cho tới khi trình duyệt tự ngắt.
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Model giọng nói không trả lời trong ${VOICE_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// OpenRouter trả lỗi dạng JSON { error: { message } }, nhưng lúc hỏng nặng thì ra
// HTML của Cloudflare. Đọc được cái nào thì báo cái đó, đừng để lộ ra một cục HTML.
async function readError(res) {
  const raw = await res.text().catch(() => "");

  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.error?.message || parsed?.message;
    if (message) return String(message).slice(0, 300);
  } catch {
    /* không phải JSON thì rơi xuống dưới */
  }

  return `HTTP ${res.status}${raw ? `: ${raw.slice(0, 200)}` : ""}`;
}

// --- Nghe: tiếng nói của học sinh → chữ -------------------------------------

/**
 * @param {Buffer} audio     Byte của tệp âm thanh (frontend gửi lên dạng WAV)
 * @param {string} [mimeType]
 * @returns {Promise<{ text: string, seconds: number }>}
 */
async function transcribeAudio(audio, mimeType = "audio/wav") {
  const model = sttModel();
  if (!model) throw new Error("Chưa cấu hình STT_MODEL trong backend/.env.");
  if (!audio?.length) throw new Error("Không nhận được dữ liệu âm thanh.");
  if (audio.length > MAX_AUDIO_BYTES) {
    throw new Error(`Đoạn thu âm quá dài (tối đa ${MAX_AUDIO_BYTES / 1024 / 1024}MB).`);
  }

  const form = new FormData();
  // Tên tệp bắt buộc phải có đuôi: một số nhà cung cấp đọc định dạng từ đuôi tệp
  // chứ không đọc Content-Type của phần multipart.
  const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp") ? "mp3" : "wav";
  form.append("file", new Blob([audio], { type: mimeType }), `speech.${extension}`);
  form.append("model", model);
  if (STT_LANGUAGE) form.append("language", STT_LANGUAGE);

  const res = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    // KHÔNG tự đặt Content-Type ở đây: fetch phải tự sinh boundary của multipart.
    headers: authHeaders(),
    body: form
  });

  if (!res.ok) throw new Error(await readError(res));

  const data = await res.json();
  return {
    text: String(data?.text || "").trim(),
    seconds: Number(data?.usage?.seconds) || 0
  };
}

// --- Nói: câu trả lời của Larry → tiếng ---------------------------------------

// Trình duyệt không phát được PCM thô — <audio> cần một container để biết tần số
// lấy mẫu và số kênh. Bọc 44 byte header WAV vào là phát được ngay, rẻ hơn nhiều
// so với bắt frontend tự dựng AudioBuffer.
function wrapPcmAsWav(pcm, { sampleRate, channels }) {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // độ dài khối fmt
  header.writeUInt16LE(1, 20); // 1 = PCM không nén
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte mỗi giây
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

// Model trả về "audio/pcm;rate=24000;channels=1" — tần số nằm ở header chứ không
// phải trong tài liệu, nên đọc từ đó thay vì ghi cứng 24000. Đổi model TTS mà
// tần số khác đi thì giọng vẫn đúng cao độ, không bị rè hay chạy nhanh.
function readPcmFormat(contentType) {
  const rate = /rate=(\d+)/i.exec(contentType);
  const channels = /channels=(\d+)/i.exec(contentType);
  return {
    sampleRate: rate ? Number(rate[1]) : 24000,
    channels: channels ? Number(channels[1]) : 1
  };
}

/**
 * @param {string} text  Câu Larry vừa nói trong khung chat
 * @returns {Promise<{ audio: Buffer, contentType: string }>}
 */
async function synthesizeSpeech(text) {
  const model = ttsModel();
  if (!model) throw new Error("Chưa cấu hình TTS_MODEL trong backend/.env.");

  const input = String(text || "").trim().slice(0, MAX_TTS_CHARS);
  if (!input) throw new Error("Không có nội dung để đọc.");

  const res = await fetchWithTimeout(`${OPENROUTER_BASE_URL}/audio/speech`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input,
      voice: TTS_VOICE,
      // pcm là định dạng chung của mọi nhà cung cấp TTS trên OpenRouter. Gemini
      // TTS CHỈ nhận pcm và từ chối thẳng mp3, nên xin pcm rồi tự bọc WAV ở dưới
      // là đường duy nhất chạy được cho cả hai bên.
      response_format: "pcm"
    })
  });

  if (!res.ok) throw new Error(await readError(res));

  const contentType = res.headers.get("content-type") || "";
  const body = Buffer.from(await res.arrayBuffer());

  if (!body.length) throw new Error("Model TTS trả về đoạn âm thanh rỗng.");

  // Model nào trả sẵn container (mp3/wav/ogg) thì chuyển thẳng cho trình duyệt
  if (!contentType.includes("audio/pcm") && !contentType.includes("audio/L16")) {
    return { audio: body, contentType: contentType || "audio/mpeg" };
  }

  return {
    audio: wrapPcmAsWav(body, readPcmFormat(contentType)),
    contentType: "audio/wav"
  };
}

// Giọng nói là tính năng THÊM: thiếu cấu hình thì khung chat gõ chữ vẫn chạy
// nguyên vẹn, chỉ nút micro và loa tự ẩn. Frontend hỏi /api/voice/config để biết.
function voiceStatus() {
  return {
    stt: Boolean(sttModel()),
    tts: Boolean(ttsModel()),
    voice: TTS_VOICE,
    language: STT_LANGUAGE
  };
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  voiceStatus,
  MAX_AUDIO_BYTES,
  MAX_TTS_CHARS
};
