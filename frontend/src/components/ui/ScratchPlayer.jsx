import React, { useEffect, useState } from "react";
import "../../styles/ScratchPlayer.css";

// Nhúng THẲNG project Scratch vào trang, không qua bước bấm "Bắt đầu chơi" nữa.
//
// scratch.mit.edu không đặt X-Frame-Options hay CSP frame-ancestors cho đường
// /embed, nên iframe chạy được cả ở local lẫn trên bản deploy. Điều kiện duy nhất
// là project phải ở trạng thái ĐÃ CHIA SẺ (shared) trên Scratch — project để
// riêng tư thì khung sẽ báo không xem được, và đó là thứ phải sửa bên Scratch chứ
// không sửa được ở đây.
export default function ScratchPlayer({ projectId, title }) {
  const [loaded, setLoaded] = useState(false);

  // Đổi tình huống thì hiện lại khung chờ cho tới khi project mới tải xong
  useEffect(() => {
    setLoaded(false);
  }, [projectId]);

  return (
    <div className="scratch-player">
      <div className="scratch-player__frame">
        {!loaded && <div className="scratch-player__skeleton" />}
        <iframe
          className={`scratch-player__iframe ${loaded ? "scratch-player__iframe--visible" : ""}`}
          src={`https://scratch.mit.edu/projects/${projectId}/embed`}
          title={title || `Tình huống mô phỏng ${projectId}`}
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className="scratch-player__footer">
        <div className="scratch-player__footer-avatar">
          <span role="img" aria-label="Larry">
            🤖
          </span>
        </div>
        <p>Larry luôn ở đây để đồng hành cùng bạn.</p>
      </div>
    </div>
  );
}
