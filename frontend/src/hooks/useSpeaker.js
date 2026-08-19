// Loa: đọc câu trả lời của Larry thành tiếng, theo kiểu dây chuyền.
//
// Chữ VẪN hiện đầy đủ trong khung chat — tiếng nói là thêm vào, không thay thế.
// Học sinh tắt loa, máy không có loa, hay đang ngồi trong lớp im lặng thì cuộc
// trò chuyện không mất gì cả.
//
// MẶC ĐỊNH TẮT, và khi tắt thì KHÔNG một lời gọi TTS nào được phát đi — feed()
// và pump() dừng ngay ở dòng đầu. Đây là chỗ tiết kiệm tiền thật sự: em nào
// không bấm nút loa thì lượt chat của em đó không sinh ra chi phí TTS nào cả.
// Lựa chọn tắt/bật nằm ở utils/voicePref.js vì trang đăng nhập cũng bấm được nó.
//
// CÁCH CHẠY: không đợi Larry viết xong cả đoạn rồi mới đọc. Chữ chảy về tới đâu,
// câu nào xong thì đem đi sinh tiếng ngay tới đó (xem utils/speechChunks.js), rồi
// phát nối tiếp nhau:
//
//   chữ:     "Larry nghe bạn kể rồi đây." ──> "Chuyện hôm nay nghe buồn thật." ──> ...
//                        │                              │
//   sinh:            [tiếng 1]                      [tiếng 2]  (song song, tối đa 3 đoạn)
//                        │                              │
//   phát:            ▶ đoạn 1 ────────────────────> ▶ đoạn 2 ────────>
//
// Nhờ vậy tiếng bắt đầu vang sau ~2–3 giây thay vì ~10 giây: chỉ phải chờ sinh
// xong ĐOẠN ĐẦU, không phải chờ cả bài. Mấy đoạn sau sinh sẵn trong lúc đoạn
// trước đang đọc nên nối vào là phát được luôn.

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_TTS_URL } from "../config/api";
import { extractChunks } from "../utils/speechChunks";
import { useVoiceMuted } from "./useVoiceMuted";

// Số đoạn được sinh song song, tính từ đoạn đang đọc. Sinh tiếng nhanh gần bằng
// tốc độ đọc, nên chỉ tải trước đúng một đoạn là vừa đủ hụt hơi mỗi lần model
// chậm bất thường — đo được những cú vọt lên 20 giây. Ba đoạn thì lúc đoạn 1
// đọc xong, đoạn 2 và 3 thường đã nằm sẵn.
const LOOKAHEAD = 3;

export function useSpeaker({ enabled }) {
  // Lựa chọn dùng chung với nút loa ở trang đăng nhập — xem utils/voicePref.js
  const { muted, toggleMuted } = useVoiceMuted();
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  // Hàng đợi các đoạn: { text, status, url, controller }
  //   pending → fetching → ready → playing → played
  //                    ↘ failed (bỏ qua, đọc tiếp đoạn sau)
  const queueRef = useRef([]);
  // Đang đọc tới đoạn thứ mấy
  const playAtRef = useRef(0);
  // Phần văn bản đã cắt thành đoạn rồi. Giữ nguyên chuỗi (không phải số đếm) để
  // nhận ra tin nhắn MỚI: text mới không nối tiếp chuỗi này thì là tin khác.
  const consumedRef = useRef("");
  const audioRef = useRef(null);
  // Tin nhắn đã viết xong chưa. Hàng đợi cạn giữa lúc chữ còn chảy về KHÔNG phải
  // là "đọc xong" — thiếu cờ này thì dòng "Đang nói với bạn..." ở đầu khung chat
  // tắt/bật nhấp nháy mỗi lần Larry đọc hết một đoạn mà đoạn sau chưa sinh kịp.
  const flushedRef = useRef(false);

  // pump/stop gọi lẫn nhau nên phải đi qua ref, nếu không thì vòng phụ thuộc của
  // useCallback không đóng lại được.
  const pumpRef = useRef(() => {});
  const stopRef = useRef(() => {});

  // Đọc trong callback nên phải là ref: bắt trực tiếp thì mỗi lần tắt/bật loa lại
  // sinh ra một bộ callback mới, và effect nào phụ thuộc chúng cũng chạy lại theo.
  const enabledRef = useRef(enabled);
  const mutedRef = useRef(muted);
  useEffect(() => {
    enabledRef.current = enabled;
    mutedRef.current = muted;
  }, [enabled, muted]);

  // Dọn sạch: cắt tiếng đang phát, huỷ mọi request đang bay, và thu hồi URL tạm.
  // Thiếu revokeObjectURL thì mỗi đoạn Larry nói giữ lại vài trăm KB trong bộ nhớ
  // tab cho tới lúc đóng trang.
  const stop = useCallback(() => {
    for (const item of queueRef.current) {
      item.controller?.abort();
      if (item.url) URL.revokeObjectURL(item.url);
    }
    queueRef.current = [];
    playAtRef.current = 0;
    consumedRef.current = "";
    flushedRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    setSpeaking(false);
  }, []);
  stopRef.current = stop;

  const fetchChunk = useCallback(async (item) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(VOICE_TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text: item.text }),
        signal: item.controller.signal
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (item.controller.signal.aborted) return;

      item.url = URL.createObjectURL(blob);
      item.status = "ready";
      pumpRef.current();
    } catch (err) {
      if (err.name === "AbortError") return;

      // Một đoạn hỏng KHÔNG được làm câm cả phần còn lại: đánh dấu rồi đọc tiếp
      // đoạn sau. Mất một câu vẫn hơn mất cả lời khuyên.
      item.status = "failed";
      setError(err.message || "Không đọc được thành tiếng.");
      pumpRef.current();
    }
  }, []);

  const playChunk = useCallback((item) => {
    const audio = new Audio(item.url);
    audioRef.current = audio;
    item.status = "playing";
    setSpeaking(true);

    const advance = () => {
      if (item.url) {
        URL.revokeObjectURL(item.url);
        item.url = null;
      }
      item.status = "played";
      audioRef.current = null;
      playAtRef.current += 1;
      pumpRef.current();
    };

    audio.onended = advance;
    // Tệp âm thanh hỏng thì bỏ qua như đoạn hỏng, đừng đứng im chờ mãi
    audio.onerror = advance;

    audio.play().catch((err) => {
      audioRef.current = null;

      // Trình duyệt chặn tự phát khi trang chưa được bấm vào lần nào. Đây không
      // phải hỏng hóc — bấm nút bất kỳ là mở khoá — nên chỉ ghi log, không đẩy
      // một dòng lỗi đỏ vào giữa cuộc trò chuyện. Dừng hẳn lượt đọc này vì các
      // đoạn sau cũng sẽ bị chặn y hệt.
      if (err.name === "NotAllowedError") {
        console.info("Trình duyệt chặn tự phát tiếng; sẽ đọc được sau khi bạn bấm vào trang.");
        stopRef.current();
        return;
      }

      setError(err.message || "Không phát được tiếng.");
      advance();
    });
  }, []);

  // Trái tim của dây chuyền: gọi lại sau MỖI thay đổi trạng thái (thêm đoạn mới,
  // sinh xong một đoạn, đọc xong một đoạn) và tự quyết định việc tiếp theo.
  const pump = useCallback(() => {
    if (!enabledRef.current || mutedRef.current) return;

    const queue = queueRef.current;

    // Đoạn hỏng nằm ngay trước mặt thì bước qua
    while (queue[playAtRef.current]?.status === "failed") playAtRef.current += 1;

    // Sinh trước vài đoạn, song song. Đây là thứ giữ cho đoạn sau có sẵn vào đúng
    // lúc đoạn trước đọc xong.
    const from = playAtRef.current;
    for (let i = from; i < Math.min(queue.length, from + LOOKAHEAD); i += 1) {
      const item = queue[i];
      if (item.status !== "pending") continue;

      item.status = "fetching";
      item.controller = new AbortController();
      fetchChunk(item);
    }

    // Đang phát dở thì để yên, lúc xong nó tự gọi lại pump
    if (audioRef.current) return;

    const current = queue[from];
    if (!current) {
      // Hết hàng đợi. Chỉ coi là đọc xong khi tin nhắn cũng đã viết xong — còn
      // đang chảy chữ thì đây chỉ là quãng nghỉ chờ đoạn sau, feed() sẽ nạp tiếp.
      if (flushedRef.current) setSpeaking(false);
      return;
    }
    if (current.status === "ready") playChunk(current);
  }, [fetchChunk, playChunk]);
  pumpRef.current = pump;

  /**
   * Nạp văn bản của tin nhắn đang đọc.
   *
   * Gọi được liên tục trong lúc chữ chảy về: mỗi lần chỉ phần MỚI hoàn chỉnh
   * được cắt ra và xếp vào hàng đợi.
   *
   * @param {string}  text            Toàn bộ nội dung bong bóng hiện tại
   * @param {boolean} [opts.flush]    Tin nhắn đã xong, vét nốt phần đuôi
   */
  const feed = useCallback(
    (text, { flush = false } = {}) => {
      if (!enabledRef.current || mutedRef.current) return;

      const full = String(text || "");
      if (!full) return;

      // Không nối tiếp phần đã đọc = một tin nhắn khác đã bắt đầu → bỏ hàng đợi cũ
      if (!full.startsWith(consumedRef.current)) stopRef.current();

      const alreadyRead = consumedRef.current;
      const { chunks, usedChars } = extractChunks(full.slice(alreadyRead.length), {
        flush,
        // Câu ĐẦU TIÊN của tin nhắn được phát ngay, không đợi gom cho đủ dài
        fastFirst: alreadyRead.length === 0
      });

      if (flush) flushedRef.current = true;

      if (usedChars === 0) {
        // Không có đoạn mới, nhưng nếu vừa chốt tin nhắn thì phải gọi pump để nó
        // biết đọc nốt hàng đợi xong là hết, không treo ở trạng thái "đang nói".
        if (flush) pumpRef.current();
        return;
      }
      consumedRef.current = full.slice(0, alreadyRead.length + usedChars);

      for (const chunk of chunks) {
        queueRef.current.push({ text: chunk, status: "pending", url: null, controller: null });
      }

      pumpRef.current();
    },
    []
  );

  // Tắt loa giữa chừng thì im NGAY, không đọc nốt đoạn đang dở. Nghe theo GIÁ TRỊ
  // chứ không gắn vào nút bấm: nút có thể được bấm ở tab khác hoặc ở trang đăng
  // nhập, và cả hai đường đó cũng phải làm Larry im ngay lập tức.
  useEffect(() => {
    if (muted) stopRef.current();
  }, [muted]);

  // Rời màn hình chat mà tiếng còn đang phát thì phải tắt theo
  useEffect(() => stop, [stop]);

  return { muted, toggleMuted, speaking, feed, stop, error };
}
