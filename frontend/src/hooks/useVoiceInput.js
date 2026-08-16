// Nút micro: thu tiếng nói của học sinh rồi trả về chữ.
//
// Ba trạng thái, và giao diện phải phân biệt được cả ba:
//
//   idle          chưa thu — nút micro bình thường
//   recording     đang nghe — nút đỏ, có nhịp đập
//   transcribing  đã thu xong, đang chờ model đọc ra chữ
//
// Gộp hai trạng thái sau làm một là chỗ dễ sai nhất: em nói xong, thả nút ra, rồi
// KHÔNG có gì báo hiệu trong lúc chờ model — em sẽ tưởng hỏng và bấm lại.
//
// Chữ lấy được đi qua ĐÚNG đường mà tin nhắn gõ tay đi (runTurn của
// useAgentStream), nên nói và gõ chỉ là hai cách nhập của cùng một luồng.

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_STT_URL } from "../config/api";
import { isTooShort, toWavBlob } from "../utils/audio";

// Tự dừng sau 1 phút. Học sinh quên thả nút (hoặc bỏ đi chỗ khác) thì không nên
// thu tiếp mãi rồi tải cả một tệp lớn lên.
const MAX_RECORDING_MS = 60000;

function describeMicError(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Bạn chưa cho phép Larry dùng micro. Bấm vào ổ khoá 🔒 trên thanh địa chỉ để bật nhé!";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Máy của bạn chưa có micro nào.";
    case "NotReadableError":
      return "Micro đang được ứng dụng khác dùng mất rồi.";
    default:
      return err?.message || "Không dùng được micro.";
  }
}

/**
 * @param {(text: string) => void} onTranscript  Gọi khi đã có chữ (bỏ qua nếu rỗng)
 */
export function useVoiceInput(onTranscript) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const autoStopRef = useRef(null);
  // Huỷ giữa chừng thì vẫn phải dọn micro, nhưng KHÔNG được gửi đoạn thu đi
  const cancelledRef = useRef(false);

  // recorder.onstop được gọi CẢ PHÚT sau lúc bấm nút, nên nó ôm nguyên closure
  // của lần render đã bấm. Giữ callback trong ref để lúc đó luôn gọi bản mới nhất
  // — bắt trực tiếp thì đoạn thu đi kèm một runTurn cũ, mang theo giá trị `busy`
  // của thời điểm bấm nút và có thể bị chính nó chặn lại.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const supported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined";

  // Tắt đèn micro ngay khi thu xong. Không dừng track thì trình duyệt vẫn hiện
  // chấm đỏ "đang ghi âm" suốt phiên — đúng thứ khiến phụ huynh lo lắng.
  const releaseMic = useCallback(() => {
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    clearTimeout(autoStopRef.current);
  }, []);

  const sendForTranscript = useCallback(
    async (blob, durationMs) => {
      if (isTooShort(blob, durationMs)) {
        setStatus("idle");
        setError("Đoạn thu ngắn quá. Bạn giữ nút và nói to hơn một chút nhé!");
        return;
      }

      setStatus("transcribing");

      try {
        const wav = await toWavBlob(blob);
        const token = localStorage.getItem("token");

        const res = await fetch(VOICE_STT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: wav
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const text = String(data.text || "").trim();
        if (!text) {
          setError("Larry chưa nghe rõ. Bạn thử nói lại nhé!");
        } else {
          onTranscriptRef.current?.(text);
        }
      } catch (err) {
        setError(err.message || "Không gửi được đoạn thu âm.");
      } finally {
        setStatus("idle");
      }
    },
    []
  );

  const start = useCallback(async () => {
    if (!supported || status !== "idle") return;

    setError("");
    cancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Loa đang đọc lời Larry thì micro nghe thấy chính giọng đó. Ba tuỳ
          // chọn này để trình duyệt tự lọc tiếng vọng và tiếng ồn lớp học.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        releaseMic();

        if (cancelledRef.current) {
          setStatus("idle");
          return;
        }
        sendForTranscript(blob, duration);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setStatus("recording");

      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      releaseMic();
      setStatus("idle");
      setError(describeMicError(err));
    }
  }, [supported, status, releaseMic, sendForTranscript]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  const clearError = useCallback(() => setError(""), []);

  // Rời màn hình giữa lúc đang thu: dọn micro, đừng gửi gì đi nữa
  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMic();
    },
    [releaseMic]
  );

  return {
    supported,
    status,
    error,
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
    start,
    stop,
    cancel,
    clearError
  };
}
