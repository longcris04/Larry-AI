import React from "react";
import "../../styles/ScenarioCard.css";

export default function ScenarioCard({
  icon = "🎮",
  title,
  version,
  favorite = false,
  selected = false,
  onSelect,
  onToggleFavorite,
}) {
  return (
    <button
      type="button"
      className={`scenario-card ${selected ? "scenario-card--selected" : ""}`}
      onClick={onSelect}
    >
      <span className="scenario-card__icon">{icon}</span>
      <span className="scenario-card__body">
        <span className="scenario-card__title">{title}</span>
        <span className="scenario-card__version">{version}</span>
      </span>
      <span
        className={`scenario-card__star ${favorite ? "scenario-card__star--active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite?.();
        }}
        role="button"
        aria-label="favorite"
      >
        {favorite ? "★" : "☆"}
      </span>
    </button>
  );
}
