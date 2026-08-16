const QUICK_EMOJIS = ["😊", "🎮", "❤️", "📩"];

// Nút micro: bấm để bắt đầu nói, bấm lần nữa để gửi.
//
// KHÔNG dùng kiểu "giữ để nói": học sinh tiểu học vừa phải giữ chuột vừa nghĩ
// xem nói gì thì rất dễ thả tay giữa câu, và trên màn hình cảm ứng thì lỡ vuốt
// một cái là mất luôn đoạn thu.
function MicButton({ voice, disabled }) {
  const { isRecording, isTranscribing, start, stop } = voice;

  if (isTranscribing) {
    return (
      <button type="button" className="mic-btn mic-btn--working" disabled aria-label="Đang chuyển lời nói thành chữ">
        <span className="mic-btn__spinner" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`mic-btn ${isRecording ? "mic-btn--recording" : ""}`}
      onClick={isRecording ? stop : start}
      disabled={disabled}
      aria-label={isRecording ? "Dừng và gửi lời nói" : "Nói với Larry"}
      aria-pressed={isRecording}
    >
      {isRecording ? "⏹️" : "🎤"}
    </button>
  );
}

export default function ChatInput({ value, onChange, onSend, disabled, voice = null }) {
  const appendEmoji = (emoji) => {
    onChange(value + emoji);
  };

  // Đang thu hoặc đang chờ model đọc ra chữ thì khoá ô gõ: hai đường nhập cùng
  // đổ vào một lượt chat, mở cả hai là em gõ được một câu rồi lời nói ghi đè lên.
  const voiceBusy = Boolean(voice?.isRecording || voice?.isTranscribing);
  const typingDisabled = disabled || voiceBusy;

  const placeholder = voice?.isRecording
    ? "🔴 Larry đang nghe bạn nói..."
    : voice?.isTranscribing
      ? "✍️ Larry đang viết lại lời bạn..."
      : "Hãy kể cho Larry nghe điều bạn đang nghĩ nhé...";

  return (
    <div className="chat-input-area">
      <div className="emoji-bar">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-btn"
            onClick={() => appendEmoji(emoji)}
            disabled={typingDisabled}
            aria-label={`Thêm ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Lỗi micro nói thẳng ở đây, ngay cạnh cái nút vừa bấm — không trộn vào
          khung chat để em khỏi tưởng đó là lời Larry nói. */}
      {voice?.error && (
        <p className="voice-error" role="status">
          {voice.error}
        </p>
      )}

      <div className="chat-input-row">
        {voice?.supported && <MicButton voice={voice} disabled={disabled} />}

        <input
          className="chat-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          disabled={typingDisabled}
        />
        <button
          type="button"
          className="send-btn"
          onClick={onSend}
          disabled={typingDisabled}
          aria-label="Gửi tin nhắn"
        >
          🚀
        </button>
      </div>
    </div>
  );
}
