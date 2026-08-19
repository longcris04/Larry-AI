// Bài kiểm tra cho hạn mức lượt hỏi.
//
//   node --test rateLimit.test.js       (hoặc: npm run test:ratelimit)
//
// Dùng bộ chạy test có sẵn của Node, không thêm thư viện nào — backend cố ý giữ
// danh sách phụ thuộc mỏng, và một cái phanh chống đốt tiền thì không đáng để
// đánh đổi bằng cả một framework test.
//
// Mọi bài đều TIÊM MỐC THỜI GIAN vào consume() thay vì chờ đồng hồ thật: cửa sổ
// dài 10 phút, chờ thật thì bộ test này chạy lâu hơn cả buổi học.

const test = require("node:test");
const assert = require("node:assert");

const { consume, limitMessage, MAX_TURNS, MAX_GREETINGS, WINDOW_MS, _reset } = require("./rateLimit");

test.beforeEach(() => _reset());

test("cho đi đúng MAX_TURNS lượt, lượt kế tiếp bị chặn", () => {
  const now = Date.now();

  for (let i = 0; i < MAX_TURNS; i += 1) {
    const verdict = consume("user:1", now + i * 1000);
    assert.strictEqual(verdict.allowed, true, `lượt ${i + 1} phải được đi`);
    assert.strictEqual(verdict.remaining, MAX_TURNS - 1 - i);
  }

  const blocked = consume("user:1", now + MAX_TURNS * 1000);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
});

test("số phút còn lại đếm lùi theo thời gian thật", () => {
  const now = Date.now();
  for (let i = 0; i < MAX_TURNS; i += 1) consume("user:1", now);

  const ngay = consume("user:1", now);
  const sau5phut = consume("user:1", now + 5 * 60 * 1000);

  assert.ok(sau5phut.retryAfterMs < ngay.retryAfterMs, "chờ càng lâu thì càng gần tới lượt");
  assert.match(limitMessage(ngay.retryAfterMs), /sau 10 phút/);
  assert.match(limitMessage(sau5phut.retryAfterMs), /sau 5 phút/);
});

// Đây là điểm khác nhau giữa cửa sổ TRƯỢT và cửa sổ CỐ ĐỊNH, và là lý do phải
// nhớ mốc của từng lượt: hết cửa sổ KHÔNG phải là "được cấp lại đủ 20 lượt", mà
// là "lượt cũ nhất rời đi thì có đúng một chỗ trống".
test("cửa sổ trượt: hết giờ thì mở đúng một chỗ, không reset về đủ hạn mức", () => {
  const now = Date.now();

  // Rải mỗi lượt cách nhau 1 giây, đúng như một cuộc trò chuyện thật. Dồn cả 20
  // lượt vào CÙNG một mốc thì cả 20 cũng hết hạn cùng lúc — lúc đó cửa sổ mở ra
  // đủ 20 chỗ là đúng, và bài này sẽ không kiểm được thứ nó định kiểm.
  for (let i = 0; i < MAX_TURNS; i += 1) consume("user:1", now + i * 1000);

  // Ngay trước khi lượt đầu tiên rời cửa sổ: vẫn kín chỗ
  assert.strictEqual(consume("user:1", now + WINDOW_MS - 1).allowed, false);

  // Lượt đầu vừa rời đi → mở đúng MỘT chỗ
  const vuaKip = consume("user:1", now + WINDOW_MS + 1);
  assert.strictEqual(vuaKip.allowed, true);
  assert.strictEqual(vuaKip.remaining, 0, "chỉ một chỗ trống, không phải cấp lại cả hạn mức");

  const themMot = consume("user:1", now + WINDOW_MS + 2);
  assert.strictEqual(themMot.allowed, false, "chỗ trống đó đã dùng rồi");
});

test("hai tài khoản đếm riêng — em này hết lượt không làm em kia im", () => {
  const now = Date.now();
  for (let i = 0; i < MAX_TURNS; i += 1) consume("user:A", now);

  assert.strictEqual(consume("user:A", now).allowed, false);
  assert.strictEqual(consume("user:B", now).allowed, true);
});

// --- Lượt chào đếm riêng ----------------------------------------------------
//
// Đây là bài giữ đúng lời hứa "lượt chào được miễn": em vào chat, sang game rồi
// quay lại, hay tải lại trang vì mạng chập chờn — mấy lần đó không được ăn vào
// số câu em thật sự hỏi được.

test("dùng hết lượt chào KHÔNG làm mất lượt hỏi nào", () => {
  const now = Date.now();

  for (let i = 0; i < MAX_GREETINGS; i += 1) {
    assert.strictEqual(consume("user:1", now + i, "greeting").allowed, true);
  }
  assert.strictEqual(consume("user:1", now, "greeting").allowed, false, "chạm trần lượt chào");

  // Túi lượt hỏi vẫn còn nguyên vẹn
  const hoi = consume("user:1", now, "turn");
  assert.strictEqual(hoi.allowed, true);
  assert.strictEqual(hoi.remaining, MAX_TURNS - 1, "lượt chào không đụng tới hạn mức hỏi");
});

test("dùng hết lượt hỏi vẫn chào được — Larry vẫn mở lời khi em vào chat", () => {
  const now = Date.now();

  for (let i = 0; i < MAX_TURNS; i += 1) consume("user:1", now + i, "turn");
  assert.strictEqual(consume("user:1", now, "turn").allowed, false);

  assert.strictEqual(
    consume("user:1", now, "greeting").allowed,
    true,
    "hết lượt hỏi thì em vẫn vào được khung chat và nghe Larry chào"
  );
});

test("lượt chào cũng có trần — không phải cửa sau gọi model vô hạn", () => {
  const now = Date.now();

  for (let i = 0; i < MAX_GREETINGS; i += 1) consume("user:1", now + i, "greeting");

  const chan = consume("user:1", now + MAX_GREETINGS, "greeting");
  assert.strictEqual(chan.allowed, false);
  assert.strictEqual(chan.limit, MAX_GREETINGS);
  assert.match(limitMessage(chan.retryAfterMs), /Larry cần nghỉ ngơi/);
});

// Câu này hiện thẳng lên màn hình của học sinh, nên nó là một phần của giao diện
// chứ không phải một chuỗi log.
test("câu báo hết lượt: làm tròn LÊN và không bao giờ nói '0 phút'", () => {
  assert.match(limitMessage(0), /sau 1 phút/);
  assert.match(limitMessage(1000), /sau 1 phút/);
  assert.match(limitMessage(61 * 1000), /sau 2 phút/);
  assert.match(
    limitMessage(60 * 1000),
    /^Bạn hãy thử lại sau 1 phút! Larry cần nghỉ ngơi một chút rồi mình cùng tiếp tục nói chuyện nhé!$/
  );
});
