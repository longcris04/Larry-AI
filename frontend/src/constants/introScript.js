// Lời thoại của đoạn mở đầu — toàn bộ chữ nghĩa nằm ở đây, còn mạch chuyện nằm
// ở hooks/useIntroScript.js.
//
// Phần sau lời chào chính là PHIẾU CẢM XÚC cũ, được viết lại thành câu hỏi có
// lựa chọn để bấm. Nội dung phiếu (mức độ, bộ từ cảm xúc, các nhóm nguyên nhân)
// vẫn lấy từ constants/checkin.js — chỉ đổi cách hỏi, không đổi dữ liệu gửi về
// backend.

import { FEELING_LEVELS, getLevel, getScope, joinVi, SCOPE_OPTIONS, REASON_OPTIONS, EMOTION_WORDS } from "./checkin";

export const HINTS = {
  // Larry tự nói tiếp, chạm chỉ để đi nhanh hơn — nói đúng như vậy, đừng để em
  // ngồi chờ một cái chạm mà hệ thống không hề đợi.
  faster: "chạm nếu bạn muốn nhanh hơn",
  choose: "chọn điều bạn thấy đúng",
  pick: "chọn bao nhiêu cũng được, xong thì bấm nút bên dưới",
  write: "viết nhiều hay ít đều được"
};

// --- Lời chào và xin phép camera -------------------------------------------

// Người nói LUÔN LUÔN là Larry. Bộ sưu tập nhân vật chỉ đổi GƯƠNG MẶT — prompt
// ở backend dặn model tự giới thiệu "Mình là Larry", nên đặt tên khác ở giao diện
// là ngay câu trả lời đầu tiên trong chat đã đá nhau.
export const ASSISTANT_NAME = "Larry";

export const GREETING = [
  `Chào bạn! Mình là ${ASSISTANT_NAME} 👋`,
  "Mình vui lắm vì có bạn ở đây.",
  "Mình hỏi bạn một điều trước nhé?"
];

export const CONSENT_QUESTION = "Bạn có muốn mình mở mắt khi nói chuyện không?";
export const CONSENT_NOTE = "Nghĩa là bạn cho mình dùng camera đó.";

export const CONSENT_CHOICES = [
  { value: "yes", label: "👀 Được, bạn mở mắt đi" },
  { value: "no", label: "💬 Thôi, mình trò chuyện thôi" }
];

export const CAMERA_ON_LINES = [
  "Được rồi 💛",
  "Cảm ơn bạn đã tin mình.",
  "Và nhớ nhé — lúc nào bạn cũng có thể bảo mình nhắm mắt lại."
];

export const CAMERA_SAW_YOU = ["Chào bạn lần nữa 👀", "Mình nhìn thấy bạn rồi này."];

export const CAMERA_FAILED = [
  "Hình như camera muốn tắt rồi.",
  "Không sao đâu.",
  "Mình vẫn nói chuyện ở đây được mà."
];

export const CAMERA_OFF_LINES = [
  "Tất nhiên rồi 💛",
  "Bạn không cần cho mình xem gì cả.",
  "Mình vẫn ở ngay đây với bạn."
];

// --- Phiếu cảm xúc, kể thành chuyện ----------------------------------------

export const CHECKIN_OPENING = [
  "Vậy…",
  "Trước khi mình nói chuyện thoải mái, cho mình hiểu hôm nay bạn thế nào nhé?"
];

export const SCOPE_QUESTION = "Bạn muốn kể cho mình nghe về điều nào?";

export const SCOPE_CHOICES = SCOPE_OPTIONS.map((option) => ({
  value: option.value,
  label: `${option.icon} ${option.label}`
}));

export const levelQuestion = (scope) => getScope(scope).question;

export const LEVEL_CHOICES = FEELING_LEVELS.map((level) => ({
  value: level.value,
  label: `${level.icon} ${level.label}`
}));

// Larry đáp lại mức độ em vừa chọn, trước khi hỏi tiếp
export const LEVEL_REPLIES = {
  unpleasant: ["Nghe như hôm nay không dễ dàng với bạn.", "Cảm ơn bạn đã nói thật với mình."],
  neutral: ["Ừ, có những ngày bình bình như thế.", "Bình thường cũng là một cảm giác mà."],
  pleasant: ["Nghe vui ghê 💛", "Mình mừng cho bạn."]
};

export const EMOTION_QUESTION = "Từ nào tả đúng nhất cảm giác đó?";

export const emotionChoices = (tone) =>
  (EMOTION_WORDS[tone] || []).map((word) => ({ value: word, label: word }));

export const EMOTION_REPLIES = ["Mình ghi lại rồi nhé.", "Cảm ơn bạn đã tìm đúng từ cho nó."];

export const reasonQuestion = (feeling) =>
  `Điều gì đang ảnh hưởng nhiều nhất tới việc bạn thấy ${feeling}?`;

export const REASON_CHOICES = REASON_OPTIONS.map((reason) => ({ value: reason, label: reason }));

export const detailQuestion = (reason, feeling) =>
  reason
    ? `Bạn kể thêm cho mình nghe vì sao ${reason} lại làm bạn ${feeling} nhé?`
    : `Bạn kể thêm cho mình nghe vì sao bạn thấy ${feeling} nhé?`;

export const CHECKIN_DONE = [
  "Cảm ơn bạn đã kể cho mình nghe 💛",
  "Giờ mình trò chuyện thoải mái nhé — bạn muốn hỏi gì, kể gì cũng được."
];

// Câu chốt gộp lại những gì em vừa điền, để em thấy Larry thật sự nghe được
export function summariseCheckin(draft) {
  const feeling = joinVi(draft.emotions).toLowerCase() || getLevel(draft.level).label.toLowerCase();
  const reason = joinVi(draft.reasons).toLowerCase();
  if (reason) return `Vậy là hôm nay bạn thấy ${feeling}, và ${reason} đang ảnh hưởng nhiều nhất.`;
  return `Vậy là hôm nay bạn thấy ${feeling}.`;
}

// --- Chữ trên các nút ------------------------------------------------------

export const UI_TEXT = {
  you: "BẠN",
  waiting: "…",
  pickDone: "Xong rồi ✓",
  pickSkip: "Mình chưa muốn nói",
  customEmotion: "Cảm xúc khác của bạn...",
  customReason: "Điều khác...",
  detailPlaceholder: "Bạn kể cho mình nghe nhé... (có thể bỏ trống)",
  detailSend: "Gửi cho Larry 💙",
  detailSkip: "Mình chưa muốn kể",
  eyesOpen: "👁 Đang mở mắt",
  eyesShut: "🙈 Đang nhắm mắt",
  eyesOpenTitle: "Mình đang mở mắt",
  eyesShutTitle: "Mình đang nhắm mắt",
  eyesOpenText: "Mình nhìn thấy bạn. Hình ảnh không được lưu hay gửi đi đâu cả — mình chỉ đọc cảm xúc đúng một lần lúc đầu thôi.",
  eyesShutText: "Mình không nhìn thấy bạn lúc này. Hoàn toàn ổn nhé.",
  eyesCloseAction: "🙈 Cho mình nhắm mắt lại",
  eyesOpenAction: "👀 Cho mình nhìn bạn",
  notNow: "Để sau",
  grownUp: "🫂 Nói với người lớn",
  grownUpTitle: "Có những chuyện quá lớn với mình",
  grownUpText: [
    "Mình là một người bạn nhỏ cho cảm xúc — không phải bác sĩ, thầy cô hay bố mẹ.",
    "Nếu có điều gì làm bạn sợ hoặc làm bạn đau, hãy nói với một người lớn bạn tin: bố mẹ, thầy cô, hoặc cán bộ tư vấn học đường.",
    "Nếu bạn đang gặp nguy hiểm ngay lúc này, hãy gọi 111 (bảo vệ trẻ em), 113 (công an) hoặc 115 (cấp cứu)."
  ],
  close: "Đóng",
  companion: "🎭 Đổi gương mặt",
  companionTitle: "Chọn gương mặt cho Larry",
  companionText: "Vẫn là Larry đang nghe bạn kể — bạn chỉ chọn gương mặt mình thích thôi."
};
