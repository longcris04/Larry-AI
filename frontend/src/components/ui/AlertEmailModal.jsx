import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import "../../styles/AlertEmailModal.css";

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

/**
 * Cảnh báo giáo viên chủ nhiệm về một phiên hội thoại đáng lo.
 * AI soạn nháp, quản trị viên ĐỌC LẠI và sửa được, rồi mới bấm gửi —
 * email không bao giờ tự động đi ra ngoài.
 */
export default function AlertEmailModal({ session, studentName, onClose, onSent }) {
  const [drafting, setDrafting] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentAlert, setSentAlert] = useState(null);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("");
  const [mailerReady, setMailerReady] = useState(true);
  // Giáo viên chủ nhiệm của chính em này, backend ghép theo trường + lớp.
  // null = chưa ghép được, email sẽ chỉ đi tới địa chỉ ở ô "Gửi tới".
  const [homeroomTeacher, setHomeroomTeacher] = useState(null);

  const previousAlerts = session.alerts || [];

  const draft = useCallback(async () => {
    setDrafting(true);
    setError("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/sessions/${session.id}/alert/draft`
      );
      setTo(res.data.to || "");
      setSubject(res.data.subject || "");
      setBody(res.data.body || "");
      setFrom(res.data.from || "");
      setMailerReady(res.data.mailerReady !== false);
      setHomeroomTeacher(res.data.homeroomTeacher || null);
    } catch (err) {
      setError(err.response?.data?.error || "Không soạn được email.");
    } finally {
      setDrafting(false);
    }
  }, [session.id]);

  useEffect(() => {
    draft();
  }, [draft]);

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/sessions/${session.id}/alert/send`,
        { to, subject, body }
      );
      setSentAlert(res.data.alert);
      onSent?.(res.data.alert);
    } catch (err) {
      setError(err.response?.data?.error || "Không gửi được email.");
    } finally {
      setSending(false);
    }
  };

  const level = session.riskLevel && session.riskLevel !== "none" ? session.riskLevel : "low";

  return (
    <div className="alert-modal__backdrop" role="dialog" aria-modal="true">
      <div className="alert-modal">
        <header className="alert-modal__head">
          <div>
            <h3 className="alert-modal__title">✉️ Cảnh báo giáo viên chủ nhiệm</h3>
            <p className="alert-modal__sub">
              {studentName} · {formatTime(session.startedAt)} ·{" "}
              <span className={`alert-modal__level alert-modal__level--${level}`}>
                {riskLevelLabel(level)}
              </span>
              {session.categories?.length > 0 &&
                ` · ${session.categories.map(riskCategoryLabel).join(", ")}`}
            </p>
          </div>
          <button type="button" className="alert-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>

        {sentAlert ? (
          <div className="alert-modal__body">
            <div className="alert-modal__ok">
              ✅ Đã gửi email tới <strong>{sentAlert.to}</strong> lúc{" "}
              {formatTime(sentAlert.sentAt)}.
            </div>
            <div className="alert-modal__actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="alert-modal__body">
            {previousAlerts.length > 0 && (
              <div className="alert-modal__warn">
                ⚠️ Phiên này đã được gửi cảnh báo {previousAlerts.length} lần, lần gần nhất tới{" "}
                {previousAlerts[previousAlerts.length - 1].to} lúc{" "}
                {formatTime(previousAlerts[previousAlerts.length - 1].sentAt)}.
              </div>
            )}

            {!mailerReady && (
              <div className="alert-modal__warn">
                ⚠️ Backend chưa cấu hình tài khoản gửi email (EMAIL_USER /
                EMAIL_APP_PASSWORD trong <code>backend/.env</code>). Soạn được nhưng chưa gửi
                được.
              </div>
            )}

            {error && <div className="alert-modal__err">{error}</div>}

            {drafting ? (
              <p className="alert-modal__loading">Larry đang soạn email từ bản tóm tắt...</p>
            ) : (
              <>
                <label className="alert-modal__field">
                  Gửi tới
                  <input value={to} onChange={(e) => setTo(e.target.value)} />
                </label>

                {/* Người nhận thứ hai do MÁY CHỦ quyết định, không sửa được ở đây:
                    đây là dữ liệu nhạy cảm về một học sinh cụ thể, nên địa chỉ
                    giáo viên phải lấy từ tài khoản đã được duyệt chứ không phải
                    từ một ô nhập. Hiện ra để quản trị viên biết trước ai sẽ đọc. */}
                {homeroomTeacher && homeroomTeacher.email ? (
                  <p className="alert-modal__cc">
                    ➕ Gửi kèm giáo viên chủ nhiệm: <strong>{homeroomTeacher.username}</strong>{" "}
                    &lt;{homeroomTeacher.email}&gt;
                    {homeroomTeacher.classLabel && (
                      <span className="alert-modal__cc-class"> · {homeroomTeacher.classLabel}</span>
                    )}
                  </p>
                ) : homeroomTeacher ? (
                  /* Ghép được người, nhưng thầy cô đăng ký mà không khai email —
                     email không bắt buộc từ lúc tài khoản định danh bằng số điện
                     thoại. Phải nói thẳng là bản sao KHÔNG tới được, kèm số để
                     quản trị viên gọi trực tiếp; im lặng ở đây thì mọi người
                     tưởng thầy cô đã biết chuyện. */
                  <p className="alert-modal__cc alert-modal__cc--none">
                    ⚠️ Giáo viên chủ nhiệm <strong>{homeroomTeacher.username}</strong>
                    {homeroomTeacher.classLabel && ` (${homeroomTeacher.classLabel})`} chưa
                    khai email nên sẽ không nhận được bản sao.
                    {homeroomTeacher.phone
                      ? ` Hãy báo trực tiếp qua số ${homeroomTeacher.phone}.`
                      : ""}
                  </p>
                ) : (
                  <p className="alert-modal__cc alert-modal__cc--none">
                    ℹ️ Chưa ghép được giáo viên chủ nhiệm cho em này — email chỉ gửi tới địa chỉ
                    ở trên. Lớp của em có thể chưa có tài khoản giáo viên được duyệt, hoặc em
                    chưa khai lớp.
                  </p>
                )}

                <label className="alert-modal__field">
                  Tiêu đề
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </label>

                <label className="alert-modal__field">
                  Nội dung
                  <textarea rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
                </label>

                <p className="alert-modal__note">
                  Email do AI soạn từ bản tóm tắt — hãy đọc lại và sửa nếu cần trước khi gửi.
                  {from && (
                    <>
                      {" "}
                      Gửi từ <strong>{from}</strong>.
                    </>
                  )}
                </p>
              </>
            )}

            <div className="alert-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={drafting || sending || !mailerReady}
                onClick={handleSend}
              >
                {sending ? "Đang gửi..." : "Gửi email"}
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={drafting || sending}
                onClick={draft}
              >
                Soạn lại
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={sending}
                onClick={onClose}
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
