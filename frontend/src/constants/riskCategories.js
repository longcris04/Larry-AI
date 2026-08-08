// Nhãn hiển thị cho kết quả đánh giá phiên hội thoại.
// Mã do model tóm tắt sinh ra, xem backend/summarizer.js (RISK_CATEGORIES, RISK_LEVELS).

export const RISK_CATEGORY_LABELS = {
  bullying: "Bắt nạt / bạo lực học đường",
  abuse: "Bị xâm hại / bạo hành",
  self_harm: "Tự làm đau bản thân",
  mental: "Suy sụp tinh thần",
  fear: "Sợ hãi, lo âu",
  physical: "Suy nhược thể chất",
  family: "Vấn đề gia đình",
  academic: "Áp lực học tập",
  social: "Cô đơn, mất kết nối",
  other: "Dấu hiệu tiêu cực khác",
};

export const RISK_LEVEL_LABELS = {
  low: "Cần chú ý",
  medium: "Đáng lo",
  high: "Khẩn cấp",
};

export function riskCategoryLabel(code) {
  return RISK_CATEGORY_LABELS[code] || RISK_CATEGORY_LABELS.other;
}

export function riskLevelLabel(level) {
  return RISK_LEVEL_LABELS[level] || RISK_LEVEL_LABELS.low;
}
