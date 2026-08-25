import CharacterAvatar from "./CharacterAvatar";
import SpeakerToggle from "./SpeakerToggle";
import { ASSISTANT_NAME } from "../../constants/introScript";

// speaker = null khi backend chưa khai TTS_MODEL — lúc đó không có nút loa nào,
// và phần đầu khung chat giữ nguyên như trước.
//
// Nút loa tự giữ lấy trạng thái tắt/bật của nó (dùng chung với nút ở trang đăng
// nhập, xem SpeakerToggle). Ở đây `speaker` chỉ còn trả lời đúng một câu: có vẽ
// nút hay không — và dòng chữ dưới tên Larry đọc `speaking` để báo đang đọc.
// `characterId` là gương mặt em đã chọn ở màn mở đầu. Tên thì không đổi: người
// đang nói vẫn luôn là Larry — xem constants/characters.jsx.
export default function ChatHeader({ speaker = null, characterId }) {
  return (
    <header className="chat-header">
      <div className="chat-header__avatar">
        <CharacterAvatar
          characterId={characterId}
          arms="down"
          eyes="happy"
          className="companion--header"
        />
      </div>
      <div className="chat-header__info">
        <h1 className="chat-header__name">
          {ASSISTANT_NAME}
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
