const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findUsersOfCounselorSchool,
  findStudentsOfCounselorSchool,
  findSessionsOfCounselorSchool
} = require("./counselors");
const { requireCounselor } = require("./auth");

const counselor = { id: 10, role: "counselor", profile: { school: " THCS Nguyễn Du " } };
const users = [
  counselor,
  { id: 1, role: "user", profile: { school: "thcs nguyễn du" } },
  { id: 2, role: "teacher", profile: { school: "THCS Nguyễn Du" } },
  { id: 3, role: "user", profile: { school: "THCS Trưng Vương" } },
  { id: 4, role: "admin", profile: { school: "THCS Nguyễn Du" } }
];
const sessions = [
  { id: "mine", userId: 1 },
  { id: "teacher", userId: 2 },
  { id: "outside", userId: 3 }
];

test("counselor scope includes non-admin accounts from the same school", () => {
  assert.deepEqual(findUsersOfCounselorSchool(users, counselor).map((u) => u.id), [10, 1, 2]);
});

test("counselor sessions include students from the same school only", () => {
  assert.deepEqual(findStudentsOfCounselorSchool(users, counselor).map((u) => u.id), [1]);
  assert.deepEqual(findSessionsOfCounselorSchool(users, sessions, counselor), [sessions[0]]);
});

test("middleware kiểm tra lại trạng thái duyệt từ account hiện tại", () => {
  const request = { user: { id: 10, role: "counselor" } };
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextCalled = false;

  requireCounselor(() => ({ ...counselor, status: "rejected" }))(
    request,
    response,
    () => { nextCalled = true; }
  );

  assert.strictEqual(response.statusCode, 403);
  assert.strictEqual(nextCalled, false);
});
