import { getAgent } from "../../constants/agents";

// Hiện trong lúc loa ĐANG PHÁT tiếng của Larry, tắt ngay khi đọc xong.
//
// Khác với TypingIndicator (ba chấm — Larry đang NGHĨ): ở đây chữ đã hiện đủ trên
// màn hình rồi, thứ đang chạy là tiếng nói. Không có gì báo thì em không biết nên
// ngồi nghe hay cứ gõ tiếp — nhất là khi loa nhỏ hoặc lớp ồn.
//
// Dùng cột sóng nhấp nhô thay vì chấm nảy để hai trạng thái không lẫn vào nhau.
export default function SpeakingIndicator({ agent }) {
  const info = getAgent(agent);

  return (
    <div
      className="speaking-indicator"
      style={{ "--agent-color": info.color }}
      // Trình đọc màn hình đọc câu này một lần lúc nó xuất hiện. "polite" để nó
      // chờ đọc xong thứ đang đọc dở, không cắt ngang.
      role="status"
      aria-live="polite"
    >
      <span className="speaking-indicator__icon" aria-hidden="true">
        🔊
      </span>

      <span className="speaking-wave" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>

      <p className="speaking-indicator__label">{info.displayName} đang nói...</p>
    </div>
  );
}
