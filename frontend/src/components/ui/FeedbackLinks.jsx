import { useEffect, useState } from "react";
import { FEEDBACK_LINKS_URL } from "../../config/api";
import "../../styles/FeedbackLinks.css";

// Khối xin ý kiến, nằm ở cột trái của màn hình chat.
//
// Hai đường link đọc từ backend (STUDENT_FEEDBACK_FORM / TEACHER_FEEDBACK_FORM
// trong backend/.env) chứ không ghi trong mã nguồn — đổi biểu mẫu là sửa biến
// môi trường rồi khởi động lại, không phải build lại giao diện.
//
// Mở ở TAB MỚI: khung chat có thể đang giữa cuộc trò chuyện, và điều hướng đi
// chỗ khác sẽ chốt phiên rồi mất luôn mạch nói chuyện của em.
// rel="noopener noreferrer" là bắt buộc khi dùng target="_blank" — thiếu nó thì
// trang được mở có thể điều khiển ngược lại tab của mình qua window.opener.

export default function FeedbackLinks() {
  const [links, setLinks] = useState({ student: "", teacher: "" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(FEEDBACK_LINKS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLinks(data);
      } catch {
        // Chưa khai link trong .env, hoặc backend chưa chạy: khối này lặng lẽ
        // không hiện ra. Nó là thứ thêm vào, không đáng để bày một dòng lỗi đỏ
        // giữa màn hình của học sinh.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!links.student && !links.teacher) return null;

  return (
    <section className="feedback-links" aria-labelledby="feedback-links-title">
      <h3 className="feedback-links__title" id="feedback-links-title">
        💌 Góp ý cho Larry
      </h3>

      <p className="feedback-links__desc">
        Larry đang tập lớn mỗi ngày. Bạn kể cho nhóm làm ra Larry nghe cảm nhận của mình nhé!
      </p>

      <div className="feedback-links__list">
        {links.student && (
          <a
            className="feedback-link feedback-link--student"
            href={links.student}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="feedback-link__icon" aria-hidden="true">
              🎒
            </span>
            <span className="feedback-link__text">
              <strong>Dành cho học sinh</strong>
              <span className="feedback-link__url">{links.student}</span>
            </span>
            <span className="feedback-link__go" aria-hidden="true">
              ↗
            </span>
          </a>
        )}

        {links.teacher && (
          <a
            className="feedback-link feedback-link--teacher"
            href={links.teacher}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="feedback-link__icon" aria-hidden="true">
              🍎
            </span>
            <span className="feedback-link__text">
              <strong>Dành cho thầy cô</strong>
              <span className="feedback-link__url">{links.teacher}</span>
            </span>
            <span className="feedback-link__go" aria-hidden="true">
              ↗
            </span>
          </a>
        )}
      </div>

      <p className="feedback-links__note">Biểu mẫu mở ở tab mới, cuộc trò chuyện vẫn giữ nguyên.</p>
    </section>
  );
}
