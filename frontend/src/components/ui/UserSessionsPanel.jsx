// Danh sách phiên hội thoại của MỘT học sinh.
//
// Trước đây phần này nằm trong một khối riêng ở CUỐI trang quản trị: bấm "Hội
// thoại" ở một dòng nào đó rồi phải tự cuộn xuống hết bảng mới thấy kết quả — và
// cuộn xuống tới nơi thì không còn nhìn thấy mình vừa bấm vào ai. Giờ nó được mở
// ra ngay DƯỚI dòng của em đó, nên tên và nội dung luôn nằm cạnh nhau.
//
// Tách thành file riêng vì đây là ~100 dòng JSX chỉ để hiển thị; để lẫn trong
// AdminPage thì phần bảng và phần phân trang bị đẩy ra xa nhau tới mức khó đọc.

import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import { formatTime } from "../../utils/days";

// Phiên được đánh dấu khi có BẤT KỲ dấu hiệu tiêu cực nào về học sinh, không chỉ
// bắt nạt. Bản ghi cũ chỉ có bullyingDetected nên vẫn phải đọc tới nó.
function isFlagged(session) {
  return session.flagged ?? session.bullyingDetected === true;
}

export function riskLevelOf(session) {
  if (!isFlagged(session)) return "none";
  return session.riskLevel && session.riskLevel !== "none" ? session.riskLevel : "low";
}

export default function UserSessionsPanel({ sessions, loading, onAlert }) {
  if (loading) return <p className="admin-empty">Đang tải...</p>;

  if (sessions.length === 0) {
    return <p className="admin-empty">Tài khoản này chưa có phiên hội thoại nào được ghi nhận.</p>;
  }

  return (
    <div className="admin-sessions">
      {sessions.map((session) => {
        const level = riskLevelOf(session);

        return (
          <article
            key={session.id}
            className={`admin-session${
              level === "none" ? "" : ` admin-session--flagged admin-session--${level}`
            }`}
          >
            <div className="admin-session__head">
              <span className="admin-session__time">
                {formatTime(session.startedAt)} → {formatTime(session.endedAt)}
              </span>
              <span className="admin-session__count">{session.messageCount} tin nhắn</span>
            </div>

            <div className="admin-session__status">
              {level === "none" ? (
                <span className="admin-badge">Học sinh ổn — không có dấu hiệu tiêu cực</span>
              ) : (
                <span className={`admin-badge admin-badge--${level}`}>
                  🚩 {riskLevelLabel(level)}
                </span>
              )}

              {session.categories?.length > 0 && (
                <span className="admin-session__tags">
                  {session.categories.map((code) => (
                    <span key={code} className="admin-risk-tag">
                      {riskCategoryLabel(code)}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {/* Hội thoại có thể rất ngắn, khi đó phiếu là nguồn thông tin chính */}
            {session.checkinNote && (
              <p className="admin-session__checkin">📝 Phiếu cảm xúc: {session.checkinNote}</p>
            )}

            <p className="admin-session__summary">
              {session.summary || (
                <em className="admin-muted">
                  {session.summaryError
                    ? `Chưa tóm tắt được: ${session.summaryError}`
                    : "Chưa có tóm tắt cho phiên này."}
                </em>
              )}
            </p>

            {session.concerns?.length > 0 && (
              <ul className="admin-session__concerns">
                {session.concerns.map((concern, i) => (
                  <li key={i}>⚠️ {concern}</li>
                ))}
              </ul>
            )}

            <div className="admin-session__foot">
              {/* Chỉ phiên có dấu hiệu mới cần cảnh báo giáo viên chủ nhiệm */}
              {level !== "none" && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  onClick={() => onAlert(session)}
                >
                  ✉️ Cảnh báo GVCN
                </button>
              )}

              {session.alerts?.length > 0 && (
                <span className="admin-session__sent">
                  ✅ Đã gửi tới {session.alerts[session.alerts.length - 1].to} lúc{" "}
                  {formatTime(session.alerts[session.alerts.length - 1].sentAt)}
                  {session.alerts.length > 1 && ` (${session.alerts.length} lần)`}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
