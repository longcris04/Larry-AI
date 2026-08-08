const QUICK_EMOJIS = ["😊", "🎮", "❤️", "📩"];

export default function ChatInput({ value, onChange, onSend, disabled }) {
  const appendEmoji = (emoji) => {
    onChange(value + emoji);
  };

  return (
    <div className="chat-input-area">
      <div className="emoji-bar">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-btn"
            onClick={() => appendEmoji(emoji)}
            disabled={disabled}
            aria-label={`Thêm ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={value}
          placeholder="Hãy kể cho Larry nghe điều bạn đang nghĩ nhé..."
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          disabled={disabled}
        />
        <button
          type="button"
          className="send-btn"
          onClick={onSend}
          disabled={disabled}
          aria-label="Gửi tin nhắn"
        >
          🚀
        </button>
      </div>
    </div>
  );
}
