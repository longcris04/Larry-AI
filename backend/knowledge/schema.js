// Từ vựng của knowledge graph: kiểu node, kiểu cạnh, và hàm chuẩn hoá tiếng Việt.
//
// Mọi file trong graph/ đều phải dùng đúng các hằng ở đây. validate.js đối chiếu
// lại — sai chính tả một kiểu node là graph không nạp được, chứ không im lặng bỏ qua.

// --- Kiểu node ---------------------------------------------------------------
//
// Chọn theo CÂU HỎI mà agent cần trả lời, không theo cấu trúc chương mục của tài
// liệu gốc. Ví dụ "Chương V — chiến lược kiểm soát thúc đẩy" không thành một node
// Chapter, mà tách thành nhiều node Skill để truy hồi bắt trúng từng kỹ thuật.
const NODE_TYPES = {
  Concept: "Concept", // khái niệm lâm sàng: NSSI, toan tự sát, bắt nạt...
  ViolenceType: "ViolenceType", // dạng bạo lực: thể chất, tinh thần, kinh tế, tình dục, mạng
  Sign: "Sign", // dấu hiệu nhận diện trên học sinh
  RiskFactor: "RiskFactor", // yếu tố làm tăng nguy cơ
  Function: "Function", // chức năng tâm lý mà hành vi đang phục vụ
  RiskLevel: "RiskLevel", // mức độ nguy cơ + ngưỡng + hành động tương ứng
  Protocol: "Protocol", // quy trình nhiều bước
  Step: "Step", // một bước trong Protocol
  Skill: "Skill", // kỹ thuật học sinh tự làm được
  Method: "Method", // phương pháp sư phạm người lớn áp dụng
  Script: "Script", // mẫu câu đối thoại + phân tích chức năng lâm sàng
  Principle: "Principle", // nguyên tắc giao tiếp
  Taboo: "Taboo", // điều TUYỆT ĐỐI không được làm/nói
  Hotline: "Hotline", // đường dây nóng, cơ sở trị liệu
  Case: "Case", // tình huống thực tế trong tài liệu
  Stat: "Stat" // số liệu thực chứng
};

const NODE_TYPE_LIST = Object.values(NODE_TYPES);

// Nhãn tiếng Việt của từng kiểu node — dùng cho bảng tri thức hiện trên giao diện
// học sinh và cho công cụ dòng lệnh. Tên kiểu trong code là tiếng Anh vì nó là
// từ vựng của graph, nhưng thứ em nhìn thấy thì phải đọc được.
const NODE_TYPE_LABELS = {
  Concept: "Khái niệm",
  ViolenceType: "Dạng bạo lực",
  Sign: "Dấu hiệu",
  RiskFactor: "Yếu tố nguy cơ",
  Function: "Chức năng tâm lý",
  RiskLevel: "Mức nguy cơ",
  Protocol: "Quy trình",
  Step: "Một bước trong quy trình",
  Skill: "Kỹ năng",
  Method: "Phương pháp",
  Script: "Mẫu đối thoại",
  Principle: "Nguyên tắc",
  Taboo: "Điều cần tránh",
  Hotline: "Nơi hỗ trợ",
  Case: "Tình huống thực tế",
  Stat: "Số liệu"
};

// --- Kiểu cạnh ---------------------------------------------------------------
//
// Cạnh là thứ làm graph khác một danh sách phẳng: từ một dấu hiệu học sinh vừa kể,
// truy hồi đi được sang chức năng tâm lý phía sau nó, rồi sang kỹ thuật thay thế
// đúng chức năng đó — thứ mà khớp từ khoá đơn thuần không bao giờ tìm ra.
const EDGE_TYPES = {
  INDICATES: "INDICATES", // dấu hiệu → khái niệm/dạng bạo lực mà nó gợi ý
  SERVES_FUNCTION: "SERVES_FUNCTION", // hành vi → nhu cầu tâm lý nó đang đáp ứng
  REPLACES_FUNCTION: "REPLACES_FUNCTION", // kỹ thuật an toàn → chức năng nó thay thế được
  INCREASES_RISK_OF: "INCREASES_RISK_OF", // yếu tố rủi ro → hậu quả
  ESCALATES_TO: "ESCALATES_TO", // tình trạng nhẹ → tình trạng nặng hơn
  HAS_STEP: "HAS_STEP", // quy trình → bước
  APPLIES_AT: "APPLIES_AT", // hành động → mức độ nguy cơ áp dụng
  RESPONDS_TO: "RESPONDS_TO", // kỹ thuật/kịch bản → tình huống nó xử lý
  CONTRAINDICATED_FOR: "CONTRAINDICATED_FOR", // điều cấm kỵ → chỗ nó áp dụng
  REFER_TO: "REFER_TO", // tình trạng → nơi chuyển tuyến
  EXEMPLIFIES: "EXEMPLIFIES", // tình huống thực tế → khái niệm nó minh hoạ
  RELATED_TO: "RELATED_TO", // liên quan hai chiều, không phân cấp
  CONTRASTS_WITH: "CONTRASTS_WITH" // hai khái niệm dễ bị nhầm lẫn với nhau
};

const EDGE_TYPE_LIST = Object.values(EDGE_TYPES);

// Nhãn tiếng Việt của quan hệ. Truy hồi ghi lại đường đi của mình bằng các nhãn
// này, nên chúng đi thẳng ra phần "vì sao Larry lấy mẩu này" trên giao diện.
const EDGE_LABELS = {
  INDICATES: "là dấu hiệu của",
  SERVES_FUNCTION: "đang phục vụ nhu cầu",
  REPLACES_FUNCTION: "thay thế được chức năng",
  INCREASES_RISK_OF: "làm tăng nguy cơ",
  ESCALATES_TO: "có thể nặng lên thành",
  HAS_STEP: "gồm bước",
  APPLIES_AT: "áp dụng ở mức",
  RESPONDS_TO: "dùng để ứng phó với",
  CONTRAINDICATED_FOR: "là điều cấm khi gặp",
  REFER_TO: "chuyển tiếp tới",
  EXEMPLIFIES: "minh hoạ cho",
  RELATED_TO: "liên quan tới",
  CONTRASTS_WITH: "dễ bị nhầm với"
};

// Cạnh đi được cả hai chiều lúc truy hồi. Các cạnh còn lại chỉ đi xuôi, nếu không
// thì từ "tổng đài 111" sẽ lan ngược về mọi tình trạng có REFER_TO tới nó.
const SYMMETRIC_EDGES = new Set([EDGE_TYPES.RELATED_TO, EDGE_TYPES.CONTRASTS_WITH]);

// Nhãn NGẮN của tín hiệu nguy hiểm, khớp enum dangerSignals của supervisor.
// Bản dài (viết hoa, nói thẳng với model) nằm trong prompt của agent; bản này chỉ
// để giải thích cho học sinh vì sao một mẩu tài liệu được lấy ra.
const DANGER_LABELS_SHORT = {
  grooming: "có người đang dụ dỗ",
  sexual_abuse: "bị xâm hại tình dục",
  domestic_violence: "bị bạo hành ở nhà",
  school_violence: "bị hành hung ở trường",
  suicidal: "có ý nghĩ không muốn sống",
  self_injury: "đang tự làm đau bản thân"
};

// --- Mức ưu tiên -------------------------------------------------------------
const PRIORITY = {
  PINNED: 3, // luôn nạp cho agent khớp, kể cả em chưa nhắc tới — dùng cho luật an toàn
  HIGH: 2,
  NORMAL: 1,
  LOW: 0 // chỉ nạp khi khớp từ khoá đủ mạnh
};

// --- Chuẩn hoá tiếng Việt ----------------------------------------------------
//
// Học sinh gõ "em bi ban danh" cũng phải khớp được với trigger "bị bạn đánh".
// Bỏ dấu ở CẢ hai phía lúc so khớp, chứ không bắt em gõ đúng chính tả.
function normalizeVi(input = "") {
  return String(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh và dấu phụ
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ") // dấu câu thành khoảng trắng để "tự-hại" == "tự hại"
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  NODE_TYPES,
  NODE_TYPE_LIST,
  NODE_TYPE_LABELS,
  EDGE_TYPES,
  EDGE_TYPE_LIST,
  EDGE_LABELS,
  DANGER_LABELS_SHORT,
  SYMMETRIC_EDGES,
  PRIORITY,
  normalizeVi
};
