import { getAgent } from "../../constants/agents";

// Hiện agent nào đang suy nghĩ. Không truyền agent thì rơi về Larry chung chung.
export default function TypingIndicator({ agent }) {
  const info = getAgent(agent);

  return (
    <div className="typing-indicator" style={{ "--agent-color": info.color }}>
      <div className="message-avatar message-avatar--ai" style={{ "--agent-color": info.color }}>
        {info.icon}
      </div>
      <div className="typing-bubble">
        <div className="typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="typing-label">
          {info.displayName} {info.typingLabel}...
        </p>
      </div>
    </div>
  );
}
