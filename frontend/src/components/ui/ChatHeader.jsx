// speaker = null khi backend chưa khai TTS_MODEL — lúc đó không có nút loa nào,
// và phần đầu khung chat giữ nguyên như trước.
export default function ChatHeader({ speaker = null }) {
  return (
    <header className="chat-header">
      <div className="chat-header__avatar">🤖</div>
      <div className="chat-header__info">
        <h1 className="chat-header__name">
          Larry
          <span aria-hidden="true">⭐</span>
        </h1>
        <p className="chat-header__tagline">
          {speaker?.speaking ? "Đang nói với bạn... 🔊" : "Người bạn AI của bạn ❤️"}
        </p>
      </div>

      {speaker && (
        <button
          type="button"
          className={`speaker-btn ${speaker.muted ? "speaker-btn--muted" : ""}`}
          onClick={speaker.toggleMuted}
          aria-label={speaker.muted ? "Bật tiếng của Larry" : "Tắt tiếng của Larry"}
          aria-pressed={!speaker.muted}
          title={speaker.muted ? "Bật tiếng Larry" : "Tắt tiếng Larry"}
        >
          {speaker.muted ? "🔇" : "🔊"}
        </button>
      )}

      <div className="chat-header__decor" aria-hidden="true">
        <span>🌈</span>
        <span>⭐</span>
      </div>
    </header>
  );
}
