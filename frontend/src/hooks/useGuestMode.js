// Chế độ khách (trò chuyện không cần đăng nhập) đang bật hay tắt?
//
// Quản trị viên bật/tắt trong trang quản trị, hai chỗ dưới đây phải nghe theo:
//   - trang đăng nhập: có vẽ nút "Trò chuyện với Larry ngay" không
//   - trang giới thiệu: có nhắc tới nút đó trong phần hướng dẫn không
//
// Chỉ còn là một lát cắt của usePublicSettings — cùng một lần gọi /api/settings.
// Giữ lại cái tên này vì nó nói đúng thứ hai nơi trên cần, và nơi nào chỉ quan
// tâm chế độ khách thì không phải đọc qua mấy field không liên quan.

import { usePublicSettings } from "./usePublicSettings";

export function useGuestMode() {
  const { guestMode, loading } = usePublicSettings();
  return { guestMode, loading };
}
