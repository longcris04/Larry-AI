const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RENDER_DATA_DIR, resolveDataFile, ensureDataDirectory } = require("./dataFiles");

test("chọn đúng nơi lưu ở local, DATA_DIR và Render", () => {
  const previous = {
    RENDER: process.env.RENDER,
    DATA_DIR: process.env.DATA_DIR,
    SESSIONS_FILE: process.env.SESSIONS_FILE
  };

  try {
    delete process.env.RENDER;
    delete process.env.DATA_DIR;
    delete process.env.SESSIONS_FILE;
    assert.strictEqual(resolveDataFile("SESSIONS_FILE", "sessions.json"), path.join(__dirname, "sessions.json"));

    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larry-data-"));
    process.env.DATA_DIR = dataDir;
    assert.strictEqual(resolveDataFile("SESSIONS_FILE", "sessions.json"), path.join(dataDir, "sessions.json"));

    process.env.SESSIONS_FILE = path.join(dataDir, "custom.json");
    assert.strictEqual(resolveDataFile("SESSIONS_FILE", "sessions.json"), path.join(dataDir, "custom.json"));

    delete process.env.SESSIONS_FILE;
    delete process.env.DATA_DIR;
    process.env.RENDER = "true";
    assert.strictEqual(
      resolveDataFile("SESSIONS_FILE", "sessions.json"),
      path.join(RENDER_DATA_DIR, "sessions.json")
    );

    const nestedFile = path.join(dataDir, "nested", "sessions.json");
    ensureDataDirectory(nestedFile);
    assert.strictEqual(fs.existsSync(path.dirname(nestedFile)), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
