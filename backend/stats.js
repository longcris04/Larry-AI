// Số liệu tổng hợp cho bảng điều khiển của quản trị viên (xem /api/admin/stats).
//
// Vì sao tách hẳn thành một file: toàn bộ phần dưới đây là TÍNH TOÁN THUẦN —
// không đọc đĩa, không đụng tới req/res. Gọi buildStats(users, sessions, range)
// là ra kết quả, nên kiểm chứng lại được bằng dữ liệu bịa ra mà không cần dựng
// cả máy chủ. server.js đã dài, và phần này còn dài thêm mỗi lần có thêm một ô
// thống kê mới.
//
// Hai quy ước xuyên suốt, cần đọc trước khi sửa bất cứ chỗ nào bên dưới:
//
// 1. LỚP của một hội thoại suy ra từ hồ sơ CHỦ tài khoản (session.userId →
//    user.profile), chứ không lưu trong bản ghi phiên. Hệ quả: học sinh chuyển
//    lớp thì mọi hội thoại cũ của em đi theo lớp mới. Chấp nhận được, vì thứ
//    quản trị viên cần là "lớp này ĐANG có bao nhiêu chuyện", không phải hồ sơ
//    lịch sử của từng lớp. Muốn khác đi thì phải ghi trường/lớp vào lúc tạo
//    phiên — đó là một thay đổi về dữ liệu, không phải về cách đếm.
//
// 2. Khoá nhóm lớp dùng LẠI classKey của teachers.js, không tự viết bản khác.
//    Nếu hai chỗ chuẩn hoá tên lớp khác nhau thì bảng điều khiển sẽ báo "12 lớp"
//    trong khi cơ chế ghép giáo viên–học sinh chỉ thấy 10, và không ai biết con
//    số nào đúng.

const { ROLES, STATUS } = require("./accounts");
const { classKey } = require("./teachers");

// Mốc ngày tính theo giờ Việt Nam, không phải UTC. Một em nhắn lúc 1 giờ sáng
// ngày 3 (giờ VN) được ghi là 18:00 ngày 2 theo UTC — cắt ngày bằng UTC thì hội
// thoại đó rơi nhầm sang hôm trước, và biểu đồ theo ngày lệch đúng vào khung giờ
// đáng chú ý nhất.
//
// Dùng một hằng số bù phút thay vì Intl/timeZone: Việt Nam không có giờ mùa hè
// nên +7 luôn đúng, và cách này không phụ thuộc vào việc Node được build kèm bộ
// dữ liệu ICU đầy đủ hay không.
const TZ_OFFSET_MINUTES = Number(process.env.REPORT_TZ_OFFSET_MINUTES ?? 420);

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Chặn trên cho số ngày trả về. Không có nó thì một tham số ?from=1970-01-01 đủ
// để dựng mảng hai vạn phần tử rồi đẩy hết xuống trình duyệt.
const MAX_RANGE_DAYS = 370;

/** Mốc ngày "yyyy-mm-dd" theo giờ Việt Nam của một mốc thời gian ISO. */
function dayKey(value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  return new Date(time + TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

function todayKey() {
  return dayKey(new Date().toISOString());
}

function shiftDay(key, deltaDays) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + deltaDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Chốt khoảng ngày từ query string, luôn trả về một khoảng DÙNG ĐƯỢC.
 *
 * Tham số hỏng, thiếu, hoặc chọn ngược (from sau to) đều không phải lỗi để trả
 * về 400: bảng điều khiển mở lên là phải có số liệu. Sai thì rơi về 30 ngày gần
 * nhất, chọn ngược thì đảo lại.
 *
 * Khoảng dài quá MAX_RANGE_DAYS thì CẮT ĐẦU CŨ, giữ nguyên ngày cuối — người hỏi
 * "toàn bộ lịch sử" muốn thấy giai đoạn gần đây nhất, không phải năm đầu tiên.
 */
function resolveRange({ from, to } = {}) {
  let end = DAY_PATTERN.test(to) ? to : todayKey();
  let start = DAY_PATTERN.test(from) ? from : shiftDay(end, -29);

  if (start > end) [start, end] = [end, start];

  const earliest = shiftDay(end, -(MAX_RANGE_DAYS - 1));
  if (start < earliest) start = earliest;

  const days = [];
  for (let day = start; day <= end; day = shiftDay(day, 1)) days.push(day);

  return { from: start, to: end, days };
}

// Tên trường/lớp người dùng tự gõ, nên "THCS  Đoàn Thị Điểm " và "THCS Đoàn Thị
// Điểm" phải là một. Giữ nguyên hoa/thường ở bản hiển thị, chỉ hạ chữ ở khoá.
function normalizeLabel(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function schoolKey(value) {
  return normalizeLabel(value).toLowerCase();
}

function keyOfUser(user) {
  return classKey(user?.profile?.school, user?.profile?.className);
}

// Mức rủi ro nào cũng phải rơi vào đúng một ô, kể cả bản ghi cũ ghi sai chính tả
function levelOf(session) {
  const level = session?.riskLevel;
  return level === "high" || level === "medium" || level === "low" ? level : "low";
}

function isFlagged(session) {
  // Bản ghi từ phiên bản đầu chỉ có bullyingDetected — xem normalizeSession
  // trong sessions.js. Đọc tới nó ở đây nữa để phiên cũ không biến mất khỏi
  // thống kê chỉ vì thiếu một field.
  return session?.flagged ?? session?.bullyingDetected === true;
}

function emptyCounters() {
  return {
    sessions: 0,
    messages: 0,
    flagged: 0,
    high: 0,
    medium: 0,
    low: 0,
    alerts: 0,
    lastActivityAt: ""
  };
}

// Cộng một phiên vào bất kỳ ô đếm nào (theo ngày, theo lớp, theo trường, hoặc
// tổng). Gom vào một hàm để không có chỗ nào quên cộng `high` khi thêm ô mới.
function countSession(bucket, session) {
  bucket.sessions += 1;
  bucket.messages += Number(session.messageCount) || 0;

  if (isFlagged(session)) {
    bucket.flagged += 1;
    bucket[levelOf(session)] += 1;
  }

  if (session.endedAt > bucket.lastActivityAt) bucket.lastActivityAt = session.endedAt;
}

/**
 * Dựng toàn bộ số liệu cho bảng điều khiển.
 *
 * @param {object[]} users    account.json đã nạp
 * @param {object[]} sessions sessions.json đã nạp
 * @param {object}   range    kết quả của resolveRange
 */
function buildStats(users, sessions, range) {
  const { from, to, days } = range;
  const inRange = (key) => Boolean(key) && key >= from && key <= to;

  const usersById = new Map(users.map((u) => [u.id, u]));

  // --- Khung theo ngày -------------------------------------------------------
  //
  // Dựng sẵn ĐỦ mọi ngày trong khoảng, kể cả ngày không có gì xảy ra. Chỉ đẩy
  // vào những ngày có số liệu thì biểu đồ sẽ nối thẳng qua các ngày trống và
  // đọc thành "vẫn đều đều" trong khi thực tế là im lặng mấy hôm liền.
  const daily = new Map(
    days.map((date) => [
      date,
      { date, newStudents: 0, newTeachers: 0, ...emptyCounters() }
    ])
  );

  // --- Nhóm theo lớp và theo trường ------------------------------------------

  const classes = new Map();
  const schools = new Map();

  function classRow(key, user) {
    let row = classes.get(key);
    if (!row) {
      row = {
        key,
        school: normalizeLabel(user?.profile?.school),
        className: normalizeLabel(user?.profile?.className),
        grade: "",
        students: 0,
        activeStudents: 0,
        teacherName: "",
        teacherStatus: "",
        ...emptyCounters()
      };
      classes.set(key, row);
    }
    return row;
  }

  function schoolRow(key, user) {
    let row = schools.get(key);
    if (!row) {
      row = {
        key,
        school: normalizeLabel(user?.profile?.school),
        classKeys: new Set(),
        students: 0,
        teachers: 0,
        ...emptyCounters()
      };
      schools.set(key, row);
    }
    return row;
  }

  // Học sinh nào đã nói chuyện trong khoảng — đếm theo tài khoản, không theo
  // phiên, nên một em nhắn 10 lần vẫn là một em.
  const activeByClass = new Map();

  // --- Tài khoản -------------------------------------------------------------

  const accounts = {
    students: 0,
    teachers: 0,
    teachersApproved: 0,
    teachersPending: 0,
    admins: 0,
    newStudents: 0,
    newTeachers: 0,
    // Tài khoản chưa khai đủ trường + lớp: không ghép được với giáo viên nào,
    // và mọi hội thoại của em không thuộc lớp nào trên bảng dưới. Đây là con số
    // quản trị viên cần thấy để đi nhắc, không phải thứ nên giấu đi.
    studentsWithoutClass: 0
  };

  for (const user of users) {
    const created = dayKey(user.createdAt);
    const key = keyOfUser(user);
    const sKey = schoolKey(user.profile?.school);

    if (user.role === ROLES.ADMIN) {
      accounts.admins += 1;
      continue; // Quản trị viên không thuộc lớp nào và không trò chuyện
    }

    if (user.role === ROLES.TEACHER) {
      accounts.teachers += 1;
      if (user.status === STATUS.APPROVED) accounts.teachersApproved += 1;
      if (user.status === STATUS.PENDING) accounts.teachersPending += 1;

      if (inRange(created)) {
        accounts.newTeachers += 1;
        daily.get(created).newTeachers += 1;
      }

      // Tài khoản đã bị từ chối không đại diện cho lớp nào — hiện tên họ ở cột
      // "GVCN" của lớp là nói sai với người đọc bảng.
      if (key && user.status !== STATUS.REJECTED) {
        const row = classRow(key, user);
        // Ưu tiên người ĐÃ DUYỆT. Một lớp về nguyên tắc chỉ có một giáo viên
        // được duyệt (server.js chặn lúc duyệt), nhưng hồ sơ chờ duyệt thì có
        // thể có thêm, và không được phép đè lên người đang thật sự phụ trách.
        if (!row.teacherName || (row.teacherStatus !== STATUS.APPROVED && user.status === STATUS.APPROVED)) {
          row.teacherName = user.username;
          row.teacherStatus = user.status;
        }
      }
      if (sKey) schoolRow(sKey, user).teachers += 1;
      continue;
    }

    // Còn lại là học sinh
    accounts.students += 1;
    if (inRange(created)) {
      accounts.newStudents += 1;
      daily.get(created).newStudents += 1;
    }

    if (key) {
      const row = classRow(key, user);
      row.students += 1;
      if (!row.grade) row.grade = normalizeLabel(user.profile?.grade);
    } else {
      accounts.studentsWithoutClass += 1;
    }

    if (sKey) {
      const row = schoolRow(sKey, user);
      row.students += 1;
      if (key) row.classKeys.add(key);
    }
  }

  // --- Hội thoại -------------------------------------------------------------

  const conversations = emptyCounters();
  // Hội thoại của tài khoản chưa khai lớp: có thật, có thể đang bị gắn cờ, nhưng
  // không rơi vào dòng nào của bảng theo lớp. Đếm riêng để tổng ở đầu trang và
  // tổng của bảng chênh nhau còn giải thích được.
  const unassigned = emptyCounters();
  const activeStudents = new Set();

  for (const session of sessions) {
    // Cắt theo NGÀY BẮT ĐẦU. Một phiên mở lúc 23:50 và kết thúc sang hôm sau chỉ
    // được tính một lần, vào hôm nó bắt đầu — nếu không thì tổng theo ngày cộng
    // lại sẽ không bằng tổng chung.
    const day = dayKey(session.startedAt);
    if (!inRange(day)) continue;

    countSession(conversations, session);
    countSession(daily.get(day), session);
    activeStudents.add(session.userId);

    const owner = usersById.get(session.userId);
    const key = owner ? keyOfUser(owner) : "";
    const sKey = owner ? schoolKey(owner.profile?.school) : "";

    if (key) {
      countSession(classRow(key, owner), session);
      if (!activeByClass.has(key)) activeByClass.set(key, new Set());
      activeByClass.get(key).add(session.userId);
    } else {
      countSession(unassigned, session);
    }

    if (sKey) countSession(schoolRow(sKey, owner), session);
  }

  for (const [key, ids] of activeByClass) {
    const row = classes.get(key);
    if (row) row.activeStudents = ids.size;
  }

  // --- Email cảnh báo đã gửi -------------------------------------------------
  //
  // Đếm theo NGÀY GỬI của chính email, không theo ngày của phiên: một hội thoại
  // tháng trước hôm nay mới báo cho giáo viên thì việc "hôm nay có gửi cảnh báo"
  // vẫn phải hiện lên.
  for (const session of sessions) {
    for (const alert of session.alerts || []) {
      const day = dayKey(alert.sentAt);
      if (!inRange(day)) continue;

      conversations.alerts += 1;
      daily.get(day).alerts += 1;

      const owner = usersById.get(session.userId);
      const key = owner ? keyOfUser(owner) : "";
      if (key) classRow(key, owner).alerts += 1;
      const sKey = owner ? schoolKey(owner.profile?.school) : "";
      if (sKey) schoolRow(sKey, owner).alerts += 1;
    }
  }

  // --- Dấu hiệu thường gặp ---------------------------------------------------
  //
  // Một phiên có thể mang nhiều mã cùng lúc, nên tổng các mã LỚN HƠN số phiên bị
  // gắn cờ. Đó là chủ ý: câu hỏi ở đây là "dấu hiệu nào hay gặp", không phải
  // "chia số phiên thành mấy phần".
  const categoryCount = new Map();
  for (const session of sessions) {
    if (!inRange(dayKey(session.startedAt)) || !isFlagged(session)) continue;
    for (const code of session.categories || []) {
      categoryCount.set(code, (categoryCount.get(code) || 0) + 1);
    }
  }

  const byCategory = [...categoryCount.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  // --- Sắp xếp bảng ----------------------------------------------------------
  //
  // Lớp cần chú ý nhất lên đầu: nhiều phiên khẩn cấp trước, rồi tới số phiên bị
  // gắn cờ, rồi mới tới độ bận rộn. Xếp theo tên trường thì quản trị viên phải
  // tự dò cả bảng mới thấy chỗ có chuyện.
  const byClass = [...classes.values()].sort(
    (a, b) =>
      b.high - a.high ||
      b.flagged - a.flagged ||
      b.sessions - a.sessions ||
      a.school.localeCompare(b.school, "vi") ||
      a.className.localeCompare(b.className, "vi")
  );

  const bySchool = [...schools.values()]
    .map(({ classKeys, ...row }) => ({ ...row, classes: classKeys.size }))
    .sort(
      (a, b) =>
        b.high - a.high ||
        b.flagged - a.flagged ||
        b.sessions - a.sessions ||
        a.school.localeCompare(b.school, "vi")
    );

  return {
    generatedAt: new Date().toISOString(),
    range: { from, to, days: days.length },
    accounts,
    classes: {
      total: classes.size,
      schools: schools.size,
      // Lớp có giáo viên chủ nhiệm ĐÃ DUYỆT — chỉ những lớp này mới thật sự có
      // người đọc cảnh báo. Lớp còn lại là khoảng trống cần lấp.
      withTeacher: byClass.filter((row) => row.teacherStatus === STATUS.APPROVED).length,
      withoutTeacher: byClass.filter((row) => row.teacherStatus !== STATUS.APPROVED).length
    },
    conversations: { ...conversations, activeStudents: activeStudents.size },
    unassigned: { ...unassigned, students: accounts.studentsWithoutClass },
    daily: [...daily.values()],
    byClass,
    bySchool,
    byCategory
  };
}

module.exports = { dayKey, resolveRange, buildStats, MAX_RANGE_DAYS, TZ_OFFSET_MINUTES };
