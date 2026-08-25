import { useState } from "react";
import { joinVi } from "../../constants/checkin";
import { UI_TEXT } from "../../constants/introScript";
import "../../styles/intro.css";

// Câu hỏi của phiếu cảm xúc, hiện NGAY TRONG khung chat, ngay dưới câu Larry vừa
// nói. Không còn là hộp thoại đè lên màn hình, cũng không phải một màn hình riêng
// đứng chắn trước cuộc trò chuyện.
//
// Ba kiểu hỏi:
//   single  chọn một — bấm phát là đi tiếp
//   multi   chọn nhiều + ô tự viết, xong thì bấm nút chốt
//   text    tự kể — kiểu này KHÔNG vẽ gì ở đây, nó mượn luôn ô nhắn tin của
//           khung chat (xem ChatBox), vì đó đúng là chỗ để em gõ một câu dài.
export default function IntroPrompt({ prompt, onAnswer }) {
  if (!prompt || prompt.kind === "text") return null;

  if (prompt.kind === "single") {
    return <SingleChoice options={prompt.options} onPick={(option) => onAnswer(option.label, option)} />;
  }

  return (
    <MultiChoice
      options={prompt.options}
      customPlaceholder={prompt.customPlaceholder}
      onDone={(values) =>
        onAnswer(values.length ? joinVi(values) : UI_TEXT.pickSkip, { values })
      }
    />
  );
}

function SingleChoice({ options, onPick }) {
  const [chosen, setChosen] = useState(null);

  return (
    <div className="intro-choices">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className={`intro-choice ${chosen === option.value ? "intro-choice--chosen" : ""} ${
            chosen !== null && chosen !== option.value ? "intro-choice--leaving" : ""
          }`}
          style={{ animationDelay: `${index * 70}ms` }}
          disabled={chosen !== null}
          onClick={() => {
            // Nhấn giữ nút vừa bấm sáng lên một nhịp rồi mới đi tiếp — bấm xong
            // mà mọi thứ biến mất tức thì thì em không kịp thấy mình đã chọn gì.
            setChosen(option.value);
            setTimeout(() => onPick(option), 240);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiChoice({ options, customPlaceholder, onDone }) {
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState("");

  const toggle = (value) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  const finish = () => {
    const extra = custom.trim();
    onDone(extra ? [...picked, extra] : picked);
  };

  const nothingPicked = picked.length === 0 && !custom.trim();

  return (
    <div className="intro-picker">
      <div className="intro-chips">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`intro-chip ${picked.includes(option.value) ? "intro-chip--on" : ""}`}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <input
        className="intro-input"
        type="text"
        maxLength={60}
        placeholder={customPlaceholder}
        value={custom}
        onChange={(event) => setCustom(event.target.value)}
      />

      <button type="button" className="intro-send" onClick={finish}>
        {nothingPicked ? UI_TEXT.pickSkip : UI_TEXT.pickDone}
      </button>
    </div>
  );
}
