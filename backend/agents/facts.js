// Ô DỮ KIỆN — bảng kiểm "đã biết gì về chuyện của em", và cái cổng quyết định
// KHI NÀO agent phải thôi hỏi để bắt đầu tư vấn.
//
// Vì sao phải có file này, thay vì để model tự đọc transcript rồi tự biết:
//
// Trước đây `needMoreInfo` của supervisor chỉ chặn được bước hỏi khai thác của
// CHÍNH supervisor. Sang tới agent thì không còn tín hiệu nào cả — role prompt của
// agent nạn nhân có sẵn một khối "KHAI THÁC THÊM" liệt kê năm câu hỏi, chạy vô
// điều kiện ở mọi lượt, cộng thêm dòng "kết thúc bằng một câu hỏi mở". Kết quả đo
// được trong ca thật: học sinh đã kể đủ thời gian, địa điểm, hành vi và tần suất
// mà agent vẫn hỏi tiếp "bạn ấy còn hành động nào khác không", không lượt nào
// chuyển sang tư vấn.
//
// Nên việc "đã đủ chưa" được chốt bằng CODE trên một bảng ô có thật, đúng tinh
// thần của resolveGroups() và renderAdviceStage(): model đề xuất, luật quyết định.

// Thứ tự trong đối tượng cũng là thứ tự ưu tiên khi chọn câu hỏi tiếp theo.
const FACT_KEYS = ["what", "when", "where", "frequency", "myAction", "witness", "toldAdult"];

// Nhãn để in vào prompt. Viết như một câu hỏi vì đây chính là câu agent sẽ hỏi.
const FACT_LABELS = {
  what: "chuyện gì đã xảy ra",
  when: "xảy ra lúc nào",
  where: "xảy ra ở đâu",
  frequency: "đã xảy ra bao nhiêu lần / có thường xuyên không",
  myAction: "chính em đã làm gì với bạn ấy",
  witness: "có ai chứng kiến hoặc bênh em không",
  toldAdult: "em đã kể với người lớn nào chưa"
};

// Ô BẮT BUỘC phải có trước khi được tư vấn, theo từng nhóm.
//
// Cố ý để NGẮN. Mỗi ô thêm vào đây là thêm một lượt em bị hỏi trước khi được giúp,
// và một cuộc tư vấn biến thành một cuộc phỏng vấn là hỏng đúng thứ nó sinh ra để
// làm. `witness` và `toldAdult` hữu ích nhưng KHÔNG chặn tư vấn — agent hỏi được
// thì hỏi trong lúc đã vừa khuyên.
//
// self_harm cố ý rỗng: ca đó luôn urgent, không bao giờ được chặn lời khuyên lại
// để đi hỏi thêm dữ kiện.
const REQUIRED_FACTS = {
  victim: ["what", "frequency"],
  actor: ["myAction", "what"],
  self_harm: [],
  general: []
};

// Dặn model để "" khi chưa biết là chưa đủ: nó vẫn viết "chưa rõ", "không rõ",
// "chưa đề cập"... Mấy chuỗi đó đều truthy, nên nếu không chặn ở đây thì một ô
// TRỐNG bị tính là ĐÃ BIẾT — cổng enoughToAdvise mở sớm, và bảng dữ kiện in ra
// "bao nhiêu lần: chưa rõ" như thể đó là một thông tin em đã kể.
const UNKNOWN_VALUES = new Set([
  "",
  "-",
  "n/a",
  "na",
  "null",
  "chua ro",
  "chua biet",
  "chua noi",
  "chua de cap",
  "chua co",
  "chua xac dinh",
  "khong ro",
  "khong biet",
  "khong co",
  "khong de cap",
  "khong xac dinh"
]);

// Bỏ dấu để "chưa rõ" và "chua ro" cùng khớp một mục trong bảng trên
function foldVi(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[.!?,;:]/g, "")
    .trim();
}

function isUnknown(value) {
  return UNKNOWN_VALUES.has(foldVi(value));
}

function emptyFacts() {
  return Object.fromEntries(FACT_KEYS.map((k) => [k, ""]));
}

// Model trả về ô nào lạ thì bỏ, ô nào thiếu hoặc nói "chưa rõ" thì để rỗng
function sanitizeFacts(raw) {
  const facts = emptyFacts();
  if (!raw || typeof raw !== "object") return facts;

  for (const key of FACT_KEYS) {
    const value = raw[key];
    if (typeof value !== "string") continue;

    const trimmed = value.trim().slice(0, 200);
    if (!isUnknown(trimmed)) facts[key] = trimmed;
  }

  return facts;
}

/**
 * Gộp ô dữ kiện của lượt mới vào những gì đã biết.
 *
 * CHỈ THÊM, không xoá. Model đánh giá lại từ đầu ở mỗi lượt, nên một lượt em nói
 * sang chuyện khác là đủ để nó trả về `when: ""` dù em đã kể từ ba lượt trước —
 * để nó ghi đè thì agent lại đi hỏi lại đúng câu đó. Cùng tinh thần với sàn an
 * toàn của resolveGroups().
 */
function mergeFacts(current, incoming) {
  const merged = sanitizeFacts(current);
  const next = sanitizeFacts(incoming);

  for (const key of FACT_KEYS) {
    if (next[key]) merged[key] = next[key];
  }

  return merged;
}

// Ô còn trống trong số ô BẮT BUỘC của các nhóm đang hoạt động, theo thứ tự ưu tiên
function missingFacts(facts = {}, groups = []) {
  const required = new Set();
  for (const group of groups) {
    for (const key of REQUIRED_FACTS[group] || []) required.add(key);
  }

  return FACT_KEYS.filter((key) => required.has(key) && !facts[key]);
}

function knownFacts(facts = {}) {
  return FACT_KEYS.filter((key) => facts[key]);
}

/**
 * Đã đủ dữ kiện để chuyển sang tư vấn chưa?
 *
 * urgent thắng tất cả: em vừa nói không muốn sống nữa thì không có chuyện bắt em
 * kể thêm hoàn cảnh rồi mới giúp.
 */
function enoughToAdvise({ facts = {}, groups = [], urgent = false } = {}) {
  if (urgent) return true;
  return missingFacts(facts, groups).length === 0;
}

module.exports = {
  FACT_KEYS,
  FACT_LABELS,
  REQUIRED_FACTS,
  emptyFacts,
  sanitizeFacts,
  mergeFacts,
  missingFacts,
  knownFacts,
  enoughToAdvise
};
