import React from "react";
import "../../styles/ScenarioCard.css";

// Một dòng trong danh sách tình huống mô phỏng.
//
// Không còn tên riêng, không còn số phiên bản, không còn nút gắn sao: các tình
// huống chỉ khác nhau ở thứ tự, nên ô vuông bên trái hiện đúng số thứ tự.
export default function ScenarioCard({ index, title, selected = false, onSelect }) {
  return (
    <button
      type="button"
      className={`scenario-card ${selected ? "scenario-card--selected" : ""}`}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
    >
      <span className="scenario-card__icon">{index}</span>
      <span className="scenario-card__body">
        <span className="scenario-card__title">{title}</span>
      </span>
    </button>
  );
}
