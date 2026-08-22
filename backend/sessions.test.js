const test = require("node:test");
const assert = require("node:assert");

const {
  createSession,
  normalizeSession,
  normalizeMessages,
  countMessages,
  toSessionMetadata,
  MAX_STORED_MESSAGES,
  MAX_STORED_MESSAGE_LENGTH
} = require("./sessions");

test("transcript chỉ giữ role hợp lệ và text đã giới hạn", () => {
  const messages = normalizeMessages([
    { role: "system", content: "bí mật hệ thống" },
    { role: "user", content: "  Xin chào  ", extra: true },
    { role: "assistant", content: "a".repeat(MAX_STORED_MESSAGE_LENGTH + 10) },
    { role: "user", content: "   " }
  ]);

  assert.deepStrictEqual(messages[0], { role: "user", content: "Xin chào" });
  assert.strictEqual(messages[1].role, "assistant");
  assert.strictEqual(messages[1].content.length, MAX_STORED_MESSAGE_LENGTH);
  assert.strictEqual(messages.length, 2);
});

test("transcript dài chỉ giữ 200 tin gần nhất", () => {
  const history = Array.from({ length: MAX_STORED_MESSAGES + 5 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `tin ${index}`
  }));

  const messages = normalizeMessages(history);

  assert.strictEqual(messages.length, MAX_STORED_MESSAGES);
  assert.strictEqual(messages[0].content, "tin 5");
  assert.strictEqual(countMessages(history), MAX_STORED_MESSAGES + 5);
});

test("phiên cũ thiếu transcript được bù mảng rỗng", () => {
  const old = normalizeSession({ id: "old", flagged: false, alerts: [] });
  assert.deepStrictEqual(old.messages, []);

  const fresh = createSession({ sessionId: "new", user: { id: 1, username: "hs1" } });
  assert.deepStrictEqual(fresh.messages, []);
});

test("metadata không làm lộ transcript", () => {
  const metadata = toSessionMetadata({ id: "s1", summary: "Tóm tắt", messages: [{ role: "user", content: "Nội dung" }] });

  assert.deepStrictEqual(metadata, { id: "s1", summary: "Tóm tắt" });
  assert.strictEqual("messages" in metadata, false);
});
