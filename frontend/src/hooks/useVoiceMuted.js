// Lựa chọn tắt/bật tiếng Larry, dưới dạng state của React.
//
// Mỏng có chủ đích: toàn bộ phần lưu và đồng bộ nằm ở utils/voicePref.js. Hook
// này chỉ làm một việc — biến nó thành thứ React vẽ lại được. Nhờ vậy nút loa ở
// trang đăng nhập, nút loa ở khung chat và useSpeaker cùng đọc MỘT giá trị: bấm
// ở đâu thì cả ba chỗ đổi theo ngay.

import { useCallback, useEffect, useState } from "react";
import { isVoiceMuted, setVoiceMuted, subscribeVoiceMuted } from "../utils/voicePref";

export function useVoiceMuted() {
  const [muted, setMuted] = useState(isVoiceMuted);

  useEffect(() => subscribeVoiceMuted(setMuted), []);

  // Đọc lại từ nguồn thay vì lật `muted` đang giữ: giữa lúc bấm, một tab khác có
  // thể đã đổi giá trị rồi.
  const toggleMuted = useCallback(() => {
    setVoiceMuted(!isVoiceMuted());
  }, []);

  return { muted, toggleMuted };
}
