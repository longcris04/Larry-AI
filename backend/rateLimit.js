// Hạn mức lượt hỏi — cái phanh giữ cho một tài khoản không gọi model liên tục.
//
// Mỗi lượt chat là một chuỗi lời gọi model có trả tiền (supervisor đánh giá →
// agent trả lời → tóm tắt chạy nền), nên một em bấm gửi liên tục — hay một script
// gọi thẳng API — đốt tiền nhanh hơn nhiều so với mức một cuộc trò chuyện thật.
// Vì vậy phanh phải nằm ở MÁY CHỦ: giao diện có khoá nút gửi thì cũng chỉ là khoá
// ở phía trình duyệt.
//
// CỬA SỔ TRƯỢT, không phải cửa sổ cố định: mỗi lượt được nhớ theo mốc thời gian
// của chính nó. Cửa sổ cố định (đếm lại từ 0 mỗi 10 phút) cho phép dồn 20 lượt
// cuối cửa sổ này với 20 lượt đầu cửa sổ sau — 40 lượt trong chớp mắt, đúng thứ
// hạn mức này sinh ra để chặn.
//
//   lượt:  x x x   x x        x x x x
//          └──────── 10 phút ────────┘ ← chỉ đếm những lượt còn nằm trong đây
//
// Đếm trong BỘ NHỚ tiến trình, không ghi ra đĩa: khởi động lại là hạn mức được xoá.
// Đây là đánh đổi có chủ ý — mất một cái phanh tạm sau mỗi lần deploy nhẹ hơn
// nhiều so với việc ghi đĩa ở mọi lượt chat. Lưu ý khi chạy NHIỀU instance (Render
// gói trả phí, autoscale): mỗi instance đếm riêng, nên hạn mức thật sẽ là
// 20 × số instance. Muốn siết chính xác thì phải thay Map dưới đây bằng Redis.

// Đọc số từ biến môi trường, sai kiểu hay số vô lý thì dùng mặc định thay vì để
// một dấu gõ nhầm biến thành "hạn mức 0 lượt" — cả dịch vụ đứng im mà không rõ vì sao.
function positiveNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// 20 lượt / 10 phút cho một tài khoản. Đủ rộng cho một cuộc trò chuyện thật —
// học sinh gõ xong một câu và đọc hết câu trả lời của Larry mất hơn 30 giây —
// nhưng chặn được kiểu bấm gửi liên tục.
const MAX_TURNS = Math.floor(positiveNumber(process.env.CHAT_RATE_LIMIT_MAX, 20));
const WINDOW_MINUTES = positiveNumber(process.env.CHAT_RATE_LIMIT_WINDOW_MINUTES, 10);
const WINDOW_MS = Math.round(WINDOW_MINUTES * 60 * 1000);

// Trần cho lượt chào. Sáu lần mở màn hình chat trong 10 phút đã là rất nhiều với
// một em dùng thật (vào chat, sang game rồi về, tải lại trang khi mạng chập chờn),
// nên con số này gần như không bao giờ chạm tới trong sử dụng bình thường — nó ở
// đây để chặn vòng lặp gửi `message` rỗng, không phải để giới hạn học sinh.
const MAX_GREETINGS = Math.floor(positiveNumber(process.env.CHAT_RATE_LIMIT_GREETING_MAX, 6));

// Đặt CHAT_RATE_LIMIT_MAX=0 để tắt hẳn (ví dụ lúc chạy thử ở máy cá nhân).
const ENABLED = Number(process.env.CHAT_RATE_LIMIT_MAX) !== 0;

// Hai túi đếm, mỗi túi một trần. Cùng dùng chung độ dài cửa sổ: hai cửa sổ lệch
// nhau thì câu "thử lại sau N phút" phải nói về túi nào, và người đọc log sẽ
// phải nhớ hai con số thay vì một.
const BUCKETS = {
  turn: { max: MAX_TURNS, label: "lượt hỏi" },
  greeting: { max: MAX_GREETINGS, label: "lượt chào" }
};

// "<túi>|<khoá tài khoản>" → mốc thời gian của các lượt còn trong cửa sổ (cũ nhất
// đứng đầu). Gộp hai túi vào MỘT Map, phân biệt bằng tiền tố: một Map thì phần
// dọn rác định kỳ ở cuối file chỉ có một vòng lặp để quét.
const hits = new Map();

// Ai đang bị đếm. Khách chưa đăng nhập vẫn có id riêng trong token (xem
// /api/guest), nên mỗi phiên khách là một "tài khoản" độc lập. Không rơi về IP:
// cả một phòng máy trong trường đi chung một địa chỉ, đếm theo IP thì em đầu tiên
// dùng hết hạn mức của cả lớp.
//
// CHỖ HỞ ĐÃ BIẾT: id của khách sinh mới mỗi lần bấm "Trò chuyện ngay", nên khách
// bấm lại là có hạn mức mới. Tài khoản có đăng nhập thì không — id nằm trong
// account.json và không đổi. Bịt hẳn chỗ này phải đếm theo IP cho riêng khách,
// nhưng như thế lại thành cả phòng máy chung một hạn mức, nên tạm chấp nhận: ai
// lo tiền thật thì tắt chế độ khách trong trang quản trị.
function keyOf(req) {
  const id = req.user?.id;
  return id ? `user:${id}` : `anon:${req.ip || "unknown"}`;
}

// Lượt chào = lượt KHÔNG có câu nào của học sinh. Đây đúng là thứ ChatBox gửi khi
// mở màn hình chat (`message: ""`, xem lượt mở lời trong ChatBox.jsx), và cũng
// đúng là thứ agent nhận được: không có gì để trả lời thì Larry chào trước.
//
// Nhận diện theo NỘI DUNG chứ không theo một cờ do client tự khai (kiểu
// `greeting: true`): cờ do client đặt thì ai cũng đặt được cho mọi request, và
// cả hạn mức 20 lượt hỏi biến mất chỉ bằng một dòng JSON.
function isGreeting(req) {
  const message = req.body?.message;
  return typeof message !== "string" || message.trim() === "";
}

// Bỏ các lượt đã trôi ra khỏi cửa sổ. Trả về mảng đã lọc để nơi gọi dùng tiếp,
// tránh quét hai lần.
function recentHits(key, now) {
  const list = hits.get(key);
  if (!list) return [];

  // Mảng luôn theo thứ tự thời gian tăng dần, nên cắt từ đầu là đủ
  let keepFrom = 0;
  while (keepFrom < list.length && now - list[keepFrom] >= WINDOW_MS) keepFrom += 1;

  return keepFrom === 0 ? list : list.slice(keepFrom);
}

/**
 * Ghi nhận một lượt, và cho biết lượt đó có được đi tiếp không.
 *
 * @param {string} key
 * @param {number} [now]
 * @param {"turn"|"greeting"} [bucket]  Túi đếm. Mặc định là túi lượt hỏi.
 * @returns {{allowed: boolean, remaining: number, retryAfterMs: number, limit: number}}
 */
function consume(key, now = Date.now(), bucket = "turn") {
  const { max } = BUCKETS[bucket] || BUCKETS.turn;
  const slot = `${bucket}|${key}`;
  const list = recentHits(slot, now);

  if (list.length >= max) {
    hits.set(slot, list);
    return {
      allowed: false,
      remaining: 0,
      limit: max,
      // Lượt cũ nhất rời cửa sổ lúc nào thì lúc đó có chỗ trống cho lượt mới
      retryAfterMs: Math.max(0, list[0] + WINDOW_MS - now)
    };
  }

  list.push(now);
  hits.set(slot, list);

  return { allowed: true, remaining: max - list.length, limit: max, retryAfterMs: 0 };
}

// Câu Larry nói khi em gõ quá nhanh. Cố ý KHÔNG nghe như một lời khiển trách hay
// một mã lỗi: đây là lúc nghỉ giữa cuộc trò chuyện, và Larry sẽ vẫn ở đó.
function limitMessage(retryAfterMs) {
  // Làm tròn LÊN, tối thiểu 1: "thử lại sau 0 phút" vừa vô nghĩa vừa sai — còn
  // vài giây nữa mới có chỗ trống thật.
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return (
    `Bạn hãy thử lại sau ${minutes} phút! ` +
    "Larry cần nghỉ ngơi một chút rồi mình cùng tiếp tục nói chuyện nhé!"
  );
}

/**
 * Middleware cho các route TỐN TIỀN MODEL. Đặt SAU authenticateToken để còn biết
 * đang đếm cho tài khoản nào, và sau express.json() để đọc được `message` —
 * chính nó quyết định lượt này rơi vào túi nào.
 *
 * Cố ý không gắn vào /api/session/end: chốt phiên chạy đúng một lần lúc học sinh
 * rời màn hình, và chặn nó có nghĩa là quản trị viên/giáo viên mất bản tóm tắt
 * của chính cuộc trò chuyện vừa chạm hạn mức — mất đúng thứ cần xem nhất.
 */
function chatRateLimit() {
  return (req, res, next) => {
    if (!ENABLED) return next();

    const bucket = isGreeting(req) ? "greeting" : "turn";
    const verdict = consume(keyOf(req), Date.now(), bucket);

    res.set("X-RateLimit-Limit", String(verdict.limit));
    res.set("X-RateLimit-Remaining", String(verdict.remaining));
    // Túi nào đang được đếm — đọc log/devtools là biết ngay, khỏi phải đoán vì
    // sao còn 19 lượt hỏi mà vẫn bị chặn (chạm trần lượt chào).
    res.set("X-RateLimit-Bucket", bucket);

    if (verdict.allowed) return next();

    const retryAfterSeconds = Math.ceil(verdict.retryAfterMs / 1000);
    res.set("Retry-After", String(retryAfterSeconds));

    // 429 và một câu chữ hoàn chỉnh: frontend hiện thẳng câu này thành lời của
    // Larry (xem useAgentStream), nên nội dung phải đọc được như lời nói, không
    // phải như thông báo lỗi kỹ thuật.
    //
    // Chạm trần túi nào cũng NÓI ĐÚNG MỘT CÂU đó. Với học sinh, "bạn mở lại khung
    // chat nhiều quá" và "bạn hỏi nhanh quá" đều chỉ có một cách xử lý: nghỉ một
    // lát rồi quay lại. Phân biệt hai câu chỉ làm em phải hiểu thêm một khái niệm.
    return res.status(429).json({
      error: limitMessage(verdict.retryAfterMs),
      rateLimited: true,
      retryAfterSeconds,
      retryAfterMinutes: Math.max(1, Math.ceil(verdict.retryAfterMs / 60000)),
      bucket,
      limit: verdict.limit,
      windowMinutes: WINDOW_MINUTES
    });
  };
}

// Dọn rác định kỳ. Không có bước này thì Map phình ra theo tổng số tài khoản đã
// từng chat kể từ lúc khởi động — mỗi phiên khách là một khoá mới, nên nó chỉ có
// tăng. unref() để tiến trình vẫn thoát được bình thường khi cần.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const key of hits.keys()) {
    const list = recentHits(key, now);
    if (list.length === 0) hits.delete(key);
    else hits.set(key, list);
  }
}, WINDOW_MS);
sweepTimer.unref?.();

// Trạng thái để in ra log lúc khởi động và trả về ở /api/health
function rateLimitStatus() {
  return {
    enabled: ENABLED,
    maxTurns: MAX_TURNS,
    // Lượt chào đếm riêng, không ăn vào maxTurns
    maxGreetings: MAX_GREETINGS,
    windowMinutes: WINDOW_MINUTES,
    tracked: hits.size
  };
}

module.exports = {
  MAX_TURNS,
  MAX_GREETINGS,
  WINDOW_MINUTES,
  WINDOW_MS,
  ENABLED,
  consume,
  limitMessage,
  chatRateLimit,
  rateLimitStatus,
  // Chỉ để kiểm thử: xoá sạch bộ đếm giữa hai bài test
  _reset: () => hits.clear()
};
