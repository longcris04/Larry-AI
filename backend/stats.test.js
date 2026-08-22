// Bài kiểm tra cho hai nhóm số liệu chia theo khối lớp và theo mức độ dùng.
//
//   node --test stats.test.js        (hoặc: npm run test:stats)
//
// Dùng bộ chạy test có sẵn của Node, không thêm thư viện nào — giống
// rateLimit.test.js và settings.test.js.
//
// Vì sao ĐÁNG kiểm đúng hai nhóm này, trong khi mấy ô đếm khác của stats.js
// không có bài nào: chúng là chỗ duy nhất trong file có phần SUY RA thay vì cộng
// thẳng. Khối lớp phải đoán từ chuỗi các em tự gõ ("Lớp 7", "8T1.1"), và mức độ
// dùng phải gom phiên về từng em rồi mới xếp khung — hai chỗ mà một lỗi lệch
// khung hay lệch cách đọc chuỗi sẽ cho ra con số trông vẫn hợp lý, không có
// ngoại lệ nào ném lên, và không ai phát hiện ra.

const test = require("node:test");
const assert = require("node:assert");

const { resolveRange, buildStats, gradeOf, usageBucket } = require("./stats");

const RANGE = resolveRange({ from: "2026-08-01", to: "2026-08-10" });

// Ngày trong khoảng, giờ chọn giữa trưa giờ Việt Nam để không bài nào vô tình
// phụ thuộc vào chỗ cắt ngày.
const at = (day, hour = "05") => `2026-08-${day}T${hour}:00:00Z`;

function student(id, { grade = "", school = "", className = "", created = "02" } = {}) {
  return {
    id,
    role: "user",
    username: `hs${id}`,
    status: "approved",
    createdAt: at(created),
    profile: { fullName: "", grade, school, className, dateOfBirth: "" }
  };
}

function session(id, userId, day, hour = "05") {
  return {
    id,
    userId,
    startedAt: at(day, hour),
    endedAt: at(day, hour),
    messageCount: 3,
    flagged: false,
    riskLevel: "none",
    categories: [],
    alerts: []
  };
}

// n lượt của cùng một em trong cùng một ngày
function sessions(userId, day, count) {
  return Array.from({ length: count }, (_, i) =>
    session(`s-${userId}-${day}-${i}`, userId, day, String(i % 20).padStart(2, "0"))
  );
}

// --- Đọc khối từ chuỗi các em tự gõ ------------------------------------------

test("khối đọc được dù gõ kiểu nào", () => {
  assert.strictEqual(gradeOf({ profile: { grade: "6" } }), "6");
  assert.strictEqual(gradeOf({ profile: { grade: "Lớp 7" } }), "7");
  assert.strictEqual(gradeOf({ profile: { grade: " khối 8 " } }), "8");
});

test("bỏ trống ô khối thì suy ra từ tên lớp", () => {
  assert.strictEqual(gradeOf({ profile: { grade: "", className: "9A6" } }), "9");
  assert.strictEqual(gradeOf({ profile: { grade: "", className: "8T1.1" } }), "8");
});

// Trường có cả cấp 3, hoặc hồ sơ chưa khai gì — cả hai đều KHÔNG được rơi vào
// một trong bốn ô 6/7/8/9, vì bốn ô đó phải luôn đúng nghĩa của nó.
test("ngoài 6–9 và chưa khai đều vào ô khác", () => {
  assert.strictEqual(gradeOf({ profile: { grade: "Lớp 10", className: "10A4" } }), "other");
  assert.strictEqual(gradeOf({ profile: { grade: "", className: "" } }), "other");
  assert.strictEqual(gradeOf({ profile: { grade: "", className: "A1" } }), "other");
});

// --- Bốn khung mức độ dùng ---------------------------------------------------

test("bốn khung phủ kín và không chồng lên nhau", () => {
  assert.strictEqual(usageBucket(1), "once");
  assert.strictEqual(usageBucket(2), "light");
  assert.strictEqual(usageBucket(5), "light");
  assert.strictEqual(usageBucket(6), "regular");
  assert.strictEqual(usageBucket(10), "regular");
  assert.strictEqual(usageBucket(11), "heavy");
  assert.strictEqual(usageBucket(500), "heavy");
});

// --- Tài khoản học sinh theo khối --------------------------------------------

test("đếm theo khối, và tổng khớp với ô tài khoản học sinh ở đầu trang", () => {
  const users = [
    student(1, { grade: "6", school: "THCS A", className: "6A1" }),
    student(2, { grade: "Lớp 7", school: "thcs a ", className: "7B1" }), // trùng trường, gõ khác kiểu
    student(3, { grade: "", school: "THCS B", className: "8T1.1" }),
    student(4, { grade: "9", school: "THCS B", className: "9A6" }),
    student(5, { grade: "Lớp 10", school: "", className: "10A4" }),
    { id: 6, role: "teacher", username: "gv", status: "approved", createdAt: at("01"), profile: { school: "THCS A", className: "6A1", grade: "" } },
    { id: 7, role: "admin", username: "ad", createdAt: at("01"), profile: {} }
  ];

  const { accounts, byGrade } = buildStats(users, [], RANGE);

  assert.deepStrictEqual(byGrade.total, { 6: 1, 7: 1, 8: 1, 9: 1, other: 1, all: 5 });
  // Hai con số cùng nói về học sinh mà lệch nhau thì không ai biết tin cái nào
  assert.strictEqual(byGrade.total.all, accounts.students);

  // Tên trường gõ lệch khoảng trắng/hoa thường vẫn là MỘT trường
  assert.strictEqual(byGrade.bySchool.length, 2);
  const a = byGrade.bySchool.find((row) => row.school === "THCS A");
  assert.deepStrictEqual([a[6], a[7], a.all], [1, 1, 2]);

  // Em chưa khai trường không có dòng nào, nên phải đếm riêng
  assert.strictEqual(byGrade.withoutSchool, 1);

  // Ô "khác" tự khai nó gồm những gì
  assert.deepStrictEqual(byGrade.otherLabels, [{ label: "Lớp 10", count: 1 }]);
});

test("khoảng ngày không xoá đi những em đã có từ trước", () => {
  const users = [
    student(1, { grade: "6", school: "THCS A", created: "02" }), // trong khoảng
    student(2, { grade: "6", school: "THCS A", created: "02" }),
    student(3, { grade: "7", school: "THCS A", created: "05" })
  ];
  // Khoảng chỉ phủ ngày 04–10: hai em ngày 02 vẫn phải nằm trong tổng cộng dồn,
  // chỉ không được tính là "mới".
  const range = resolveRange({ from: "2026-08-04", to: "2026-08-10" });
  const { byGrade } = buildStats(users, [], range);

  assert.strictEqual(byGrade.total.all, 3);
  assert.strictEqual(byGrade.created.all, 1);
  assert.strictEqual(byGrade.created[7], 1);
  assert.strictEqual(byGrade.created[6], 0);
  assert.strictEqual(byGrade.bySchool[0].created, 1);
});

test("hàng tổng quan chỉ đếm tài khoản, lớp và trường trong khoảng ngày", () => {
  const teacher = (id, school, className, created, status = "approved") => ({
    id,
    role: "teacher",
    username: `gv${id}`,
    status,
    createdAt: at(created),
    profile: { school, className, grade: "" }
  });
  const users = [
    student(1, { school: "THCS A", className: "6A1", created: "02" }),
    student(2, { school: "THCS A", className: "6A2", created: "05" }),
    teacher(3, "THCS A", "6A2", "02"),
    teacher(4, "THCS B", "7B1", "06"),
    teacher(5, "THCS B", "7B2", "07", "pending"),
    student(6, { school: "THCS C", className: "8C1", created: "02" })
  ];
  const range = resolveRange({ from: "2026-08-04", to: "2026-08-10" });

  const { accounts, classes } = buildStats(users, [], range);

  assert.deepStrictEqual(
    [accounts.newStudents, accounts.newTeachers],
    [1, 2]
  );
  assert.deepStrictEqual(
    [accounts.newTeachersApproved, accounts.newTeachersPending],
    [1, 1]
  );
  assert.deepStrictEqual(
    [classes.inRange, classes.schoolsInRange, classes.withTeacherInRange],
    [3, 2, 2]
  );
  assert.deepStrictEqual([classes.total, classes.schools], [5, 3]);
});

test("theo từng ngày: đủ mọi ngày trong khoảng, kể cả ngày không ai đăng ký", () => {
  const users = [
    student(1, { grade: "6", school: "THCS A", created: "02" }),
    student(2, { grade: "9", school: "THCS A", created: "05" })
  ];

  const { byGrade } = buildStats(users, [], RANGE);

  assert.strictEqual(byGrade.daily.length, 10);
  const d02 = byGrade.daily.find((d) => d.date === "2026-08-02");
  const d03 = byGrade.daily.find((d) => d.date === "2026-08-03");
  assert.deepStrictEqual([d02[6], d02.all], [1, 1]);
  assert.strictEqual(d03.all, 0); // ngày trống vẫn phải có mặt
  assert.strictEqual(
    byGrade.daily.reduce((sum, d) => sum + d.all, 0),
    byGrade.created.all
  );
});

// --- Mức độ sử dụng ----------------------------------------------------------

test("mỗi em vào đúng một khung theo số lượt của em", () => {
  const users = [
    student(1, { grade: "6", school: "THCS A" }),
    student(2, { grade: "6", school: "THCS A" }),
    student(3, { grade: "8", school: "THCS B" }),
    student(4, { grade: "9", school: "THCS B" }),
    student(5, { grade: "9", school: "THCS B" }) // chưa vào lần nào
  ];

  const all = [
    ...sessions(1, "05", 1), // 1 lượt
    ...sessions(2, "05", 3), // 3 lượt → 2–5
    ...sessions(3, "06", 7), // 7 lượt → 6–10
    ...sessions(4, "07", 12) // 12 lượt → trên 10
  ];

  const { usage } = buildStats(users, all, RANGE);

  assert.strictEqual(usage.total.once, 1);
  assert.strictEqual(usage.total.light, 1);
  assert.strictEqual(usage.total.regular, 1);
  assert.strictEqual(usage.total.heavy, 1);

  // Bốn khung cộng lại đúng bằng số em CÓ DÙNG — đơn vị đếm là em, không phải lượt
  assert.strictEqual(usage.total.users, 4);
  assert.strictEqual(usage.total.sessions, 23);

  // Em chưa vào lần nào không thuộc khung nào, đếm riêng
  assert.strictEqual(usage.total.students, 5);
  assert.strictEqual(usage.total.none, 1);
});

test("trường chưa em nào vào vẫn có dòng riêng", () => {
  const users = [
    student(1, { grade: "6", school: "THCS A" }),
    student(2, { grade: "6", school: "THCS B" }),
    student(3, { grade: "7", school: "THCS B" })
  ];

  const { usage } = buildStats(users, sessions(1, "05", 2), RANGE);

  const b = usage.bySchool.find((row) => row.school === "THCS B");
  assert.ok(b, "trường chưa ai dùng vẫn phải có mặt — đó mới là dòng đáng đi hỏi");
  assert.strictEqual(b.users, 0);
  assert.strictEqual(b.students, 2);
  assert.strictEqual(b.none, 2);

  const a = usage.bySchool.find((row) => row.school === "THCS A");
  assert.strictEqual(a.light, 1);
  assert.strictEqual(a.sessions, 2);
});

// Cộng dồn cả khoảng rồi rải ra từng ngày là sai — mỗi ngày phải xếp khung lại
// từ đầu, nếu không thì con số của một ngày không còn nghĩa gì.
test("theo từng ngày: mỗi ngày xếp khung lại từ đầu", () => {
  const users = [student(1, { grade: "6", school: "THCS A" })];
  const all = [
    ...sessions(1, "05", 3), // hôm 05: 3 lượt → 2–5
    ...sessions(1, "06", 1) // hôm 06: 1 lượt → 1 lần
  ];

  const { usage } = buildStats(users, all, RANGE);

  const d05 = usage.daily.find((d) => d.date === "2026-08-05");
  const d06 = usage.daily.find((d) => d.date === "2026-08-06");

  assert.deepStrictEqual([d05.once, d05.light, d05.users], [0, 1, 1]);
  assert.deepStrictEqual([d06.once, d06.light, d06.users], [1, 0, 1]);

  // Cả khoảng thì vẫn là MỘT em với 4 lượt → nhóm 2–5, không phải hai em
  assert.strictEqual(usage.total.users, 1);
  assert.strictEqual(usage.total.light, 1);
  assert.strictEqual(usage.total.sessions, 4);
});

// Khoảng ngày nằm hẳn trong quá khứ: số em đang có (cộng dồn tới hôm nay) lớn
// hơn số em từng vào trong khoảng đó — bình thường, nhưng "chưa dùng" không được
// phép ra số âm.
test("chưa dùng không bao giờ ra số âm", () => {
  const users = [student(1, { grade: "6", school: "THCS A", created: "02" })];
  // Phiên của một tài khoản đã bị xoá: có thật, nhưng không quy về trường nào
  const orphan = [session("x1", 999, "05"), session("x2", 998, "05")];

  const { usage } = buildStats(users, orphan, RANGE);

  assert.strictEqual(usage.total.students, 1);
  assert.strictEqual(usage.total.users, 2);
  assert.strictEqual(usage.total.none, 0);
});
