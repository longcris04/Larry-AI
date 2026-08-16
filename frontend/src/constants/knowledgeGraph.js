// Cách tô màu đồ thị kho tri thức.
//
// Kho có 16 LOẠI node, mà một bảng màu phân loại đọc được chỉ chịu nổi tối đa 8
// màu — và với đồ thị mạng, nơi node nào cũng có thể nằm cạnh node nào (chứ
// không xếp thành hàng như cột trong biểu đồ), giới hạn thực tế còn thấp hơn.
// Tô 16 màu là biến bảng chú giải thành một bài kiểm tra trí nhớ.
//
// Nên 16 loại được gom thành 4 NHÓM CHỨC NĂNG, trả lời bốn câu hỏi khác nhau:
//
//   Em đang có biểu hiện gì?      → Dấu hiệu & bằng chứng
//   Chuyện đó gọi là gì?          → Khái niệm
//   Làm gì bây giờ?               → Hành động
//   Không được làm gì, cầu cứu ai? → Ranh giới & hỗ trợ
//
// Loại cụ thể vẫn đọc được: nó nằm trong bảng chú giải, trong thẻ chi tiết khi
// bấm vào node, và trong chế độ xem dạng bảng.
//
// Bốn màu này đã chạy qua bộ kiểm tra bảng màu (mọi cặp, nền sáng): tách bạch
// với mắt người mù màu ở ΔE 9.2 — đạt ngưỡng ≥8. Riêng màu xanh ngọc có độ
// tương phản 2.74:1 so với nền trắng, dưới mức 3:1, nên nó KHÔNG được đứng một
// mình: mỗi nhóm còn mang một HÌNH DẠNG riêng, luôn có nhãn chữ đi kèm, và cả
// đồ thị có chế độ xem dạng bảng. Nhận ra nhóm không bao giờ chỉ dựa vào màu.

export const FAMILIES = {
  evidence: {
    id: "evidence",
    label: "Dấu hiệu & bằng chứng",
    question: "Em đang có biểu hiện gì?",
    color: "#eb6834",
    shape: "triangle",
    types: ["Sign", "RiskFactor", "Stat", "Case"]
  },
  concept: {
    id: "concept",
    label: "Khái niệm",
    question: "Chuyện đó gọi là gì?",
    color: "#2a78d6",
    shape: "circle",
    types: ["Concept", "ViolenceType", "Function", "RiskLevel"]
  },
  action: {
    id: "action",
    label: "Hành động",
    question: "Làm gì bây giờ?",
    color: "#1baf7a",
    shape: "square",
    types: ["Protocol", "Step", "Skill", "Method", "Script"]
  },
  boundary: {
    id: "boundary",
    label: "Ranh giới & hỗ trợ",
    question: "Không được làm gì, cầu cứu ai?",
    color: "#4a3aa7",
    shape: "diamond",
    types: ["Principle", "Taboo", "Hotline"]
  }
};

export const FAMILY_LIST = Object.values(FAMILIES);

// Tra ngược: loại node → nhóm
const TYPE_TO_FAMILY = {};
for (const family of FAMILY_LIST) {
  for (const type of family.types) TYPE_TO_FAMILY[type] = family;
}

// Loại lạ (ai đó thêm kiểu node mới mà quên khai ở đây) rơi về nhóm khái niệm
// thay vì biến mất khỏi đồ thị — hiện sai nhóm còn hơn không hiện gì.
export function familyOfType(type) {
  return TYPE_TO_FAMILY[type] || FAMILIES.concept;
}

// Cạnh KHÔNG được tô theo loại quan hệ: 13 loại quan hệ mà mỗi loại một màu thì
// đồ thị thành cầu vồng và không ai đọc nổi. Cạnh là cấu trúc, không phải phân
// loại — nó dùng một màu xám lùi về sau, và tên quan hệ hiện ra khi bấm vào.
export const EDGE_COLOR = "#c2c8d0";
export const EDGE_COLOR_ACTIVE = "#5b6472";

// Bán kính chấm theo số cạnh nối tới. Node càng nhiều liên hệ càng là trung tâm
// của một cụm, và người xem nên nhìn ra điều đó ngay.
export function radiusOfDegree(degree) {
  return 6 + Math.min(Math.sqrt(degree || 0) * 2.6, 11);
}
