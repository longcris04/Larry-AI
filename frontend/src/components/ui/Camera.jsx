import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import EmotionBadge from "./EmotionBadge";

export default function Camera({ onEmotionDetected }) {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  // Nhận diện xong lần đầu là khoá lại, giữ nguyên cảm xúc đó suốt phiên chat
  const [emotionLocked, setEmotionLocked] = useState(false);

  useEffect(() => {
    async function loadModels() {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      setModelsLoaded(true);
    }
    loadModels();
  }, []);

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
          />
        </div>
      </div>

      <EmotionBadge emotion={currentEmotion} />

      <p className="camera-status">{statusText}</p>
    </div>
  );
}
