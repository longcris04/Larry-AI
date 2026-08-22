const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createSession,
  normalizeSession,
  normalizeMessages,
  countMessages,
  toSessionMetadata
} = require("./sessions");

test("transcript giữ nguyên đầy đủ text của role hợp lệ", () => {
  const longAnswer = "a".repeat(10_000);
  const messages = normalizeMessages([
    { role: "system", content: "bí mật hệ thống" },
    { role: "user", content: "  Xin chào  ", extra: true },
    { role: "assistant", content: longAnswer },
    { role: "user", content: "   " }
  ]);

  assert.deepStrictEqual(messages[0], { role: "user", content: "  Xin chào  " });
  assert.deepStrictEqual(messages[1], { role: "assistant", content: longAnswer });
  assert.strictEqual(messages.length, 2);
});

test("transcript không bỏ tin nhắn cũ khi phiên dài", () => {
  const history = Array.from({ length: 405 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `tin ${index}`
  }));

  const messages = normalizeMessages(history);

  assert.strictEqual(messages.length, 405);
  assert.strictEqual(messages[0].content, "tin 0");
  assert.strictEqual(messages[404].content, "tin 404");
  assert.strictEqual(countMessages(history), 405);
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

test("file phiên cũ giữ nguyên summary và nhận thêm transcript sau khi ghi lại", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "larry-sessions-"));
  const file = path.join(dir, "sessions.json");
  const oldSession = {
    id: "old",
    userId: 1,
    username: "hs1",
    summary: "Tóm tắt cũ",
    flagged: false,
    alerts: []
  };
  fs.writeFileSync(file, JSON.stringify([oldSession]), "utf8");

  const previous = process.env.SESSIONS_FILE;
  process.env.SESSIONS_FILE = file;
  delete require.cache[require.resolve("./sessions")];
  const freshSessions = require("./sessions");

  try {
    const loaded = freshSessions.loadSessions();
    assert.strictEqual(loaded[0].summary, "Tóm tắt cũ");
    assert.deepStrictEqual(loaded[0].messages, []);

    loaded[0].messages = [
      { role: "user", content: "Em đang buồn" },
      { role: "assistant", content: "Larry đang nghe đây" }
    ];
    freshSessions.saveSessions(loaded);

    const reloaded = freshSessions.loadSessions();
    assert.strictEqual(reloaded[0].summary, "Tóm tắt cũ");
    assert.deepStrictEqual(reloaded[0].messages, loaded[0].messages);
  } finally {
    if (previous === undefined) delete process.env.SESSIONS_FILE;
    else process.env.SESSIONS_FILE = previous;
    delete require.cache[require.resolve("./sessions")];
  }
});
