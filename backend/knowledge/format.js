#!/usr/bin/env node
// Định dạng lại các file trong graph/ theo một quy ước duy nhất.
//
//   node knowledge/format.js
//
// JSON.stringify chuẩn xuống dòng MỖI phần tử mảng, nên một node có 15 trigger
// chiếm 17 dòng và không còn đọc hết được trong một màn hình. Đây là file dữ
// liệu được sửa tay, nên mảng chuỗi được gói theo chiều rộng thay vì dàn dọc.
//
// Chạy sau khi sửa graph/ bằng script, hoặc khi định dạng đã lệch nhau giữa các file.

const fs = require("fs");
const path = require("path");

const { GRAPH_DIR } = require("./index");

const WIDTH = 100;

function format(value, indent) {
  const pad = " ".repeat(indent);
  const padIn = " ".repeat(indent + 2);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";

    // Mảng toàn chuỗi: gói theo chiều rộng
    if (value.every((v) => typeof v === "string")) {
      const inline = `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
      if (indent + inline.length <= WIDTH) return inline;

      const lines = [];
      let current = "";
      for (const item of value) {
        const piece = JSON.stringify(item);
        if (current && padIn.length + current.length + 2 + piece.length > WIDTH) {
          lines.push(current);
          current = "";
        }
        current = current ? `${current}, ${piece}` : piece;
      }
      if (current) lines.push(current);
      return `[\n${lines.map((l) => padIn + l).join(",\n")}\n${pad}]`;
    }

    return `[\n${value.map((v) => padIn + format(v, indent + 2)).join(",\n")}\n${pad}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";

    // Object phẳng và ngắn (cạnh, khối source) viết gọn trên một dòng
    const inline = `{ ${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(value[k])}`).join(", ")} }`;
    if (keys.every((k) => typeof value[k] !== "object") && indent + inline.length <= WIDTH) {
      return inline;
    }

    return `{\n${keys
      .map((k) => `${padIn}${JSON.stringify(k)}: ${format(value[k], indent + 2)}`)
      .join(",\n")}\n${pad}}`;
  }

  return JSON.stringify(value);
}

const files = fs.readdirSync(GRAPH_DIR).filter((f) => f.endsWith(".json")).sort();

for (const file of files) {
  const full = path.join(GRAPH_DIR, file);
  const before = fs.readFileSync(full, "utf8");
  const after = `${format(JSON.parse(before), 0)}\n`;

  if (before === after) {
    console.log(`  không đổi  graph/${file}`);
    continue;
  }
  fs.writeFileSync(full, after);
  console.log(`  đã sửa     graph/${file}`);
}
