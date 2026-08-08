import AgentBadge from "./AgentBadge";
import { getAgent } from "../../constants/agents";

export default function Message({
  sender,
  text,
  index = 0,
  agent,
  displayName,
  icon,
  color,
  streaming = false
}) {
  const isUser = sender === "user";
  const info = getAgent(agent);
  const agentColor = color || info.color;

  return (
    <div
      className={`message-row ${isUser ? "message-row--user" : ""}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div
        className={`message-avatar ${isUser ? "message-avatar--user" : "message-avatar--ai"}`}
        style={isUser ? undefined : { "--agent-color": agentColor }}
      >
        {isUser ? "🧒" : icon || info.icon}
      </div>

      <div className="message-content">
        {/* Nhãn agent để học sinh (và người xem demo) biết ai đang nói */}
        {!isUser && (
          <AgentBadge agent={agent} displayName={displayName} icon={icon} color={agentColor} />
        )}

        <div
          className={`message-bubble ${isUser ? "message-bubble--user" : "message-bubble--ai"} ${
            streaming ? "message-bubble--streaming" : ""
          }`}
          style={isUser ? undefined : { "--agent-color": agentColor }}
        >
          {text}
          {streaming && <span className="message-caret" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
