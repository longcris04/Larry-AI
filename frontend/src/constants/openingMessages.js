export const OPENING_BY_EMOTION = {
  happy:
    "Chào bạn! 👋\nLarry thấy hôm nay bạn có vẻ vui vẻ đấy!\nBạn có muốn kể cho Larry nghe điều gì vui không?",
  sad:
    "Chào bạn! 👋\nLarry thấy hôm nay bạn có vẻ hơi buồn 😢\nCó chuyện gì xảy ra không? Larry luôn sẵn sàng lắng nghe.",
  angry:
    "Chào bạn! 👋\nLarry thấy bạn có vẻ đang hơi tức giận 😤\nBạn muốn kể cho Larry nghe chuyện gì đã xảy ra không?",
  neutral:
    "Chào bạn! 👋\nLarry thấy bạn đang khá bình thường 😊\nHôm nay bạn thế nào? Có điều gì muốn chia sẻ không?",
  surprised:
    "Chào bạn! 👋\nLarry thấy bạn có vẻ hơi ngạc nhiên 😲\nCó chuyện gì vừa xảy ra không?",
  fearful:
    "Chào bạn! 👋\nLarry thấy bạn có vẻ hơi lo lắng 😨\nBạn có muốn nói cho Larry biết điều gì đang làm bạn lo không?",
  disgusted:
    "Chào bạn! 👋\nLarry thấy bạn có vẻ không thoải mái lắm.\nBạn muốn kể cho Larry nghe chuyện gì đang xảy ra không?",
};

export function getOpeningMessage(emotion) {
  return OPENING_BY_EMOTION[emotion] || OPENING_BY_EMOTION.neutral;
}
