#!/usr/bin/env node
//
// Tạo tài khoản quản trị viên. Đây là CÁCH DUY NHẤT để cấp quyền admin —
// không đăng ký được từ web, không tự tạo lúc khởi động, và quản trị viên
// cũng không nâng quyền cho người khác được từ giao diện.
//
//   npm run create-admin
//   npm run create-admin -- --username admin2 --email co.lan@truong.edu.vn
//
// Bỏ trống tham số nào thì script sẽ hỏi. Mật khẩu luôn được hỏi trực tiếp
// để không lọt vào lịch sử shell.

require("dotenv").config();
const readline = require("readline");
const { ACCOUNTS_FILE, ROLES, loadUsers, saveUsers, addAdmin } = require("./accounts");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    const key = match[1];
    args[key] = match[2] !== undefined ? match[2] : argv[++i] ?? "";
  }
  return args;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

// Không echo ký tự khi gõ mật khẩu
function askPassword(rl, question) {
  return new Promise((resolve) => {
    const onKeypress = (char) => {
      if (char === "\n" || char === "\r" || char === "") return;
      readline.moveCursor(process.stdout, -1, 0);
      readline.clearLine(process.stdout, 1);
      process.stdout.write("*");
    };

    process.stdin.on("data", onKeypress);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onKeypress);
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const users = loadUsers();

    console.log(`\nTạo tài khoản quản trị viên`);
    console.log(`File tài khoản: ${ACCOUNTS_FILE}`);
    const adminCount = users.filter((u) => u.role === ROLES.ADMIN).length;
    console.log(`Hiện có: ${users.length} tài khoản (${adminCount} quản trị viên)\n`);

    const username = args.username || (await ask(rl, "Tên đăng nhập: "));
    const email = args.email || (await ask(rl, "Email: "));
    const password = args.password || (await askPassword(rl, "Mật khẩu (tối thiểu 8 ký tự): "));

    if (!args.password) {
      const confirm = await askPassword(rl, "Nhập lại mật khẩu: ");
      if (confirm !== password) throw new Error("Hai lần nhập mật khẩu không khớp.");
    }

    const admin = addAdmin(users, { username, email, password });
    saveUsers(users);

    console.log(`\n✅ Đã tạo quản trị viên: ${admin.username} <${admin.email}> (id ${admin.id})`);
    console.log(`   Đăng nhập tại trang /login, chọn "Bạn là" → Quản trị viên.`);
    console.log(`\n⚠️  Nếu backend đang chạy, hãy khởi động lại để nạp tài khoản mới.\n`);
  } catch (err) {
    console.error(`\n❌ ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
