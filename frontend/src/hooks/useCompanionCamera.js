// Một cái camera duy nhất cho cả phiên, và MỘT lần nhận diện cảm xúc duy nhất.
//
// Học sinh được bật/tắt camera bao nhiêu lần tuỳ thích — nhân vật mở mắt hay
// nhắm mắt theo đó. Nhưng việc ĐỌC CẢM XÚC chỉ chạy đúng một lần trong đời phiên
// chat: lần đầu tiên có luồng hình. Bật lại camera lần thứ hai KHÔNG đọc lại.
//
// Vì sao: cảm xúc đọc được là ảnh chụp lúc em vừa bước vào, dùng để Larry mở lời
// cho đúng. Đọc lại liên tục thì mỗi lượt chat lại gửi lên một cảm xúc khác —
// bảng theo dõi của thầy cô sẽ thấy em "đổi tâm trạng" xoành xoạch chỉ vì em vừa
// ngáp hay vừa quay mặt đi.

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

// Đặt REACT_APP_FAKE_EMOTION trong frontend/.env để bỏ hẳn camera khi demo:
//   REACT_APP_FAKE_EMOTION=neutral
// Có sẵn cảm xúc thì coi như đã đọc xong, camera không bao giờ được bật.
const FAKE_EMOTION = process.env.REACT_APP_FAKE_EMOTION || "";

// Không thấy mặt trong chừng này thì thôi, coi như bước đọc cảm xúc đã xong mà
// không có kết quả — che ống kính hay ngồi ngược sáng thì chờ mãi cũng vậy.
const DETECT_TIMEOUT_MS = 15000;
const DETECT_INTERVAL_MS = 700;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function strongestExpression(expressions) {
  return Object.keys(expressions).reduce((a, b) => (expressions[a] > expressions[b] ? a : b));
}

export function useCompanionCamera() {
  // off = chưa bật / đã tắt, pending = đang xin quyền, on = đang thấy hình,
  // denied = trình duyệt hoặc học sinh từ chối
  const [status, setStatus] = useState("off");
  const [stream, setStream] = useState(null);
  const [emotion, setEmotion] = useState(FAKE_EMOTION || null);

  // Bước đọc cảm xúc đã KẾT THÚC hay chưa — kết thúc mà không có kết quả cũng
  // tính. Đây mới là thứ quyết định lúc nào Larry được phép mở lời, chứ không
  // phải bản thân cảm xúc.
  const [emotionReady, setEmotionReady] = useState(Boolean(FAKE_EMOTION));

  // Bước đọc cảm xúc đã KHÉP LẠI hay chưa. Một khi đã true thì không bao giờ mở
  // ra nữa — đây chính là lời hứa "chỉ nhận diện đúng một lần".
  const doneRef = useRef(Boolean(FAKE_EMOTION));
  // Đang có một lượt đọc chạy dở. Khác doneRef ở chỗ nó ĐƯỢC phép quay về false:
  // React ở chế độ nghiêm ngặt dựng effect lên, dọn đi, rồi dựng lại: khoá cứng
  // ngay từ lúc bắt đầu thì ở môi trường phát triển lượt đọc thật không bao giờ
  // chạy, vì lượt đầu đã bị huỷ mất rồi.
  const runningRef = useRef(false);
  // Đã từng thật sự có luồng hình để đọc hay chưa
  const attemptedRef = useRef(Boolean(FAKE_EMOTION));
  const streamRef = useRef(null);

  const open = useCallback(async () => {
    if (FAKE_EMOTION) return false;
    if (streamRef.current) return true;

    setStatus("pending");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      streamRef.current = media;
      setStream(media);
      setStatus("on");
      return true;
    } catch (err) {
      console.warn("Không mở được camera:", err?.name || err);
      setStatus("denied");
      // Không mở được thì cũng không còn gì để đọc nữa — đừng giam cuộc trò
      // chuyện lại chờ một cảm xúc sẽ không bao giờ tới.
      setEmotionReady(true);
      return false;
    }
  }, []);

  const close = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setStatus("off");
  }, []);

  // Học sinh chọn không dùng camera: bước đọc cảm xúc coi như xong, phần cảm xúc
  // để Larry hỏi thẳng trong lúc trò chuyện.
  const skipEmotion = useCallback(() => setEmotionReady(true), []);

  // Camera tắt sau khi đã từng bật = em chủ động dừng. Coi như bước đọc cảm xúc
  // khép lại tại đây: bật lại lần nữa KHÔNG đọc lại, và khung chat không phải
  // ngồi chờ một cảm xúc sẽ không bao giờ tới.
  useEffect(() => {
    if (status !== "off" || !attemptedRef.current || doneRef.current) return;
    doneRef.current = true;
    setEmotionReady(true);
  }, [status]);

  useEffect(() => {
    if (!stream || doneRef.current || runningRef.current) return;
    runningRef.current = true;
    attemptedRef.current = true;

    let cancelled = false;

    // Thẻ video riêng cho việc nhận diện, KHÔNG dùng chung với khung xem trước
    // trên màn hình: khung xem trước bị gỡ đi lúc em tắt camera giữa chừng, mà
    // face-api thì cần một thẻ video còn sống để đọc khung hình.
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    video.srcObject = stream;

    const finish = (result) => {
      if (cancelled) return;
      doneRef.current = true;
      if (result) setEmotion(result);
      setEmotionReady(true);
    };

    (async () => {
      try {
        await video.play();
      } catch {
        /* Vài trình duyệt chặn autoplay; vòng lặp dưới vẫn chờ khung hình */
      }

      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      } catch (err) {
        console.warn("Không tải được model nhận diện:", err.message);
        finish(null);
        return;
      }

      const deadline = Date.now() + DETECT_TIMEOUT_MS;

      while (!cancelled && Date.now() < deadline) {
        // readyState thôi chưa đủ: phải có kích thước thật, nếu không face-api
        // sẽ nhân toạ độ khung mặt với 0 rồi ném lỗi Box.constructor.
        if (video.readyState === 4 && video.videoWidth && video.videoHeight) {
          let detection = null;
          try {
            // PHẢI gọi .run(). Đối tượng task của face-api có then(onfulfilled)
            // chỉ nhận MỘT tham số, nên `await task` bỏ rơi hàm reject: lỗi bên
            // trong thành unhandled rejection còn await thì treo mãi.
            detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
              .withFaceExpressions()
              .run();
          } catch (err) {
            // Camera bị ngắt ngay giữa lúc đang đọc — bỏ qua lượt này
            console.warn("Bỏ qua một lượt nhận diện:", err.message);
          }

          if (detection) {
            finish(strongestExpression(detection.expressions));
            return;
          }
        }

        await sleep(DETECT_INTERVAL_MS);
      }

      finish(null);
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
      video.srcObject = null;
      video.remove();
    };
  }, [stream]);

  // Rời màn hình thì tắt webcam, đừng để đèn camera sáng sau lưng em
  useEffect(() => close, [close]);

  return {
    status,
    stream,
    isOn: status === "on",
    emotion,
    emotionReady,
    open,
    close,
    skipEmotion,
    // Camera hoàn toàn không dùng được ở phiên này (demo bằng cảm xúc giả)
    unavailable: Boolean(FAKE_EMOTION)
  };
}
