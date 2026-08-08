import React from "react";
import GradientButton from "./GradientButton";
import UserMenu from "./UserMenu";
import "../../styles/GuidePanel.css";

export default function GuidePanel({ instructions, onRate }) {
  return (
    <aside className="guide-panel">
      <div className="guide-panel__header">
        <span className="guide-panel__bulb" role="img" aria-label="bulb">
          💡
        </span>
        <h3 className="guide-panel__title">Hướng dẫn</h3>
      </div>

      <p className="guide-panel__text">
        {instructions ||
          "Nhấn vào lá cờ xanh để bắt đầu kịch bản. Hãy quan sát câu chuyện của Larry, lắng nghe cảm xúc của các nhân vật và chọn hành động phù hợp nhất ở mỗi bước nhé!"}
      </p>

      <div className="guide-panel__illustration">
        <div className="guide-panel__glow" />
        <div className="guide-panel__robot">🤖</div>
        <span className="guide-panel__sparkle guide-panel__sparkle--1">✨</span>
        <span className="guide-panel__sparkle guide-panel__sparkle--2">⭐</span>
        <p className="guide-panel__caption">Mình luôn sẵn sàng giúp bạn!</p>
      </div>

      <div className="guide-panel__footer">
        <UserMenu />
      </div>
    </aside>
  );
}
