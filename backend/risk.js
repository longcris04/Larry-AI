// Thang đánh giá mức độ rủi ro của một phiên hội thoại, dùng chung cho
// summarizer.js (model chấm) và server.js (chấm bằng luật từ phiếu cảm xúc).
//
// Vì sao cần lớp chấm bằng luật: hội thoại có thể rất ngắn — học sinh điền phiếu
// cảm xúc xong là Larry đã nắm tình hình, em không cần nhắn thêm câu nào. Khi đó
// riêng phiếu cũng đủ để gắn cờ, không phụ thuộc vào việc model tóm tắt có chạy
// được hay không.

// Nhãn tiếng Việt của các mã này nằm ở frontend/src/constants/riskCategories.js
const RISK_CATEGORIES = [
  "bullying", // bắt nạt, bạo lực học đường
  "abuse", // xâm hại, bạo hành, dụ dỗ
  "self_harm", // tự làm đau bản thân, ý nghĩ tự tử
  "mental", // suy sụp tinh thần, buồn bã kéo dài, trầm cảm
  "fear", // sợ hãi, lo âu, hoảng loạn
  "physical", // suy nhược thể chất, đau ốm, mất ngủ, bỏ ăn
  "family", // gia đình bất ổn, bị bỏ bê
  "academic", // áp lực học tập, sợ đi học
  "social", // cô đơn, mất kết nối bạn bè
  "other" // dấu hiệu tiêu cực khác
];

const RISK_LEVELS = ["none", "low", "medium", "high"];
const RISK_ORDER = { none: 0, low: 1, medium: 2, high: 3 };

// Nhãn tiếng Việt để đưa vào email cảnh báo cho giáo viên (xem alertEmail.js).
// Phải khớp với frontend/src/constants/riskCategories.js.
const RISK_LEVEL_LABELS = {
  none: "Không có dấu hiệu tiêu cực",
  low: "Cần chú ý",
  medium: "Đáng lo",
  high: "Khẩn cấp"
};

const RISK_CATEGORY_LABELS = {
  bullying: "Bắt nạt / bạo lực học đường",
  abuse: "Bị xâm hại / bạo hành",
  self_harm: "Tự làm đau bản thân",
  mental: "Suy sụp tinh thần",
  fear: "Sợ hãi, lo âu",
  physical: "Suy nhược thể chất",
  family: "Vấn đề gia đình",
  academic: "Áp lực học tập",
  social: "Cô đơn, mất kết nối",
  other: "Dấu hiệu tiêu cực khác"
};

function riskCategoryLabels(codes = []) {
  return codes.map((code) => RISK_CATEGORY_LABELS[code] || RISK_CATEGORY_LABELS.other);
}

function maxRiskLevel(a, b) {
  return (RISK_ORDER[a] || 0) >= (RISK_ORDER[b] || 0) ? a || "none" : b || "none";
}

function mergeCategories(...lists) {
  const merged = lists.flat().filter((c) => RISK_CATEGORIES.includes(c));
  return [...new Set(merged)].slice(0, 6);
}

// --- Phiếu cảm xúc -----------------------------------------------------------

const FEELING_LEVEL_LABELS = [
  "Rất khó chịu",
  "Khó chịu",
  "Bình thường",
  "Dễ chịu",
  "Rất dễ chịu"
];

const CHECKIN_SCOPE_LABELS = {
  now: "cảm xúc ngay lúc này",
  today: "cảm xúc tổng thể của cả ngày hôm nay"
};

// Mức sàn của phiếu theo thanh trượt 5 mức (chỉ hai mức khó chịu mới tính)
const LEVEL_RISK = ["medium", "low", "none", "none", "none"];

// Từ cảm xúc học sinh tự chọn ở phiếu → mức sàn + nhóm dấu hiệu.
// "Ngạc nhiên" nằm ở cả hai nhóm dễ chịu/khó chịu nên không tính là tiêu cực.
const EMOTION_RISK = {
  "Vô vọng": { level: "medium", category: "mental" },
  "Kiệt sức": { level: "medium", category: "physical" },
  "Sợ hãi": { level: "medium", category: "fear" },
  "Tội lỗi": { level: "medium", category: "mental" },
  "Xấu hổ": { level: "low", category: "mental" },
  Buồn: { level: "low", category: "mental" },
  "Nản lòng": { level: "low", category: "mental" },
  "Thất vọng": { level: "low", category: "mental" },
  "Lo lắng": { level: "low", category: "fear" },
  "Lo âu": { level: "low", category: "fear" },
  "Căng thẳng": { level: "low", category: "fear" },
  "Tức giận": { level: "low", category: "other" },
  "Chán ghét": { level: "low", category: "other" },
  "Bối rối": { level: "low", category: "other" }
};

const REASON_CATEGORY = {
  "Sức khỏe": "physical",
  "Gia đình": "family",
  "Bạn bè": "social",
  "Học tập": "academic",
  "Thi cử": "academic"
};

// Chấm phiếu bằng luật. CỐ Ý không dò từ khoá trong phần học sinh tự kể —
// việc hiểu đoạn text đó là của model tóm tắt, dò từ khoá chỉ tổ báo sai.
// Ở đây chỉ dùng các ô chọn sẵn, vốn không thể hiểu nhầm.
function analyzeCheckin(checkin) {
  if (!checkin) return { level: "none", categories: [] };

  let level = "none";
  const categories = [];

  if (checkin.level !== null && LEVEL_RISK[checkin.level]) {
    level = maxRiskLevel(level, LEVEL_RISK[checkin.level]);
  }

  for (const word of checkin.emotions || []) {
    const risk = EMOTION_RISK[word];
    if (!risk) continue;
    level = maxRiskLevel(level, risk.level);
    categories.push(risk.category);
  }

  // Lý do ("Gia đình", "Bạn bè"...) chỉ nói lên chuyện gì đang tác động, tự nó
  // không tiêu cực. Chỉ gắn nhóm khi phiếu đã có tín hiệu tiêu cực.
  if (level !== "none") {
    for (const reason of checkin.reasons || []) {
      if (REASON_CATEGORY[reason]) categories.push(REASON_CATEGORY[reason]);
    }
  }

  return { level, categories: mergeCategories(categories) };
}

// Dòng tóm tắt phiếu để lưu vào bản ghi phiên và hiện cho giáo viên.
// KHÔNG chứa phần học sinh tự kể — hệ thống chỉ lưu tóm tắt, không lưu nguyên văn.
function describeCheckin(checkin) {
  if (!checkin) return "";

  const parts = [];
  if (checkin.level !== null) {
    const scope = CHECKIN_SCOPE_LABELS[checkin.scope] || "cảm xúc hiện tại";
    parts.push(`${FEELING_LEVEL_LABELS[checkin.level]} (${scope})`);
  }
  if (checkin.emotions?.length) parts.push(`cảm xúc: ${checkin.emotions.join(", ")}`);
  if (checkin.reasons?.length) parts.push(`tác động bởi: ${checkin.reasons.join(", ")}`);
  if (checkin.detail) parts.push("có kể thêm bằng lời");

  return parts.join(" · ");
}

// Khối văn bản đầy đủ (có cả phần tự kể) đưa cho model tóm tắt đọc
function buildCheckinBlock(checkin) {
  if (!checkin) return "";

  const lines = [];
  if (checkin.level !== null) {
    const scope = CHECKIN_SCOPE_LABELS[checkin.scope] || "cảm xúc hiện tại";
    lines.push(`- Mức độ (${scope}): ${FEELING_LEVEL_LABELS[checkin.level]}`);
  }
  if (checkin.emotions?.length) {
    lines.push(`- Cảm xúc học sinh tự chọn: ${checkin.emotions.join(", ")}`);
  }
  if (checkin.reasons?.length) {
    lines.push(`- Điều đang tác động nhiều nhất: ${checkin.reasons.join(", ")}`);
  }
  if (checkin.detail) {
    lines.push(`- Học sinh tự kể thêm: "${checkin.detail}"`);
  }

  if (lines.length === 0) return "";

  return `PHIẾU CẢM XÚC HỌC SINH ĐIỀN NGAY TRƯỚC KHI CHAT:\n${lines.join("\n")}`;
}

module.exports = {
  RISK_CATEGORIES,
  RISK_LEVELS,
  RISK_ORDER,
  RISK_LEVEL_LABELS,
  RISK_CATEGORY_LABELS,
  riskCategoryLabels,
  maxRiskLevel,
  mergeCategories,
  FEELING_LEVEL_LABELS,
  CHECKIN_SCOPE_LABELS,
  analyzeCheckin,
  describeCheckin,
  buildCheckinBlock
};
