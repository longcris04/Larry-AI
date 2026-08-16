import React from "react";
import ScenarioCard from "./ScenarioCard";
import "../../styles/Sidebar.css";

export default function Sidebar({ situations = [], selectedId, onSelect }) {
  return (
    <aside className="game-sidebar">
      <div className="game-sidebar__top">
        <h2 className="game-sidebar__title">Chơi với Larry</h2>
        <p className="game-sidebar__subtitle">Học · Hiểu · Hành động</p>
      </div>

      <div className="game-sidebar__divider" />
      <p className="game-sidebar__section-title">Danh sách tình huống mô phỏng</p>

      <div className="game-sidebar__list">
        {situations.map((situation, i) => (
          <ScenarioCard
            key={situation.id}
            index={i + 1}
            title={`Tình huống ${i + 1}`}
            selected={situation.id === selectedId}
            onSelect={() => onSelect?.(situation.id)}
          />
        ))}
      </div>

      <div className="game-sidebar__illustration">
        <div className="game-sidebar__glow" />
        <div className="game-sidebar__robot">🤖</div>
        <span className="game-sidebar__sparkle game-sidebar__sparkle--1">
          ✨
        </span>
        <span className="game-sidebar__sparkle game-sidebar__sparkle--2">
          ⭐
        </span>
      </div>
    </aside>
  );
}
