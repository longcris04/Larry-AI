const fs = require("fs");
const path = require("path");

const RENDER_DATA_DIR = "/var/data";

// Thứ tự ưu tiên: đường dẫn riêng của từng file -> DATA_DIR dùng chung -> disk
// Render -> file cạnh mã nguồn khi chạy local. Render luôn cấp RENDER=true ở
// runtime; /var/data là mount path của disk dự án này.
function resolveDataFile(envName, fileName) {
  if (process.env[envName]) return path.resolve(process.env[envName]);

  if (process.env.DATA_DIR) {
    return path.join(path.resolve(process.env.DATA_DIR), fileName);
  }

  if (process.env.RENDER === "true") {
    return path.join(RENDER_DATA_DIR, fileName);
  }

  return path.join(__dirname, fileName);
}

function ensureDataDirectory(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

module.exports = { RENDER_DATA_DIR, resolveDataFile, ensureDataDirectory };
