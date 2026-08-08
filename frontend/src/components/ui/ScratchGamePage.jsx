import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import ScratchHeader from "./ScratchHeader";
import ScratchPlayer from "./ScratchPlayer";
import GuidePanel from "./GuidePanel";
import "../../styles/ScratchGamePage.css";

const DEFAULT_SCENARIOS = [
  {
    id: "kb1",
    icon: "🎭",
    title: "KB1 - Không gian an toàn cùng Larry",
    version: "v1.0",
    favorite: false,
    projectId: "1338263357",
    subtitle: "Một kịch bản nhẹ nhàng để khởi động và khám phá cảm xúc.",
    guide:
      "Nhấn nút phát để mở một starter project Scratch. Dùng danh sách bên trái để đổi kịch bản nhanh mà không phải rời khỏi màn hình.",
  },
  {
    id: "kb2",
    icon: "🛡️",
    title: "KB2 - Bắt nạt học đường",
    version: "v1.3",
    favorite: true,
    projectId: "1335121590",
    subtitle: "Quan sát tình huống rồi chọn cách phản ứng phù hợp.",
    guide:
      "Nếu nội dung Scratch chưa hiển thị ngay, bấm nút phát một lần để tải game. Nút tải lại sẽ cho phép mở lại kịch bản từ đầu.",
  },
  {
    id: "kb3",
    icon: "🤝",
    title: "KB3 - Kết bạn mới",
    version: "v1.1",
    favorite: false,
    projectId: "1105114015",
    subtitle: "Tập nhận biết tín hiệu xã hội và cách bắt đầu cuộc trò chuyện.",
    guide: "Mỗi lần chọn kịch bản, tiêu đề và nội dung hướng dẫn sẽ đổi theo để tránh cảm giác bị đứng yên.",
  },
  {
    id: "kb4",
    icon: "🏡",
    title: "KB4 - Gia đình yêu thương",
    version: "v1.0",
    favorite: false,
    projectId: "1105118803",
    subtitle: "Một khung chơi khác để giữ trải nghiệm tươi mới.",
    guide: "Player chỉ tải khi bạn bấm phát, nên chuyển kịch bản sẽ nhanh hơn và đỡ giật hơn.",
  },
  {
    id: "kb5",
    icon: "🌱",
    title: "KB5 - Vượt qua nỗi sợ",
    version: "v1.2",
    favorite: false,
    projectId: "1105113583",
    subtitle: "Dùng cùng một nền Scratch nhưng với hướng dẫn khác để học theo ngữ cảnh.",
    guide: "Mục tiêu chính ở đây là luồng chơi ổn định; khi có project riêng, chỉ cần đổi `projectId` trong dữ liệu này.",
  },
];

export default function ScratchGamePage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [selectedId, setSelectedId] = useState("kb2");

  const selected = scenarios.find((s) => s.id === selectedId) || scenarios[0];

  const toggleFavorite = (id) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s))
    );
  };

  return (
    <div className="game-page">
      <Sidebar
        scenarios={scenarios}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onToggleFavorite={toggleFavorite}
        onDiscoverMore={() => {}}
      />

      <div className="game-page__center">
        <ScratchHeader
          title={selected.title}
          subtitle={selected.subtitle}
          onBack={() => navigate(-1)}
        />
        <ScratchPlayer
          key={selected.projectId}
          projectId={selected.projectId}
          title={selected.title}
          description={selected.subtitle}
        />
      </div>

      <GuidePanel
        instructions={selected.guide}
        onRate={() => {}}
      />
    </div>
  );
}
