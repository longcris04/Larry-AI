export default function ChatHeader() {
  return (
    <header className="chat-header">
      <div className="chat-header__avatar">🤖</div>
      <div className="chat-header__info">
        <h1 className="chat-header__name">
          Larry
          <span aria-hidden="true">⭐</span>
        </h1>
        <p className="chat-header__tagline">
          Người bạn AI của bạn ❤️
        </p>
      </div>
      <div className="chat-header__decor" aria-hidden="true">
        <span>🌈</span>
        <span>⭐</span>
      </div>
    </header>
  );
}
