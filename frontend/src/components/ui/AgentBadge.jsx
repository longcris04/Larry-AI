import { getAgent } from "../../constants/agents";

// Nhãn tên + icon của một agent, hiện phía trên bong bóng chat.
// Nhận thẳng displayName/icon/color từ sự kiện SSE nếu có, không thì tra bảng.
export default function AgentBadge({ agent, displayName, icon, color, size = "md" }) {
  const info = getAgent(agent);

  return (
    <span
      className={`agent-badge agent-badge--${size}`}
      style={{ "--agent-color": color || info.color }}
    >
      <span className="agent-badge__icon" aria-hidden="true">
        {icon || info.icon}
      </span>
      <span className="agent-badge__name">{displayName || info.displayName}</span>
    </span>
  );
}
