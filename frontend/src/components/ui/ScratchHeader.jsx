import React from "react";
import "../../styles/ScratchHeader.css";

export default function ScratchHeader({ title, subtitle, onBack }) {
  return (
    <div className="scratch-header">
      <button type="button" className="scratch-header__back" onClick={onBack} aria-label="Quay lại">
        ←
      </button>

      <div className="scratch-header__avatar">
        <span role="img" aria-label="Larry">
          🤖
        </span>
      </div>

      <div className="scratch-header__text">
        <h2 className="scratch-header__title">{title}</h2>
        <p className="scratch-header__subtitle">{subtitle}</p>
      </div>

      <div className="scratch-header__deco">
        <span role="img" aria-label="rainbow">
          🌈
        </span>
        <span role="img" aria-label="star">
          ⭐
        </span>
      </div>
    </div>
  );
}
