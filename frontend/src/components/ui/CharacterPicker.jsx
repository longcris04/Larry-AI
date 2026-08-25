import CharacterAvatar from "./CharacterAvatar";
import { CHARACTERS } from "../../constants/characters";

// Bộ sưu tập nhân vật, bày ra để em chọn lấy một gương mặt cho Larry.
//
// Đây thuần tuý là hình dáng: phía sau vẫn là một Larry duy nhất, cùng kho tri
// thức, cùng cách trả lời. Chọn gương mặt KHÔNG đổi nội dung tư vấn — chỗ gọi
// (CompanionPanel) nói thẳng điều đó, để em không tưởng mình đang chọn giữa mấy
// trợ lý giỏi dở khác nhau.
export default function CharacterPicker({ value, onPick, compact = false }) {
  return (
    <ul className={`char-picker ${compact ? "char-picker--compact" : ""}`}>
      {CHARACTERS.map((character) => (
        <li key={character.id}>
          <button
            type="button"
            className={`char-card ${value === character.id ? "char-card--on" : ""}`}
            onClick={() => onPick(character.id)}
            aria-pressed={value === character.id}
          >
            <CharacterAvatar
              characterId={character.id}
              arms="down"
              eyes={value === character.id ? "happy" : "open"}
              className="companion--mini"
            />
            <span className="char-card__name">{character.name}</span>
            {!compact && <span className="char-card__species">{character.species}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
