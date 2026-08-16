import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import ScratchHeader from "./ScratchHeader";
import ScratchPlayer from "./ScratchPlayer";
import GuidePanel from "./GuidePanel";
import "../../styles/ScratchGamePage.css";

// Ba tình huống mô phỏng, chạy bằng Scratch nhúng thẳng vào trang.
//
// CỐ Ý KHÔNG ĐẶT TÊN cho từng tình huống. Đây là các tình huống mô phỏng CHUNG để
// tập cách ứng xử, không cái nào được làm riêng cho một dạng bắt nạt học đường
// nào cả. Đặt tên gợi nội dung như bản cũ ("Bắt nạt học đường", "Vượt qua nỗi
// sợ"...) là hứa với học sinh một thứ không có trong game — cùng lý do đã gỡ phần
// agent chọn kịch bản theo hoàn cảnh (xem GAME_RULES trong
// backend/agents/prompts/shared.js).
//
// Thêm hay bớt tình huống thì sửa đúng mảng này; số thứ tự hiện ra tự đánh theo
// vị trí, không phải sửa chỗ nào khác.
const SITUATIONS = [
  { id: "th1", projectId: "1365672954" },
  { id: "th2", projectId: "1365672845" },
  { id: "th3", projectId: "1365667987" }
];

const situationLabel = (index) => `Tình huống ${index + 1}`;

// Hướng dẫn dùng chung cho cả ba — không tình huống nào cần lời dặn riêng.
const GUIDE =
  "Bấm lá cờ xanh trong khung để bắt đầu. Xem tình huống diễn ra rồi chọn cách " +
  "ứng xử mà bạn thấy đúng nhất ở mỗi bước. Muốn xem tình huống khác thì chọn ở " +
  "danh sách bên trái, không cần rời khỏi trang.";

export default function ScratchGamePage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(SITUATIONS[0].id);

  const foundIndex = SITUATIONS.findIndex((s) => s.id === selectedId);
  const index = foundIndex === -1 ? 0 : foundIndex;
  const selected = SITUATIONS[index];

  return (
    <div className="game-page">
      <Sidebar
        situations={SITUATIONS}
        selectedId={selected.id}
        onSelect={setSelectedId}
      />

      <div className="game-page__center">
        <ScratchHeader
          title={situationLabel(index)}
          subtitle="Xem tình huống rồi chọn cách ứng xử phù hợp"
          onBack={() => navigate(-1)}
        />
        {/* key = projectId: đổi tình huống thì dựng lại iframe từ đầu, không thì
            Scratch vẫn chạy tiếp project cũ trong cùng một khung. */}
        <ScratchPlayer
          key={selected.projectId}
          projectId={selected.projectId}
          title={situationLabel(index)}
        />
      </div>

      <GuidePanel instructions={GUIDE} />
    </div>
  );
}
