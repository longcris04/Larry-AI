import React, { useMemo, useState } from "react";
import {
  SCOPE_OPTIONS,
  FEELING_LEVELS,
  EMOTION_WORDS,
  REASON_OPTIONS,
  getLevel,
  getScope,
  joinVi,
  describeFeeling,
} from "../../constants/checkin";
import "../../styles/CheckinModal.css";

const STEPS = {
  SCOPE: "scope",
  LEVEL: "level",
  EMOTIONS: "emotions",
  REASONS: "reasons",
  DETAIL: "detail",
};

// Chọn/bỏ chọn một mục trong danh sách nhiều lựa chọn
function toggle(list, item) {
  return list.includes(item)
    ? list.filter((entry) => entry !== item)
    : [...list, item];
}

export default function CheckinModal({ onComplete, onSkip }) {
  const [step, setStep] = useState(STEPS.SCOPE);

  const [scope, setScope] = useState(null);
  const [level, setLevel] = useState(2);
  const [emotions, setEmotions] = useState([]);
  const [customEmotion, setCustomEmotion] = useState("");
  const [reasons, setReasons] = useState([]);
  const [customReason, setCustomReason] = useState("");
  const [detail, setDetail] = useState("");

  const tone = getLevel(level).tone;

  // Gộp lựa chọn có sẵn với ô người dùng tự nhập
  const allEmotions = useMemo(() => {
    const extra = customEmotion.trim();
    return extra ? [...emotions, extra] : emotions;
  }, [emotions, customEmotion]);

  const allReasons = useMemo(() => {
    const extra = customReason.trim();
    return extra ? [...reasons, extra] : reasons;
  }, [reasons, customReason]);

  const draft = {
    scope,
    level,
    emotions: allEmotions,
    reasons: allReasons,
    detail: detail.trim(),
  };

  const feelingText = describeFeeling(draft);
  const reasonText = joinVi(allReasons).toLowerCase();

  const finish = () => onComplete(draft);

  const goFromLevel = () => {
    // Câu hỏi 3 chỉ hỏi khi cảm thấy khó chịu hoặc dễ chịu
    setStep(tone === "neutral" ? STEPS.REASONS : STEPS.EMOTIONS);
  };

  const backFromReasons = () => {
    setStep(tone === "neutral" ? STEPS.LEVEL : STEPS.EMOTIONS);
  };

  return (
    <div className="checkin-overlay" role="dialog" aria-modal="true">
      <div className="checkin-card">
        <button
          type="button"
          className="checkin-close"
          onClick={onSkip}
          aria-label="Bỏ qua"
        >
          ×
        </button>

        {/* ---------- Câu hỏi 1 ---------- */}
        {step === STEPS.SCOPE && (
          <>
            <div className="checkin-emoji">💚</div>

            <h2 className="checkin-title">
              Hãy chia sẻ cảm xúc của bạn với tôi để tôi có thể hỗ trợ bạn nhé!
            </h2>

            <div className="checkin-options">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="checkin-option"
                  onClick={() => {
                    setScope(option.value);
                    setStep(STEPS.LEVEL);
                  }}
                >
                  <span className="checkin-option__icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ---------- Câu hỏi 2 ---------- */}
        {step === STEPS.LEVEL && (
          <>
            <div className="checkin-emoji">{getLevel(level).icon}</div>

            <h2 className="checkin-title">{getScope(scope).question}</h2>

            <p className="checkin-level-label">{getLevel(level).label}</p>

            <input
              type="range"
              className="checkin-slider"
              min={0}
              max={FEELING_LEVELS.length - 1}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              aria-label={getScope(scope).question}
            />

            <div className="checkin-slider-ends">
              <span>{FEELING_LEVELS[0].label}</span>
              <span>{FEELING_LEVELS[FEELING_LEVELS.length - 1].label}</span>
            </div>

            <div className="checkin-actions">
              <button
                type="button"
                className="checkin-back"
                onClick={() => setStep(STEPS.SCOPE)}
              >
                ← Quay lại
              </button>
              <button type="button" className="checkin-next" onClick={goFromLevel}>
                Tiếp tục →
              </button>
            </div>
          </>
        )}

        {/* ---------- Câu hỏi 3 ---------- */}
        {step === STEPS.EMOTIONS && (
          <>
            <div className="checkin-emoji">{getLevel(level).icon}</div>

            <h2 className="checkin-title">
              Điều gì mô tả đúng nhất về cảm giác này?
            </h2>

            <p className="checkin-hint">Bạn có thể chọn nhiều từ.</p>

            <div className="checkin-chips">
              {EMOTION_WORDS[tone].map((word) => (
                <button
                  key={word}
                  type="button"
                  className={`checkin-chip${
                    emotions.includes(word) ? " checkin-chip--on" : ""
                  }`}
                  onClick={() => setEmotions(toggle(emotions, word))}
                >
                  {word}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="checkin-input"
              placeholder="Cảm xúc khác của bạn..."
              value={customEmotion}
              onChange={(e) => setCustomEmotion(e.target.value)}
            />

            <div className="checkin-actions">
              <button
                type="button"
                className="checkin-back"
                onClick={() => setStep(STEPS.LEVEL)}
              >
                ← Quay lại
              </button>
              <button
                type="button"
                className="checkin-next"
                onClick={() => setStep(STEPS.REASONS)}
              >
                Tiếp tục →
              </button>
            </div>
          </>
        )}

        {/* ---------- Câu hỏi 4 ---------- */}
        {step === STEPS.REASONS && (
          <>
            <div className="checkin-emoji">🧩</div>

            <h2 className="checkin-title">
              Điều gì đang có tác động lớn nhất đối với sự {feelingText} của bạn?
            </h2>

            <p className="checkin-hint">Bạn có thể chọn nhiều điều.</p>

            <div className="checkin-chips">
              {REASON_OPTIONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={`checkin-chip${
                    reasons.includes(reason) ? " checkin-chip--on" : ""
                  }`}
                  onClick={() => setReasons(toggle(reasons, reason))}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="checkin-input"
              placeholder="Điều khác..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />

            <div className="checkin-actions">
              <button
                type="button"
                className="checkin-back"
                onClick={backFromReasons}
              >
                ← Quay lại
              </button>
              <button
                type="button"
                className="checkin-next"
                onClick={() => setStep(STEPS.DETAIL)}
              >
                Tiếp tục →
              </button>
            </div>
          </>
        )}

        {/* ---------- Mô tả chi tiết ---------- */}
        {step === STEPS.DETAIL && (
          <>
            <div className="checkin-emoji">📝</div>

            <h2 className="checkin-title">
              Hãy mô tả chi tiết hơn vì sao {reasonText || "điều đó"} lại làm cho
              bạn {feelingText} để Larry thấu hiểu bạn hơn nhé
            </h2>

            <textarea
              className="checkin-textarea"
              rows={5}
              placeholder="Bạn kể cho Larry nghe nhé... (có thể bỏ trống)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />

            <div className="checkin-actions">
              <button
                type="button"
                className="checkin-back"
                onClick={() => setStep(STEPS.REASONS)}
              >
                ← Quay lại
              </button>
              <button type="button" className="checkin-next" onClick={finish}>
                Bắt đầu trò chuyện 💬
              </button>
            </div>
          </>
        )}

        <button type="button" className="checkin-skip" onClick={onSkip}>
          Bỏ qua, mình muốn chat luôn
        </button>
      </div>
    </div>
  );
}
