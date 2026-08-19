// Nút tắt/bật giọng nói của Larry.
//
// Cùng MỘT nút, đứng ở hai chỗ khác nhau nên có hai dáng:
//
//   variant="icon"  🔊  — nút tròn ở đầu khung chat, cạnh tên Larry
//   variant="pill"  [🔇 Giọng nói của Larry · Đang tắt] — ở trang đăng nhập, có
//                        chữ đi kèm vì đó là lần đầu em nhìn thấy nó và một biểu
//                        tượng trơ trọi giữa form đăng nhập thì không ai đoán ra
//                        nó làm gì.
//
// Không nhận props trạng thái: nó tự đọc lựa chọn dùng chung (useVoiceMuted), nên
// bấm ở trang đăng nhập thì nút ở khung chat cũng đã ở đúng trạng thái lúc em vào
// tới đó — không cần ai truyền state xuyên qua router.
//
// TẮT = KHÔNG GỌI MODEL TTS. Nút này không chỉ hạ âm lượng: useSpeaker dừng ngay
// từ trước khi có request nào được gửi đi.

import { useVoiceMuted } from "../../hooks/useVoiceMuted";

export default function SpeakerToggle({ variant = "icon", className = "" }) {
  const { muted, toggleMuted } = useVoiceMuted();

  // Nhãn cho trình đọc màn hình nói về VIỆC SẼ XẢY RA khi bấm, còn chữ hiện trên
  // nút (dáng pill) nói về TÌNH TRẠNG HIỆN TẠI. Trộn hai thứ này là nguồn gốc của
  // mấy cái nút "Tắt tiếng" mà bấm vào lại bật tiếng.
  const actionLabel = muted ? "Bật giọng nói của Larry" : "Tắt giọng nói của Larry";

  const common = {
    type: "button",
    onClick: toggleMuted,
    "aria-label": actionLabel,
    "aria-pressed": !muted,
    title: actionLabel
  };

  if (variant === "pill") {
    return (
      <button
        {...common}
        className={`voice-pref ${muted ? "voice-pref--muted" : "voice-pref--on"} ${className}`.trim()}
      >
        <span className="voice-pref__icon" aria-hidden="true">
          {muted ? "🔇" : "🔊"}
        </span>

        <span className="voice-pref__text">
          Giọng nói của Larry
          <strong>{muted ? "Đang tắt — bấm để nghe Larry nói" : "Đang bật — Larry sẽ đọc thành tiếng"}</strong>
        </span>

        {/* Công tắc chỉ để nhìn. Nút thật là cả khối này, nên không lồng thêm
            input nào vào trong — hai vùng bấm chồng nhau thì có lúc bấm trúng
            cái ngoài, có lúc trúng cái trong. */}
        <span className="voice-pref__switch" aria-hidden="true">
          <span className="voice-pref__knob" />
        </span>
      </button>
    );
  }

  return (
    <button {...common} className={`speaker-btn ${muted ? "speaker-btn--muted" : ""} ${className}`.trim()}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
