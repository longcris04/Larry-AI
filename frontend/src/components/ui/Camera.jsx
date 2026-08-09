import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import EmotionBadge from "./EmotionBadge";

// Trình duyệt KHÔNG báo lỗi khi học sinh cứ để yên hộp xin quyền camera, và cũng
// có máy webcam bật được nhưng chẳng bao giờ thấy mặt (ngược sáng, che ống kính).
// Sau chừng này thì hiện nút bỏ qua, để bước camera không giam em ở màn hình chờ.
const SKIP_BUTTON_DELAY_MS = 8000;

export default function Camera({ onEmotionDetected, onUnavailable }) {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  // Nhận diện xong lần đầu là khoá lại, giữ nguyên cảm xúc đó suốt phiên chat
  const [emotionLocked, setEmotionLocked] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  // Bước camera chỉ được báo kết quả ĐÚNG MỘT LẦN. onUserMediaError có thể nổ
  // nhiều lần, và lỗi camera đến sau khi đã chốt được cảm xúc thì không còn nghĩa
  // lý gì nữa — báo lại sẽ ghi đè kết quả tốt bằng một lần bỏ qua.
  const settledRef = useRef(false);

  // Camera không dùng được → KHÔNG chặn đường vào khung chat. Cuộc trò chuyện đi
  // tiếp mà không có tín hiệu camera, phần cảm xúc để Larry hỏi trong chat.
  const giveUp = useCallback(
    (reason) => {
      if (settledRef.current) return;
      settledRef.current = true;
      onUnavailable?.(reason);
    },
    [onUnavailable]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        if (!cancelled) setModelsLoaded(true);
      } catch (err) {
        // Thiếu file trong /models hoặc mạng hỏng: cũng là camera không dùng được
        console.warn("Không tải được model nhận diện:", err.message);
        if (!cancelled) giveUp("model");
      }
    }

    loadModels();
    return () => {
      cancelled = true;
    };
  }, [giveUp]);

  useEffect(() => {
    if (emotionLocked) return;
    const timer = setTimeout(() => setCanSkip(true), SKIP_BUTTON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [emotionLocked]);

  useEffect(() => {
    if (!modelsLoaded || emotionLocked) return;

    let stopped = false;
    // Một lượt nhận diện mất vài trăm ms, có lúc lâu hơn cả nhịp interval. Không
    // khoá lại thì nhiều lượt chạy chồng nhau, và lượt cũ vẫn còn đang chạy khi
    // video đã bị gỡ — đúng lúc face-api ném lỗi Box.constructor.
    let detecting = false;

    const interval = setInterval(async () => {
      if (detecting || stopped) return;

      const video = webcamRef.current?.video;

      // readyState thôi chưa đủ: phải có kích thước thật, nếu không face-api
      // sẽ nhân toạ độ khung mặt với 0/undefined và ném lỗi Box.constructor
      if (!video || video.readyState !== 4) return;
      if (!video.videoWidth || !video.videoHeight) return;

      let detection;
      detecting = true;
      try {
        // PHẢI gọi .run(). Đối tượng task của face-api có then(onfulfilled) chỉ
        // nhận MỘT tham số, nên `await task` đưa hàm reject vào rồi bị bỏ rơi:
        // lỗi bên trong biến thành unhandled rejection (React hiện overlay đỏ)
        // còn await ở đây thì treo mãi không settle — try/catch không đỡ được gì.
        // .run() trả về promise bình thường nên lỗi rơi đúng vào catch bên dưới.
        detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions()
          .run();
      } catch (err) {
        // Xảy ra khi webcam bị ngắt giữa lúc đang nhận diện (đổi trang, tắt
        // quyền camera, hoặc khung hình vừa bị gỡ). Bỏ qua lượt này.
        console.warn("Bỏ qua một lượt nhận diện:", err.message);
        return;
      } finally {
        detecting = false;
      }

      // Lần chạy trước có thể vẫn đang await khi effect bị dọn dẹp
      if (stopped || !detection) return;

      const emotion = Object.keys(detection.expressions).reduce((a, b) =>
        detection.expressions[a] > detection.expressions[b] ? a : b
      );

      // Dừng vòng lặp ngay để không nhận diện thêm lần nào nữa
      stopped = true;
      clearInterval(interval);

      setCurrentEmotion(emotion);
      setEmotionLocked(true);
      settledRef.current = true;
      onEmotionDetected?.(emotion);
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [modelsLoaded, emotionLocked, onEmotionDetected]);

  const statusText = !modelsLoaded
    ? "Đang tải model nhận diện..."
    : !emotionLocked
      ? "Larry đang quan sát cảm xúc của bạn..."
      : "Larry đã ghi nhận cảm xúc của bạn rồi! 💚";

  return (
    <div className="camera-panel">
      <h2 className="camera-title">📷 Larry đang nhìn bạn</h2>

      <div className="tv-frame">
        <div className="tv-screen">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            // Học sinh bấm "Chặn", máy không có webcam, hoặc trang không chạy trên
            // HTTPS: getUserMedia hỏng ở đây và sẽ KHÔNG bao giờ có khung hình nào.
            onUserMediaError={(err) => {
              const name = typeof err === "string" ? err : err?.name || "";
              console.warn("Không mở được camera:", name || err);
              giveUp(
                name === "NotAllowedError" || name === "PermissionDeniedError"
                  ? "denied"
                  : "unavailable"
              );
            }}
          />
        </div>
      </div>

      <EmotionBadge emotion={currentEmotion} />

      <p className="camera-status">{statusText}</p>

      {canSkip && !emotionLocked && (
        <button type="button" className="camera-skip" onClick={() => giveUp("skipped")}>
          Bỏ qua camera, mình muốn chat luôn
        </button>
      )}
    </div>
  );
}
