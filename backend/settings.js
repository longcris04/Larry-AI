// Cài đặt vận hành mà QUẢN TRỊ VIÊN bật/tắt được từ giao diện, khác với biến
// môi trường trong .env — thứ chỉ người có quyền vào máy chủ mới sửa được và
// phải khởi động lại mới ăn.
//
// Lưu ra settings.json theo đúng cách account.json làm: ghi ra file tạm rồi đổi
// tên, để server tắt giữa chừng không để lại một file JSON cụt.
//
// Giữ trong bộ nhớ một bản (`cache`) vì mỗi lần mở trang đăng nhập là một lần
// đọc — đọc đĩa cho từng lượt khách vào là phí. Chỉ có tiến trình này ghi file
// nên bản trong bộ nhớ không bao giờ lệch với đĩa.

const fs = require("fs");
const path = require("path");

// Nơi lưu. Thứ tự ưu tiên:
//
//   1. SETTINGS_FILE — khai thẳng thì nghe theo, không bàn.
//   2. CÙNG THƯ MỤC với ACCOUNTS_FILE — chỗ deploy thật gắn ổ đĩa lâu dài (Render
//      disk ở /var/data chẳng hạn) đã trỏ ACCOUNTS_FILE vào đó rồi; cài đặt cũng
//      là dữ liệu chạy máy nên phải nằm cùng chỗ với tài khoản, không phải trong
//      thư mục mã nguồn — thư mục đó bị dựng lại mới sau MỖI lần deploy.
//
//      Không có bước này thì lỗi xảy ra hoàn toàn im lặng: quản trị viên tắt chế
//      độ khách, deploy một bản vá bất kỳ, và chế độ khách tự BẬT lại mà không ai
//      bấm gì. Đúng loại lỗi chỉ lộ ra trên máy chủ thật.
//   3. Cạnh mã nguồn — chỉ đúng khi chạy ở máy cá nhân.
function resolveSettingsFile() {
  if (process.env.SETTINGS_FILE) return path.resolve(process.env.SETTINGS_FILE);

  if (process.env.ACCOUNTS_FILE) {
    return path.join(path.dirname(path.resolve(process.env.ACCOUNTS_FILE)), "settings.json");
  }

  return path.join(__dirname, "settings.json");
}

const SETTINGS_FILE = resolveSettingsFile();

// guestMode MẶC ĐỊNH BẬT: đây là hành vi đã có từ trước khi có công tắc này.
// Để mặc định tắt thì chỉ cần nâng cấp mã nguồn là nút "Trò chuyện với Larry
// ngay" tự biến mất ở mọi nơi đang chạy, không ai bấm gì cả — một thay đổi âm
// thầm đúng kiểu khó lần ra.
const DEFAULTS = {
  guestMode: true
};

let cache = null;

// File hỏng hay thiếu field thì lấy mặc định bù vào, KHÔNG ném lỗi: mất cài đặt
// còn chạy được, còn chết lúc khởi động vì một file JSON gõ nhầm dấu phẩy thì cả
// dịch vụ nằm im.
function readFromDisk() {
  let raw;
  try {
    raw = fs.readFileSync(SETTINGS_FILE, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`⚠️  Không đọc được ${path.basename(SETTINGS_FILE)}: ${err.message}`);
    }
    return { ...DEFAULTS };
  }

  if (!raw.trim()) return { ...DEFAULTS };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("nội dung không phải object");
    }
    return {
      ...DEFAULTS,
      // Chỉ nhận đúng kiểu boolean. Ai đó sửa tay thành "false" (chuỗi) thì rơi
      // về mặc định, chứ không thành true vì chuỗi rỗng khác rỗng.
      ...(typeof parsed.guestMode === "boolean" ? { guestMode: parsed.guestMode } : {})
    };
  } catch (err) {
    console.warn(
      `⚠️  ${path.basename(SETTINGS_FILE)} không đọc được (${err.message}) — dùng cài đặt mặc định.`
    );
    return { ...DEFAULTS };
  }
}

function writeToDisk(next) {
  const tempFile = `${SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tempFile, SETTINGS_FILE);
}

function getSettings() {
  if (!cache) cache = readFromDisk();
  return { ...cache };
}

// Phần cài đặt mà NGƯỜI CHƯA ĐĂNG NHẬP được biết. Trang đăng nhập cần đọc nó để
// quyết định có vẽ nút vào chat không, nên nó nằm sau một route công khai — vì
// vậy ở đây chỉ trả đúng những gì không nhạy cảm, đừng trả nguyên object.
function getPublicSettings() {
  return { guestMode: getSettings().guestMode };
}

function isGuestModeEnabled() {
  return getSettings().guestMode;
}

/**
 * Bật/tắt chế độ khách.
 * @param {boolean} enabled
 * @returns {object} cài đặt sau khi đổi
 */
function setGuestMode(enabled) {
  if (typeof enabled !== "boolean") {
    throw new Error("guestMode phải là true hoặc false.");
  }

  const next = { ...getSettings(), guestMode: enabled };
  writeToDisk(next);
  cache = next;
  return { ...next };
}

module.exports = {
  SETTINGS_FILE,
  DEFAULTS,
  getSettings,
  getPublicSettings,
  isGuestModeEnabled,
  setGuestMode
};
