import { useEffect, useRef, useState } from "react";
import CharacterAvatar from "./CharacterAvatar";
import CharacterPicker from "./CharacterPicker";
import { getCharacter } from "../../constants/characters";
import { ASSISTANT_NAME, UI_TEXT } from "../../constants/introScript";
import "../../styles/intro.css";

// Dải nhân vật trong lúc trò chuyện: gương mặt Larry, khung camera, và mấy cái
// nút em vẫn được bấm bất cứ lúc nào — đóng/mở mắt, đổi gương mặt, và lối ra
// (`account`).
//
// Lối ra phải nằm ở ĐÂY chứ không chỉ ở thẻ tài khoản cuối cột: cột trái còn có
// bảng tri thức và mấy đường góp ý bên dưới, nên trên màn hình laptop cái thẻ đó
// bị đẩy xuống dưới mép nhìn thấy được — muốn đăng xuất phải cuộn đi tìm.
//
// Cố ý KHÔNG hiện cảm xúc camera đọc được. Dán lên màn hình một câu như "Bạn đang
// bình thường" là phán xét em bằng một phép đoán từ ảnh, ngay giữa lúc em đang
// định kể ra chuyện khác hẳn. Cảm xúc đó vẫn được gửi kèm mỗi lượt chat để Larry
// mở lời cho khéo — chỉ là không trưng ra trước mặt em.
export default function CompanionPanel({
  characterId,
  onPickCharacter,
  camera,
  pose = { arms: "down", eyes: "happy", mood: "" },
  account = null
}) {
  const character = getCharacter(characterId);
  const [openPop, setOpenPop] = useState(null);

  const togglePop = (name) => setOpenPop((prev) => (prev === name ? null : name));

  const toggleEyes = async () => {
    setOpenPop(null);
    if (camera.isOn) camera.close();
    else await camera.open();
  };

  return (
    <section className="companion-panel">
      <div className="companion-panel__stage">
        <CharacterAvatar
          characterId={characterId}
          arms={pose.arms}
          eyes={pose.eyes}
          mood={pose.mood}
          className="companion--panel"
        >
          {camera.isOn && camera.stream && (
            <div className="companion__cam">
              <PanelFeed stream={camera.stream} />
            </div>
          )}
        </CharacterAvatar>
      </div>

      <p className="companion-panel__name">
        {ASSISTANT_NAME}
        <span>
          {" · "}
          {character.emoji} {character.species.toLowerCase()}
        </span>
      </p>

      <div className="companion-panel__actions">
        {!camera.unavailable && (
          <div className="companion-panel__slot">
            <button type="button" className="larry-pill" onClick={() => togglePop("eyes")}>
              {camera.isOn ? UI_TEXT.eyesOpen : UI_TEXT.eyesShut}
            </button>
            {openPop === "eyes" && (
              <div className="larry-pop" role="dialog">
                <h4>{camera.isOn ? UI_TEXT.eyesOpenTitle : UI_TEXT.eyesShutTitle}</h4>
                <p>{camera.isOn ? UI_TEXT.eyesOpenText : UI_TEXT.eyesShutText}</p>
                <button type="button" className="larry-pop__btn" onClick={toggleEyes}>
                  {camera.isOn ? UI_TEXT.eyesCloseAction : UI_TEXT.eyesOpenAction}
                </button>
                <button
                  type="button"
                  className="larry-pop__btn larry-pop__btn--quiet"
                  onClick={() => setOpenPop(null)}
                >
                  {UI_TEXT.notNow}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="companion-panel__slot">{account}</div>

        <div className="companion-panel__slot">
          <button type="button" className="larry-pill" onClick={() => togglePop("who")}>
            {UI_TEXT.companion}
          </button>
          {openPop === "who" && (
            <div className="larry-pop" role="dialog">
              <h4>{UI_TEXT.companionTitle}</h4>
              <p>{UI_TEXT.companionText}</p>
              <CharacterPicker
                value={characterId}
                compact
                onPick={(id) => {
                  onPickCharacter(id);
                  setOpenPop(null);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PanelFeed({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted />;
}
