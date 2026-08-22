const test = require("node:test");
const assert = require("node:assert");

const { findStudentsOfTeacher, findSessionsOfTeacher } = require("./teachers");

const teacher = {
  id: 10,
  role: "teacher",
  status: "approved",
  profile: { school: " THCS A ", className: "6a1" }
};

const users = [
  teacher,
  { id: 1, role: "user", profile: { school: "THCS A", className: "6A1" } },
  { id: 2, role: "user", profile: { school: "THCS A", className: "6A2" } },
  { id: 3, role: "user", profile: { school: "THCS B", className: "6A1" } }
];

test("scope giáo viên chỉ gồm học sinh và phiên cùng trường, cùng lớp", () => {
  assert.deepStrictEqual(findStudentsOfTeacher(users, teacher).map((user) => user.id), [1]);

  const scoped = findSessionsOfTeacher(
    users,
    [
      { id: "mine", userId: 1 },
      { id: "other-class", userId: 2 },
      { id: "other-school", userId: 3 }
    ],
    teacher
  );

  assert.deepStrictEqual(scoped.map((session) => session.id), ["mine"]);
});
