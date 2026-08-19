// Những gì NGƯỜI CHƯA ĐĂNG NHẬP được biết về máy chủ.
//
// Trang đăng nhập phải quyết định hai thứ trước khi có bất kỳ token nào:
//   - có vẽ nút "Trò chuyện với Larry ngay" không  (quản trị viên bật/tắt)
//   - có vẽ nút loa không                          (máy chủ đã khai TTS_MODEL chưa)
//
// Cả hai lấy từ MỘT lần gọi /api/settings — đường công khai, cố ý chỉ trả về mấy
// giá trị đúng/sai, không có tên model hay khoá API nào (xem backend/server.js).
//
// Trả `loading` riêng thay vì đoán đại một giá trị trong lúc chờ. Đoán BẬT thì
// nút hiện ra rồi biến mất trước mắt học sinh; đoán TẮT thì nút nhảy vào giữa
// trang khi đã đọc xong. Nơi dùng chờ `loading` xong rồi mới vẽ, nên nút chỉ xuất
// hiện một lần và đứng yên.

import { useEffect, useState } from "react";
import { SETTINGS_URL } from "../config/api";

// Hỏi không được (mất mạng, backend đang ngủ) thì coi như mọi tính năng thêm đều
// TẮT. Vẽ nút ra rồi bấm vào báo lỗi còn khó hiểu hơn là không có nút — nhất là
// với học sinh nhỏ tuổi. Form đăng nhập vẫn nguyên vẹn nên vẫn còn đường vào.
const OFFLINE = { guestMode: false, voice: { stt: false, tts: false } };

export function usePublicSettings() {
  const [state, setState] = useState({ ...OFFLINE, loading: true });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(SETTINGS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (cancelled) return;

        setState({
          guestMode: Boolean(data?.guestMode),
          voice: {
            stt: Boolean(data?.voice?.stt),
            tts: Boolean(data?.voice?.tts)
          },
          loading: false
        });
      } catch {
        if (!cancelled) setState({ ...OFFLINE, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
