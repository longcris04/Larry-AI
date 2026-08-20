// Bài kiểm tra cho các công tắc quản trị viên bật/tắt được.
//
//   node --test settings.test.js        (hoặc: npm run test:settings)
//
// Dùng bộ chạy test có sẵn của Node, không thêm thư viện nào — giống
// rateLimit.test.js, backend cố ý giữ danh sách phụ thuộc mỏng.
//
// Mỗi bài chạy trên MỘT file settings.json riêng trong thư mục tạm, và nạp lại
// module bằng cách xoá cache require: settings.js đọc đường dẫn ra một hằng số
// lúc nạp, nên không nạp lại thì mọi bài dùng chung một file và bài sau thấy
// những gì bài trước ghi.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Nạp settings.js sạch, trỏ vào một file mới tinh. Trả kèm đường dẫn để bài kiểm
// tra đọc thẳng đĩa — thứ ghi xuống đĩa mới là thứ sống sót qua lần deploy sau,
// và đó chính là điều đáng kiểm.
function freshSettings(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "larry-settings-"));
  const file = path.join(dir, "settings.json");
  if (initial !== undefined) fs.writeFileSync(file, initial, "utf8");

  process.env.SETTINGS_FILE = file;
  delete require.cache[require.resolve("./settings")];

  return { settings: require("./settings"), file };
}

function onDisk(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

test("chưa có file thì cả hai công tắc đều BẬT", () => {
  const { settings } = freshSettings();

  assert.strictEqual(settings.isGuestModeEnabled(), true);
  assert.strictEqual(settings.isTtsEnabled(), true);
});

test("tắt giọng đọc ghi được xuống đĩa và không đụng tới chế độ khách", () => {
  const { settings, file } = freshSettings();

  const next = settings.setTtsEnabled(false);

  assert.strictEqual(next.ttsEnabled, false);
  assert.strictEqual(next.guestMode, true);
  assert.strictEqual(settings.isTtsEnabled(), false);
  assert.strictEqual(settings.isGuestModeEnabled(), true, "tắt loa không được khoá cửa vào");
  assert.deepStrictEqual(onDisk(file), { guestMode: true, ttsEnabled: false });
});

// Đây là lý do phải ghi ra đĩa chứ không giữ mỗi trong bộ nhớ: quản trị viên tắt
// loa để đỡ tốn token, rồi máy chủ khởi động lại (deploy, hết RAM, Render ngủ dậy)
// — nếu công tắc tự BẬT lại thì tiền cứ chảy mà không ai bấm gì cả.
test("công tắc sống sót qua lần khởi động lại", () => {
  const { settings, file } = freshSettings();
  settings.setTtsEnabled(false);

  // Nạp lại như thể tiến trình vừa khởi động lại, đọc đúng file cũ
  process.env.SETTINGS_FILE = file;
  delete require.cache[require.resolve("./settings")];
  const reloaded = require("./settings");

  assert.strictEqual(reloaded.isTtsEnabled(), false);
});

test("chỉ nhận boolean — chuỗi 'false' bị chặn ngay, không ghi gì xuống đĩa", () => {
  const { settings, file } = freshSettings();

  assert.throws(() => settings.setTtsEnabled("false"), /true hoặc false/);
  assert.throws(() => settings.setTtsEnabled(0), /true hoặc false/);
  assert.strictEqual(fs.existsSync(file), false, "gọi hỏng thì không được tạo file");
  assert.strictEqual(settings.isTtsEnabled(), true);
});

// File sửa tay hỏng thì rơi về mặc định chứ KHÔNG làm chết máy chủ — mất cài đặt
// còn chạy được, còn chết lúc khởi động vì một dấu phẩy thì cả dịch vụ nằm im.
test("file hỏng hoặc kiểu sai đều rơi về mặc định", () => {
  const hong = freshSettings("{ đây không phải JSON");
  assert.strictEqual(hong.settings.isTtsEnabled(), true);

  // "false" là CHUỖI, không phải boolean — không được hiểu thành tắt
  const kieuSai = freshSettings(JSON.stringify({ ttsEnabled: "false" }));
  assert.strictEqual(kieuSai.settings.isTtsEnabled(), true);
});

test("file cũ chỉ có guestMode vẫn đọc được, ttsEnabled lấy mặc định", () => {
  // Đúng nội dung settings.json của những nơi đã chạy trước khi có công tắc loa
  const { settings } = freshSettings(JSON.stringify({ guestMode: false }));

  assert.strictEqual(settings.isGuestModeEnabled(), false, "lựa chọn cũ phải giữ nguyên");
  assert.strictEqual(settings.isTtsEnabled(), true);
});

test("getPublicSettings trả cả hai công tắc, không trả gì khác", () => {
  const { settings } = freshSettings();
  settings.setTtsEnabled(false);

  assert.deepStrictEqual(settings.getPublicSettings(), { guestMode: true, ttsEnabled: false });
});
