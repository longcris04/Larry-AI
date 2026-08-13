// Lời mở đầu do frontend hiển thị trước khi backend trả lời.
// Xưng hô phải khớp với luật trong backend/agents/prompts/shared.js (PERSONA):
// Larry xưng "mình", gọi học sinh là "bạn", và chỉ nhắc tên Larry đúng một lần
// ở câu tự giới thiệu này.
export const OPENING_BY_EMOTION = {
  happy:
    "Chào bạn, mình là Larry! 👋\nMình thấy hôm nay bạn có vẻ vui vẻ đấy!\nBạn có muốn kể cho mình nghe điều gì vui không?",
  sad:
    "Chào bạn, mình là Larry! 👋\nMình thấy hôm nay bạn có vẻ hơi buồn 😢\nCó chuyện gì xảy ra không? Mình luôn sẵn sàng lắng nghe.",
  angry:
    "Chào bạn, mình là Larry! 👋\nMình thấy bạn có vẻ đang hơi tức giận 😤\nBạn muốn kể cho mình nghe chuyện gì đã xảy ra không?",
  neutral:
    "Chào bạn, mình là Larry! 👋\nMình thấy bạn đang khá bình thường 😊\nHôm nay bạn thế nào? Có điều gì muốn chia sẻ không?",
  surprised:
    "Chào bạn, mình là Larry! 👋\nMình thấy bạn có vẻ hơi ngạc nhiên 😲\nCó chuyện gì vừa xảy ra không?",
  fearful:
    "Chào bạn, mình là Larry! 👋\nMình thấy bạn có vẻ hơi lo lắng 😨\nBạn có muốn nói cho mình biết điều gì đang làm bạn lo không?",
  disgusted:
    "Chào bạn, mình là Larry! 👋\nMình thấy bạn có vẻ không thoải mái lắm.\nBạn muốn kể cho mình nghe chuyện gì đang xảy ra không?",
};

export function getOpeningMessage(emotion) {
  return OPENING_BY_EMOTION[emotion] || OPENING_BY_EMOTION.neutral;
}
