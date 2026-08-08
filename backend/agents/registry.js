// Bảng tra cứu các agent: id node, nhóm phụ trách, tên hiển thị, mức ưu tiên.
//
// Đây là NGUỒN SỰ THẬT DUY NHẤT về danh sách agent ở backend.
// Frontend có bản sao ở frontend/src/constants/agents.js — sửa bên này thì
// phải sửa bên kia, id phải khớp từng ký tự.

// Mã nhóm nội bộ. KHÔNG bao giờ hiện nguyên mã này cho học sinh thấy.
const GROUPS = {
  SELF_HARM: "self_harm", // có hành vi / ý nghĩ tự làm đau bản thân
  VICTIM: "victim", // nạn nhân của bạo lực học đường
  ACTOR: "actor", // người gây ra bạo lực
  GENERAL: "general" // mọi trường hợp còn lại
};

const GROUP_LIST = Object.values(GROUPS);

// Nhãn tiếng Việt dùng trong log và trang quản trị (không phải để nói với học sinh)
const GROUP_LABELS = {
  [GROUPS.SELF_HARM]: "Có hành vi tự hại",
  [GROUPS.VICTIM]: "Nạn nhân bạo lực học đường",
  [GROUPS.ACTOR]: "Người gây ra bạo lực",
  [GROUPS.GENERAL]: "Trò chuyện thường ngày"
};

const SUPERVISOR_ID = "supervisor";

// priority: số nhỏ nói trước. An toàn tính mạng luôn đứng đầu.
const AGENTS = [
  {
    id: "agent_self_harm",
    group: GROUPS.SELF_HARM,
    priority: 1,
    displayName: "Larry Đồng hành",
    icon: "🛟",
    color: "#e11d48",
    envModel: "AGENT_SELF_HARM_MODEL",
    // Mô tả phần việc bằng lời nói được với học sinh — dùng làm TRỌNG TÂM cho agent
    // khi trường hợp thuộc nhiều nhóm (khối PHẠM VI, xem prompts/agentPrompt.js)
    domain: "việc em tự làm đau cơ thể mình và cảm xúc dẫn tới điều đó"
  },
  {
    id: "agent_victim",
    group: GROUPS.VICTIM,
    priority: 2,
    displayName: "Larry Bảo vệ",
    icon: "🛡️",
    color: "#ea580c",
    envModel: "AGENT_VICTIM_MODEL",
    domain: "việc em bị bạn khác bắt nạt, đánh, trêu chọc hoặc cô lập ở trường"
  },
  {
    id: "agent_actor",
    group: GROUPS.ACTOR,
    priority: 3,
    displayName: "Larry Thấu hiểu",
    icon: "🧩",
    color: "#2563eb",
    envModel: "AGENT_ACTOR_MODEL",
    domain: "việc chính em đã làm bạn khác bị tổn thương, và lý do phía sau hành vi đó"
  },
  {
    id: "agent_homeroom",
    group: GROUPS.GENERAL,
    priority: 4,
    displayName: "Cô giáo Larry",
    icon: "🍎",
    color: "#16a34a",
    envModel: "AGENT_HOMEROOM_MODEL",
    domain: "chuyện học tập, bạn bè, gia đình và sinh hoạt thường ngày của em"
  }
];

const SUPERVISOR = {
  id: SUPERVISOR_ID,
  group: null,
  priority: 0,
  displayName: "Larry Điều phối",
  icon: "🧭",
  color: "#7c3aed",
  envModel: "SUPERVISOR_MODEL"
};

const BY_ID = new Map([...AGENTS, SUPERVISOR].map((a) => [a.id, a]));
const BY_GROUP = new Map(AGENTS.map((a) => [a.group, a]));

function agentById(id) {
  return BY_ID.get(id) || null;
}

function agentForGroup(group) {
  return BY_GROUP.get(group) || null;
}

// Nhóm → id agent, đã sắp theo thứ tự nói. Bỏ nhóm lạ do model bịa ra.
function agentIdsForGroups(groups = []) {
  return [...new Set(groups)]
    .map((g) => BY_GROUP.get(g))
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .map((a) => a.id);
}

// Model riêng cho từng agent, bỏ trống thì rơi về CHAT_MODEL trong llm.js
function modelForAgent(id) {
  const agent = BY_ID.get(id);
  if (!agent) return undefined;
  return process.env[agent.envModel] || undefined;
}

module.exports = {
  GROUPS,
  GROUP_LIST,
  GROUP_LABELS,
  SUPERVISOR_ID,
  SUPERVISOR,
  AGENTS,
  agentById,
  agentForGroup,
  agentIdsForGroups,
  modelForAgent
};
