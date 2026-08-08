import { EMOTION_CONFIG, DEFAULT_EMOTION } from "../../constants/emotions";

export default function EmotionBadge({ emotion }) {
  const config = emotion
    ? EMOTION_CONFIG[emotion] || DEFAULT_EMOTION
    : DEFAULT_EMOTION;

  return (
    <div className={`emotion-badge ${config.cssClass}`}>
      <span className="emotion-badge__icon">{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}
