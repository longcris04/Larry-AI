// Bộ câu hỏi pop-up hiện khi học sinh vừa vào giao diện chat.
// Kết quả được gửi kèm mỗi request /chat để backend ghép vào system prompt.

export const SCOPE_OPTIONS = [
  {
    value: "now",
    icon: "⏱️",
    label: "Cảm xúc của bạn ngay lúc này",
    question: "Ngay lúc này bạn đang cảm thấy thế nào?",
  },
  {
    value: "today",
    icon: "🌤️",
    label: "Cảm xúc tổng thể của bạn trong ngày hôm nay",
    question: "Chọn cảm giác tổng thể của bạn hôm nay",
  },
];

// Thanh trượt 5 mức. tone dùng để quyết định bộ từ ở câu hỏi 3.
export const FEELING_LEVELS = [
  { value: 0, label: "Rất khó chịu", icon: "😣", tone: "unpleasant" },
  { value: 1, label: "Khó chịu", icon: "🙁", tone: "unpleasant" },
  { value: 2, label: "Bình thường", icon: "😐", tone: "neutral" },
  { value: 3, label: "Dễ chịu", icon: "🙂", tone: "pleasant" },
  { value: 4, label: "Rất dễ chịu", icon: "😄", tone: "pleasant" },
];

export const EMOTION_WORDS = {
  unpleasant: [
    "Tức giận",
    "Lo lắng",
    "Sợ hãi",
    "Xấu hổ",
    "Chán ghét",
    "Bối rối",
    "Nản lòng",
    "Căng thẳng",
    "Lo âu",
    "Tội lỗi",
    "Ngạc nhiên",
    "Vô vọng",
    "Thất vọng",
    "Kiệt sức",
    "Buồn",
  ],
  pleasant: [
    "Vui vẻ",
    "Hạnh phúc",
    "Bình an",
    "Biết ơn",
    "Hào hứng",
    "Tự hào",
    "Thư giãn",
    "Yêu thương",
    "Tự tin",
    "Hy vọng",
    "Thoải mái",
    "Ngạc nhiên",
  ],
};

export const REASON_OPTIONS = [
  "Sức khỏe",
  "Gia đình",
  "Bạn bè",
  "Học tập",
  "Thi cử",
];

export function getLevel(value) {
  return FEELING_LEVELS.find((level) => level.value === value) || FEELING_LEVELS[2];
}

export function getScope(value) {
  return SCOPE_OPTIONS.find((scope) => scope.value === value) || SCOPE_OPTIONS[0];
}

// Ghép danh sách thành câu tiếng Việt: ["a","b","c"] -> "a, b và c"
export function joinVi(items) {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} và ${list[list.length - 1]}`;
}

// Cụm từ mô tả cảm xúc, dùng để chèn vào câu hỏi 4 và câu chốt
export function describeFeeling(checkin) {
  const words = joinVi(checkin.emotions);
  if (words) return words.toLowerCase();
  return getLevel(checkin.level).label.toLowerCase();
}
