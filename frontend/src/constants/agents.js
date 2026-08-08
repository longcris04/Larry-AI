// Bản sao của backend/agents/registry.js dành cho giao diện.
//
// Backend đã gửi kèm displayName/icon/color trong mỗi sự kiện SSE, nên bảng này
// chủ yếu dùng làm phương án dự phòng và cho các nhãn chỉ có ở phía giao diện.
// ID phải khớp từng ký tự với backend.

export const SUPERVISOR_ID = "supervisor";

export const AGENTS = {
  supervisor: {
    id: "supervisor",
    displayName: "Larry Điều phối",
    icon: "🧭",
    color: "#7c3aed",
    // Câu hiện ở khung "đang gõ" khi agent này đang trả lời
    typingLabel: "đang lắng nghe và tìm hiểu",
  },
  agent_self_harm: {
    id: "agent_self_harm",
    displayName: "Larry Đồng hành",
    icon: "🛟",
    color: "#e11d48",
    typingLabel: "đang trả lời",
  },
  agent_victim: {
    id: "agent_victim",
    displayName: "Larry Bảo vệ",
    icon: "🛡️",
    color: "#ea580c",
    typingLabel: "đang trả lời",
  },
  agent_actor: {
    id: "agent_actor",
    displayName: "Larry Thấu hiểu",
    icon: "🧩",
    color: "#2563eb",
    typingLabel: "đang trả lời",
  },
  agent_homeroom: {
    id: "agent_homeroom",
    displayName: "Cô giáo Larry",
    icon: "🍎",
    color: "#16a34a",
    typingLabel: "đang trả lời",
  },
};

const FALLBACK_AGENT = {
  id: "larry",
  displayName: "Larry",
  icon: "🤖",
  color: "#7c3aed",
  typingLabel: "đang trả lời",
};

export function getAgent(id) {
  return AGENTS[id] || FALLBACK_AGENT;
}

// Nhãn tiếng Việt của các nhóm, dùng ở bảng "Đang xử lý".
// KHÔNG hiện trong bong bóng chat — học sinh không cần đọc mã phân loại.
export const GROUP_LABELS = {
  self_harm: "Cần được đồng hành",
  victim: "Bị bắt nạt",
  actor: "Có làm bạn tổn thương",
  general: "Trò chuyện thường ngày",
};

export function groupLabel(group) {
  return GROUP_LABELS[group] || group;
}
