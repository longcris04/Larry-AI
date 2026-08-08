// Địa chỉ backend. Khi chạy local, đặt REACT_APP_API_URL=http://localhost:5000
// trong file frontend/.env (xem frontend/.env.example).
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://emotion-ai-chat.onrender.com";

export const CHAT_URL = `${API_BASE_URL}/chat`;
// Đường chính: SSE, phát sự kiện của từng agent để giao diện hiện được ai đang làm việc
export const CHAT_STREAM_URL = `${API_BASE_URL}/chat/stream`;
export const SESSION_END_URL = `${API_BASE_URL}/api/session/end`;
