import SpeakerToggle from "./SpeakerToggle";

// speaker = null khi backend chưa khai TTS_MODEL — lúc đó không có nút loa nào,
// và phần đầu khung chat giữ nguyên như trước.
//
// Nút loa tự giữ lấy trạng thái tắt/bật của nó (dùng chung với nút ở trang đăng
// nhập, xem SpeakerToggle). Ở đây `speaker` chỉ còn trả lời đúng một câu: có vẽ
// nút hay không — và dòng chữ dưới tên Larry đọc `speaking` để báo đang đọc.
export default function ChatHeader({ speaker = null }) {
  return (
    <header className="chat-header">
      <div className="chat-header__avatar">
        <img className="brand-logo" src={`${process.env.PUBLIC_URL}/logo_mark.png`} alt="Larry AI" />
      </div>
      <div className="chat-header__info">
        <h1 className="chat-header__name">
          Larry
          <span aria-hidden="true">⭐</span>
        </h1>
        <p className="chat-header__tagline">
          {speaker?.speaking ? "Đang nói với bạn... 🔊" : "Người bạn AI của bạn ❤️"}
        </p>
      </div>

      {speaker && <SpeakerToggle variant="icon" />}

      <div className="chat-header__decor" aria-hidden="true">
        <span>🌈</span>
        <span>⭐</span>
      </div>
    </header>
  );
}
