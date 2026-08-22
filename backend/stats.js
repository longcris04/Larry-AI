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

// --- Khối lớp và mức độ dùng --------------------------------------------------
//
// Hai nhóm số liệu dưới đây trả lời hai câu hỏi mà mọi ô đếm khác trên trang
// không trả lời được: "các em đang học lớp mấy" và "mỗi em vào bao nhiêu lượt".
// Cả hai đều được cắt theo BA cách cùng lúc — gộp tất cả, tách theo trường, tách
// theo ngày — nên chúng nằm trong hai hàm riêng thay vì nhét thêm field vào
// buildStats: mỗi hàm tự đi hết danh sách một lần, đọc thẳng từ trên xuống là
// hiểu, và kiểm chứng lại được từng cái một.

const GRADES = ["6", "7", "8", "9"];
const OTHER_GRADE = "other";
const GRADE_KEYS = [...GRADES, OTHER_GRADE];

/**
 * Khối của một học sinh: "6" | "7" | "8" | "9" | "other".
 *
 * Ô "khối" do các em tự gõ nên có đủ kiểu: "6", "Lớp 6", "khối 6". Lấy CỤM SỐ
 * ĐẦU TIÊN thay vì so nguyên chuỗi — không thì "Lớp 6" rơi vào ô "khác" trong
 * khi ai nhìn cũng biết em học lớp 6.
 *
 * Bỏ trống ô khối thì LÙI VỀ TÊN LỚP: "8T1.1" là lớp 8, và suy ra như thế đúng
 * hơn hẳn việc xếp em vào "khác". Không đoán xa hơn thế — tên lớp không có chữ
 * số nào thì để ở "khác" chứ không bịa ra một khối.
 *
 * Ngoài 6–9 (lớp 10 của trường có cả cấp 3 chẳng hạn) đều vào "other": bảng này
 * là bảng THCS, bốn ô 6/7/8/9 phải luôn đúng nghĩa của nó. Kèm theo còn có
 * otherLabels để quản trị viên biết trong ô "khác" thật ra có những gì.
 */
function gradeOf(user) {
  const raw =
    normalizeLabel(user?.profile?.grade) || normalizeLabel(user?.profile?.className);
  const found = raw.match(/\d{1,2}/);
  const grade = found ? String(Number(found[0])) : "";
  return GRADES.includes(grade) ? grade : OTHER_GRADE;
}

/** Chuỗi các em tự gõ, để giải thích ô "khác" gồm những gì. */
function gradeLabelOf(user) {
  return (
    normalizeLabel(user?.profile?.grade) ||
    normalizeLabel(user?.profile?.className) ||
    ""
  );
}

// Bốn khung mức độ dùng. min/max tính theo SỐ LƯỢT của MỘT học sinh trong khoảng
// đang xem (hoặc trong một ngày, ở cách nhìn theo ngày).
//
// Bốn khung phủ kín từ 1 tới vô hạn và KHÔNG chồng lên nhau — mỗi em rơi vào
// đúng một khung, nên bốn con số cộng lại đúng bằng số em có dùng. Em không có
// lượt nào không thuộc khung nào (đếm riêng ở `none`): "0 lần" không phải một
// mức độ dùng, nó là chưa dùng.
const USAGE_BUCKETS = [
  { id: "once", min: 1, max: 1 },
  { id: "light", min: 2, max: 5 },
  { id: "regular", min: 6, max: 10 },
  { id: "heavy", min: 11, max: Infinity }
];

const USAGE_KEYS = USAGE_BUCKETS.map((bucket) => bucket.id);

function usageBucket(count) {
  const bucket = USAGE_BUCKETS.find((b) => count >= b.min && count <= b.max);
  return bucket ? bucket.id : "";
}

function emptyGradeRow() {
  const row = {};
  for (const key of GRADE_KEYS) row[key] = 0;
  row.all = 0;
  return row;
}

function emptyUsageRow() {
  const row = {};
  for (const key of USAGE_KEYS) row[key] = 0;
  row.users = 0;    // số học sinh có ít nhất một lượt
  row.sessions = 0; // tổng số lượt của những em đó
  return row;
}

function isStudentAccount(user) {
  // Giống hệt cách buildStats đếm học sinh: KHÔNG phải quản trị viên, KHÔNG phải
  // giáo viên. Viết theo lối loại trừ chứ không phải `role === ROLES.USER` để
  // tổng ở đây luôn khớp với accounts.students — hai con số cùng nói về học sinh
  // mà lệch nhau thì không ai biết tin cái nào.
  return user.role !== ROLES.ADMIN && user.role !== ROLES.TEACHER;
}

/**
 * Tài khoản học sinh theo khối 6/7/8/9.
 *
 * `total` là con số CỘNG DỒN từ trước tới nay, `created` chỉ tính những em đăng
 * ký trong khoảng đang xem, và `daily` là số tài khoản tạo trong từng ngày. Ba
 * con số này khác nhau và không thay được cho nhau: khoảng ngày trên bảng điều
 * khiển không xoá đi những em đã có sẵn từ trước.
 */
function buildGradeStats(users, { from, to, days }) {
  const inRange = (key) => Boolean(key) && key >= from && key <= to;

  const total = emptyGradeRow();
  const created = emptyGradeRow();
  const daily = new Map(days.map((date) => [date, { date, ...emptyGradeRow() }]));
  const bySchool = new Map();
  const otherLabels = new Map();

  // Em chưa khai trường không có mặt ở bảng theo trường. Đếm riêng để tổng của
  // bảng và tổng ở trên chênh nhau còn giải thích được.
  let withoutSchool = 0;

  for (const user of users) {
    if (!isStudentAccount(user)) continue;

    const grade = gradeOf(user);
    const day = dayKey(user.createdAt);
    const sKey = schoolKey(user.profile?.school);

    total[grade] += 1;
    total.all += 1;

    if (inRange(day)) {
      created[grade] += 1;
      created.all += 1;
      const row = daily.get(day);
      row[grade] += 1;
      row.all += 1;
    }

    if (sKey) {
      let row = bySchool.get(sKey);
      if (!row) {
        row = {
          key: sKey,
          school: normalizeLabel(user.profile?.school),
          ...emptyGradeRow(),
          created: 0
        };
        bySchool.set(sKey, row);
      }
      row[grade] += 1;
      row.all += 1;
      if (inRange(day)) row.created += 1;
    } else {
      withoutSchool += 1;
    }

    if (grade === OTHER_GRADE) {
      const label = gradeLabelOf(user) || "(chưa khai)";
      otherLabels.set(label, (otherLabels.get(label) || 0) + 1);
    }
  }

  return {
    grades: GRADE_KEYS,
    total,
    created,
    withoutSchool,
    // Trường đông học sinh lên đầu — đó là thứ tự người ta dò bảng này.
    bySchool: [...bySchool.values()].sort(
      (a, b) => b.all - a.all || a.school.localeCompare(b.school, "vi")
    ),
    daily: [...daily.values()],
    // Chỉ vài dòng đầu: đây là chú thích cho ô "khác", không phải một bảng nữa.
    otherLabels: [...otherLabels.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"))
      .slice(0, 8)
  };
}

/**
 * Học sinh chia theo SỐ LƯỢT đã dùng Larry: 1 lần, 2–5, 6–10, trên 10.
 *
 * Đơn vị đếm là HỌC SINH, không phải lượt — câu hỏi ở đây là "bao nhiêu em dùng
 * nhiều tới mức nào", nên mỗi em được xếp vào đúng một khung theo số lượt của
 * chính em. Tổng số lượt vẫn có (`sessions`) nhưng chỉ để đọc kèm.
 *
 * Cách nhìn theo NGÀY tính lại từ đầu cho từng ngày: một em vào 3 lượt hôm nay
 * và 1 lượt hôm qua nằm ở khung 2–5 của hôm nay và khung 1 lần của hôm qua. Cộng
 * dồn cả khoảng rồi rải ra từng ngày thì con số của mỗi ngày không còn nghĩa gì.
 */
function buildUsageStats(users, sessions, { from, to, days }) {
  const inRange = (key) => Boolean(key) && key >= from && key <= to;
  const usersById = new Map(users.map((u) => [u.id, u]));

  // Số lượt của từng em: một bản cho cả khoảng, một bản cho từng ngày.
  const byStudent = new Map();
  const byDay = new Map(days.map((date) => [date, new Map()]));

  for (const session of sessions) {
    // Cắt theo NGÀY BẮT ĐẦU, đúng như biểu đồ hội thoại theo ngày ở trên: một
    // phiên mở lúc 23h50 là lượt của tối hôm đó, không phải của ngày hôm sau.
    const day = dayKey(session.startedAt);
    if (!inRange(day)) continue;

    byStudent.set(session.userId, (byStudent.get(session.userId) || 0) + 1);
    const perDay = byDay.get(day);
    perDay.set(session.userId, (perDay.get(session.userId) || 0) + 1);
  }

  const total = { ...emptyUsageRow(), students: 0, none: 0 };
  const bySchool = new Map();

  // Dựng dòng cho MỌI trường có học sinh trước, kể cả trường chưa em nào vào:
  // "trường nào chưa ai dùng" mới là dòng đáng đi hỏi, mà trường đó thì không
  // có phiên nào để lòi ra ở vòng dưới.
  for (const user of users) {
    if (!isStudentAccount(user)) continue;
    total.students += 1;

    const sKey = schoolKey(user.profile?.school);
    if (!sKey) continue;

    let row = bySchool.get(sKey);
    if (!row) {
      row = {
        key: sKey,
        school: normalizeLabel(user.profile?.school),
        ...emptyUsageRow(),
        students: 0,
        none: 0
      };
      bySchool.set(sKey, row);
    }
    row.students += 1;
  }

  for (const [userId, count] of byStudent) {
    const bucket = usageBucket(count);

    total[bucket] += 1;
    total.users += 1;
    total.sessions += count;

    const owner = usersById.get(userId);
    const row = owner ? bySchool.get(schoolKey(owner.profile?.school)) : null;
    if (!row) continue; // Em chưa khai trường, hoặc tài khoản đã bị xoá

    row[bucket] += 1;
    row.users += 1;
    row.sessions += count;
  }

  // Chặn dưới ở 0: khoảng ngày có thể nằm hẳn trong quá khứ, lúc đó số em ĐANG
  // có (cộng dồn tới hôm nay) lớn hơn số em từng vào trong khoảng đó là chuyện
  // bình thường — nhưng một con số âm thì không.
  total.none = Math.max(0, total.students - total.users);
  for (const row of bySchool.values()) row.none = Math.max(0, row.students - row.users);

  const daily = days.map((date) => {
    const row = { date, ...emptyUsageRow() };
    for (const count of byDay.get(date).values()) {
      row[usageBucket(count)] += 1;
      row.users += 1;
      row.sessions += count;
    }
    return row;
  });

  return {
    buckets: USAGE_KEYS,
    total,
    bySchool: [...bySchool.values()].sort(
      (a, b) =>
        b.sessions - a.sessions ||
        b.users - a.users ||
        b.students - a.students ||
        a.school.localeCompare(b.school, "vi")
    ),
    daily
  };
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
  // Lớp/trường có ít nhất một tài khoản được tạo trong khoảng đang xem. Giữ
  // riêng khỏi hai Map cộng dồn vì các bảng chi tiết vẫn cần hiện đủ dữ liệu cũ.
  const classKeysInRange = new Set();
  const schoolKeysInRange = new Set();

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
    newTeachersApproved: 0,
    newTeachersPending: 0,
    // Tài khoản chưa khai đủ trường + lớp: không ghép được với giáo viên nào,
    // và mọi hội thoại của em không thuộc lớp nào trên bảng dưới. Đây là con số
    // quản trị viên cần thấy để đi nhắc, không phải thứ nên giấu đi.
    studentsWithoutClass: 0
  };

  for (const user of users) {
    const created = dayKey(user.createdAt);
    const createdInRange = inRange(created);
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

      if (createdInRange) {
        accounts.newTeachers += 1;
        if (user.status === STATUS.APPROVED) accounts.newTeachersApproved += 1;
        if (user.status === STATUS.PENDING) accounts.newTeachersPending += 1;
        daily.get(created).newTeachers += 1;
      }

      // Tài khoản đã bị từ chối không đại diện cho lớp nào — hiện tên họ ở cột
      // "GVCN" của lớp là nói sai với người đọc bảng.
      if (key && user.status !== STATUS.REJECTED) {
        const row = classRow(key, user);
        if (createdInRange) classKeysInRange.add(key);
        // Ưu tiên người ĐÃ DUYỆT. Một lớp về nguyên tắc chỉ có một giáo viên
        // được duyệt (server.js chặn lúc duyệt), nhưng hồ sơ chờ duyệt thì có
        // thể có thêm, và không được phép đè lên người đang thật sự phụ trách.
        if (!row.teacherName || (row.teacherStatus !== STATUS.APPROVED && user.status === STATUS.APPROVED)) {
          row.teacherName = user.username;
          row.teacherStatus = user.status;
        }
      }
      if (sKey) {
        schoolRow(sKey, user).teachers += 1;
        if (createdInRange) schoolKeysInRange.add(sKey);
      }
      continue;
    }

    // Còn lại là học sinh
    accounts.students += 1;
    if (createdInRange) {
      accounts.newStudents += 1;
      daily.get(created).newStudents += 1;
    }

    if (key) {
      const row = classRow(key, user);
      if (createdInRange) classKeysInRange.add(key);
      row.students += 1;
      if (!row.grade) row.grade = normalizeLabel(user.profile?.grade);
    } else {
      accounts.studentsWithoutClass += 1;
    }

    if (sKey) {
      const row = schoolRow(sKey, user);
      if (createdInRange) schoolKeysInRange.add(sKey);
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
      inRange: classKeysInRange.size,
      schoolsInRange: schoolKeysInRange.size,
      withTeacherInRange: byClass.filter(
        (row) => classKeysInRange.has(row.key) && row.teacherStatus === STATUS.APPROVED
      ).length,
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
    byCategory,
    byGrade: buildGradeStats(users, range),
    usage: buildUsageStats(users, sessions, range)
  };
}

module.exports = {
  dayKey,
  resolveRange,
  buildStats,
  buildGradeStats,
  buildUsageStats,
  gradeOf,
  usageBucket,
  GRADES,
  GRADE_KEYS,
  USAGE_BUCKETS,
  USAGE_KEYS,
  MAX_RANGE_DAYS,
  TZ_OFFSET_MINUTES
};
