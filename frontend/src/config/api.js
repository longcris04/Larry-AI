// Địa chỉ backend. Khi chạy local, đặt REACT_APP_API_URL=http://localhost:5000
// trong file frontend/.env (xem frontend/.env.example).
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://emotion-ai-chat.onrender.com";

export const CHAT_URL = `${API_BASE_URL}/chat`;
// Đường chính: SSE, phát sự kiện của từng agent để giao diện hiện được ai đang làm việc
export const CHAT_STREAM_URL = `${API_BASE_URL}/chat/stream`;
export const SESSION_END_URL = `${API_BASE_URL}/api/session/end`;

// Kho tri thức Larry truy vấn, bản công khai cho trang giới thiệu vẽ đồ thị
export const KNOWLEDGE_GRAPH_URL = `${API_BASE_URL}/api/knowledge/graph`;

// Cài đặt quản trị viên bật/tắt được — hiện có mỗi chế độ khách. Đường đọc là
// CÔNG KHAI vì trang đăng nhập phải biết trước khi có ai đăng nhập; đường ghi
// nằm sau /api/admin nên chỉ quản trị viên đổi được.
export const SETTINGS_URL = `${API_BASE_URL}/api/settings`;
export const ADMIN_GUEST_MODE_URL = `${API_BASE_URL}/api/admin/settings/guest-mode`;

// Hai đường link khảo sát ý kiến, khai trong backend/.env
// (STUDENT_FEEDBACK_FORM / TEACHER_FEEDBACK_FORM)
export const FEEDBACK_LINKS_URL = `${API_BASE_URL}/api/feedback-links`;

// Tài liệu hướng dẫn sử dụng, khai trong backend/.env (USER_GUIDE_URL).
// Trang giới thiệu hỏi đường này để biết có vẽ nút "Xem hướng dẫn" hay không.
export const GUIDE_LINK_URL = `${API_BASE_URL}/api/guide`;

// Giọng nói. Micro và loa chỉ hiện ra khi VOICE_CONFIG_URL báo là backend đã khai
// đủ model — xem backend/routes/voice.js.
export const VOICE_CONFIG_URL = `${API_BASE_URL}/api/voice/config`;
export const VOICE_STT_URL = `${API_BASE_URL}/api/voice/stt`;
export const VOICE_TTS_URL = `${API_BASE_URL}/api/voice/tts`;
