import React from "react";

export default function CameraWelcome({ onAllow, onDecline }) {
  return (
    <section className="camera-welcome" aria-labelledby="camera-welcome-title">
      <div className="larry-character larry-character--welcome" aria-hidden="true">
        <span className="larry-character__glow" />
        <img src={`${process.env.PUBLIC_URL}/logo_mark.png`} alt="" />
      </div>

      <div className="camera-welcome__bubble">
        <span className="camera-welcome__name">LARRY</span>
        <h1 id="camera-welcome-title">Chào bạn! Mình là Larry 👋</h1>
        <p>Mình vui lắm vì bạn đã đến. Trước khi bắt đầu, mình hỏi bạn một điều nhé?</p>
        <p>
          Bạn có muốn cho mình dùng camera để nhận biết cảm xúc của bạn không?
          Ảnh và video <strong>không được lưu hoặc gửi đi</strong>; chỉ kết quả cảm xúc
          được dùng để Larry trò chuyện phù hợp hơn.
        </p>
        <p className="camera-welcome__reassure">
          Bạn có thể từ chối — mình vẫn ở đây và trò chuyện với bạn như bình thường 💛
        </p>

        <div className="camera-welcome__actions">
          <button type="button" className="camera-welcome__allow" onClick={onAllow}>
            👀 Đồng ý mở camera
          </button>
          <button type="button" className="camera-welcome__decline" onClick={onDecline}>
            💬 Không cần camera
          </button>
        </div>
      </div>
    </section>
  );
}
