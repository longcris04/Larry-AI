import { useNavigate } from "react-router-dom";

export default function ScratchButton() {
  const navigate = useNavigate();

  return (
    <div className="scratch-btn-wrap">
      <button
        type="button"
        className="scratch-btn"
        onClick={() => navigate("/game")}
      >
        🎮 Chơi với Larry
      </button>
    </div>
  );
}
