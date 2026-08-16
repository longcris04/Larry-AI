// Chế độ khách (trò chuyện không cần đăng nhập) đang bật hay tắt?
//
// Quản trị viên bật/tắt trong trang quản trị, hai chỗ dưới đây phải nghe theo:
//   - trang đăng nhập: có vẽ nút "Trò chuyện với Larry ngay" không
//   - trang giới thiệu: có nhắc tới nút đó trong phần hướng dẫn không
//
// Trả về `loading` riêng thay vì đoán đại một giá trị trong lúc chờ. Đoán BẬT thì
// nút hiện ra rồi biến mất trước mắt học sinh; đoán TẮT thì nút nhảy vào giữa
// trang khi đã đọc xong. Cả hai chỗ dùng hook này đều chờ `loading` xong rồi mới
// vẽ, nên nút chỉ xuất hiện một lần và đứng yên.

import { useEffect, useState } from "react";
import { SETTINGS_URL } from "../config/api";

export function useGuestMode() {
  const [state, setState] = useState({ guestMode: false, loading: true });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(SETTINGS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!cancelled) {
          setState({ guestMode: Boolean(data?.guestMode), loading: false });
        }
      } catch {
        // Không hỏi được backend thì coi như TẮT. Vẽ nút ra rồi bấm vào báo lỗi
        // còn khó hiểu hơn là không có nút — nhất là với học sinh tiểu học. Form
        // đăng nhập vẫn nguyên vẹn nên vẫn còn đường vào.
        if (!cancelled) setState({ guestMode: false, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
