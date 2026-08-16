// Cắt câu trả lời của Larry thành từng đoạn đủ ngắn để đọc sớm.
//
// Vì sao phải cắt: endpoint TTS trả về NGUYÊN CỤC — không một mẫu âm thanh nào
// phát được cho tới khi mẫu cuối cùng sinh xong. Đo thật trên model đang dùng:
// một lượt trả lời ~12 giây tiếng nói mất 7–10 giây mới sinh xong (có lần 20s).
// Gửi cả đoạn đi nghĩa là em ngồi nhìn chữ suốt chừng đó rồi tiếng mới vang.
//
// Cắt theo câu thì câu đầu (~2–3 giây tiếng) sinh xong sau ~2–3 giây và phát
// được ngay, mấy câu sau sinh tiếp trong lúc câu đầu đang đọc.
//
// Cắt theo CÂU chứ không theo số ký tự: mỗi lần gọi TTS là một lần model đặt
// ngữ điệu cho trọn vẹn thứ nó nhận được. Cắt giữa câu thì nửa đầu xuống giọng
// như đã hết ý, nửa sau lại lên giọng như bắt đầu câu mới.

// Đoạn ngắn hơn mức này thì gom với câu kế tiếp: mỗi đoạn là một lần gọi API, và
// đọc rời rạc từng câu ba chữ nghe rất giật.
const MIN_CHUNK_CHARS = 60;

// Dài hơn mức này thì cắt cưỡng bức, kể cả khi chưa gặp dấu chấm — model viết
// một mạch không chấm câu thì không có lý do gì để chờ nó.
const MAX_CHUNK_CHARS = 240;

// Hết câu: dấu chấm/hỏi/than (kể cả "...") đứng trước khoảng trắng hoặc cuối
// chuỗi, hoặc một lần xuống dòng. Ràng buộc "đứng trước khoảng trắng" là thứ giữ
// cho "3.5" hay "т.д" không bị coi là hết câu.
const SENTENCE_END = /[.!?…]+(?=\s|$)|\n+/g;

// Phải có ít nhất một chữ cái hoặc chữ số mới đáng gọi TTS. Bong bóng chỉ có
// "😊" hay "..." mà đem đi đọc là tốn một lượt gọi API để nhận về sự im lặng.
const HAS_SPEECH = /[\p{L}\p{N}]/u;

// Chỗ cắt tử tế nhất trong khoảng cho phép: ưu tiên dấu phẩy, không có thì lấy
// khoảng trắng. Cắt giữa từ là chắc chắn sai, nhưng cắt ở nửa đầu đoạn cũng dở
// nên chỉ nhận chỗ cắt nằm sau nửa quãng.
function findBreak(text, limit) {
  const window = text.slice(0, limit);

  const comma = Math.max(
    window.lastIndexOf(","),
    window.lastIndexOf(";"),
    window.lastIndexOf(":")
  );
  if (comma > limit / 2) return comma + 1;

  const space = window.lastIndexOf(" ");
  return space > limit / 2 ? space + 1 : limit;
}

/**
 * Lấy ra những đoạn ĐÃ ĐỌC ĐƯỢC từ phần văn bản chưa xử lý.
 *
 * Gọi được nhiều lần trong lúc chữ còn đang chảy về: lần nào cũng chỉ trả về
 * phần mới hoàn chỉnh, và báo lại đã dùng bao nhiêu ký tự để lần sau biết bắt
 * đầu từ đâu.
 *
 * @param {string}  pending           Phần văn bản chưa được cắt lần nào
 * @param {boolean} [opts.flush]      Tin nhắn đã xong — vét nốt phần đuôi dù
 *                                    chưa có dấu chấm
 * @param {boolean} [opts.fastFirst]  Đây là đoạn đầu tiên của tin nhắn: cho phát
 *                                    ngay ở câu đầu, đừng đợi gom cho đủ dài
 * @returns {{ chunks: string[], usedChars: number }}
 */
export function extractChunks(pending, { flush = false, fastFirst = false } = {}) {
  const chunks = [];
  let used = 0;

  const push = (raw) => {
    const text = raw.trim();
    // Đoạn không có chữ nào thì nuốt luôn (vẫn tính là đã dùng) chứ không gọi API
    if (text && HAS_SPEECH.test(text)) chunks.push(text);
  };

  SENTENCE_END.lastIndex = 0;
  let match;
  while ((match = SENTENCE_END.exec(pending)) !== null) {
    const end = match.index + match[0].length;
    const piece = pending.slice(used, end);

    // Câu đầu của tin nhắn được phát ngay — đây chính là chỗ đổi 10 giây chờ lấy
    // 2–3 giây. Các đoạn sau mới cần gom cho đủ dài.
    const isFirstOfMessage = fastFirst && chunks.length === 0;

    if (isFirstOfMessage || piece.trim().length >= MIN_CHUNK_CHARS) {
      push(piece);
      used = end;
    }
    // Chưa đủ dài: để nguyên đó, gom tiếp với câu sau
  }

  // Viết một mạch không chấm câu thì tự cắt, đừng chờ mãi
  for (;;) {
    const rest = pending.slice(used);
    if (rest.length <= MAX_CHUNK_CHARS) break;

    const cut = findBreak(rest, MAX_CHUNK_CHARS);
    push(rest.slice(0, cut));
    used += cut;
  }

  // Tin nhắn đã hoàn chỉnh: phần đuôi còn lại đọc nốt, kể cả khi Larry kết thúc
  // bằng emoji hay không có dấu chấm cuối
  if (flush) {
    push(pending.slice(used));
    used = pending.length;
  }

  return { chunks, usedChars: used };
}
