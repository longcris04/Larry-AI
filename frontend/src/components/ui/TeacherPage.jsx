import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import "../../styles/TeacherPage.css";

// Trang của giáo viên chủ nhiệm — CHỈ ĐỌC.
//
// Cố ý không có nút sửa, nút xoá, nút gửi email nào. Việc chỉnh sửa tài khoản và
// việc quyết định gửi cảnh báo ra ngoài thuộc về quản trị viên; ở đây thầy cô
// nắm tình hình lớp và biết cảnh báo đã đi hay chưa.
//
// Thứ hiện ra là BẢN TÓM TẮT do model viết. Nguyên văn lời học sinh không được
// lưu ở đâu cả, nên không có đường nào đọc lại hội thoại gốc — đó là điều nên
// nói rõ với thầy cô, và cũng là điều nên nói rõ với các em.

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

function riskLevelOf(session) {
  const flagged = session.flagged ?? session.bullyingDetected === true;
  if (!flagged) return "none";
  return session.riskLevel && session.riskLevel !== "none" ? session.riskLevel : "low";
}

function SessionCard({ session }) {
  const level = riskLevelOf(session);
  const alerts = session.alerts || [];
  const lastAlert = alerts[alerts.length - 1];

  return (
    <article
      className={`teacher-session${
        level === "none" ? "" : ` teacher-session--flagged teacher-session--${level}`
      }`}
    >
      <div className="teacher-session__head">
        <span className="teacher-session__time">
          {formatTime(session.startedAt)} → {formatTime(session.endedAt)}
        </span>
        <span className="teacher-session__count">{session.messageCount} tin nhắn</span>
      </div>

      <div className="teacher-session__status">
        {level === "none" ? (
          <span className="teacher-badge">Không có dấu hiệu tiêu cực</span>
        ) : (
          <span className={`teacher-badge teacher-badge--${level}`}>
            🚩 {riskLevelLabel(level)}
          </span>
        )}

        {session.categories?.length > 0 &&
          session.categories.map((code) => (
            <span key={code} className="teacher-risk-tag">
              {riskCategoryLabel(code)}
            </span>
          ))}
      </div>

      {session.checkinNote && (
        <p className="teacher-session__checkin">📝 Phiếu cảm xúc: {session.checkinNote}</p>
      )}

      <p className="teacher-session__summary">
        {session.summary || (
          <em className="teacher-muted">
            {session.summaryError
              ? `Chưa tóm tắt được: ${session.summaryError}`
              : "Chưa có tóm tắt cho phiên này."}
          </em>
        )}
      </p>

      {session.concerns?.length > 0 && (
        <ul className="teacher-session__concerns">
          {session.concerns.map((concern, i) => (
            <li key={i}>⚠️ {concern}</li>
          ))}
        </ul>
      )}

      {/* Tình trạng email cảnh báo — thứ thầy cô cần biết nhất sau bản tóm tắt:
          chuyện này đã được báo lên chưa, hay mình là người đầu tiên biết. */}
      <div className="teacher-session__alert">
        {lastAlert ? (
          <span className="teacher-alert teacher-alert--sent">
            ✅ Đã gửi email cảnh báo lúc {formatTime(lastAlert.sentAt)}
            {alerts.length > 1 && ` (${alerts.length} lần)`}
            {lastAlert.to && <span className="teacher-muted"> · tới {lastAlert.to}</span>}
          </span>
        ) : level === "none" ? (
          <span className="teacher-alert teacher-muted">Không cần cảnh báo</span>
        ) : (
          <span className="teacher-alert teacher-alert--none">
            ⏳ Chưa gửi email cảnh báo cho phiên này
          </span>
        )}
      </div>
    </article>
  );
}

export default function TeacherPage() {
  const { user, logout } = useAuth();

  const [info, setInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openStudent, setOpenStudent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/teacher/students`);
      setInfo(res.data.teacher);
      setStudents(res.data.students);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được danh sách học sinh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const openSessions = async (student) => {
    // Bấm lại vào em đang mở thì đóng lại
    if (openStudent?.id === student.id) {
      setOpenStudent(null);
      setSessions([]);
      return;
    }

    setOpenStudent(student);
    setSessions([]);
    setSessionsLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/teacher/students/${student.id}/sessions`
      );
      setSessions(res.data.sessions);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được hội thoại của học sinh này.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const totalFlagged = students.reduce((sum, s) => sum + s.flaggedCount, 0);
  const totalHighRisk = students.reduce((sum, s) => sum + s.highRiskCount, 0);

  return (
    <div className="teacher-page">
      <header className="teacher-topbar">
        <div>
          <h1 className="teacher-topbar__title">🍎 Lớp chủ nhiệm</h1>
          <p className="teacher-topbar__subtitle">
            {user?.username}
            {info?.classLabel && (
              <>
                {" · "}
                <strong>{info.classLabel}</strong>
              </>
            )}
          </p>
        </div>
        <div className="teacher-topbar__actions">
          <button type="button" className="teacher-btn" onClick={loadStudents}>
            Tải lại
          </button>
          <button type="button" className="teacher-btn teacher-btn--ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="teacher-error">{error}</div>}

      <section className="teacher-panel">
        <div className="teacher-stats">
          <div className="teacher-stat">
            <span className="teacher-stat__num">{students.length}</span>
            <span className="teacher-stat__label">học sinh trong lớp</span>
          </div>
          <div className={`teacher-stat${totalFlagged ? " teacher-stat--warn" : ""}`}>
            <span className="teacher-stat__num">{totalFlagged}</span>
            <span className="teacher-stat__label">phiên có dấu hiệu</span>
          </div>
          <div className={`teacher-stat${totalHighRisk ? " teacher-stat--danger" : ""}`}>
            <span className="teacher-stat__num">{totalHighRisk}</span>
            <span className="teacher-stat__label">phiên khẩn cấp</span>
          </div>
        </div>

        <p className="teacher-note">
          Bạn đang xem <strong>bản tóm tắt</strong> do hệ thống ghi nhận, không phải nguyên
          văn lời các em — Larry không lưu lại nội dung hội thoại. Trang này chỉ để đọc; việc
          sửa tài khoản và gửi email cảnh báo do quản trị viên thực hiện.
        </p>

        {loading ? (
          <p className="teacher-empty">Đang tải...</p>
        ) : students.length === 0 ? (
          <p className="teacher-empty">
            Chưa có học sinh nào khai đúng lớp <strong>{info?.classLabel || "này"}</strong>.
            <br />
            Larry ghép thầy cô với các em dựa trên trường và lớp các em tự khai lúc đăng ký —
            hãy nhắc các em ghi lớp giống hệt cách bạn đã khai.
          </p>
        ) : (
          <ul className="teacher-students">
            {students.map((student) => {
              const isOpen = openStudent?.id === student.id;

              return (
                <li key={student.id} className="teacher-student">
                  <button
                    type="button"
                    className={`teacher-student__row${isOpen ? " teacher-student__row--open" : ""}`}
                    onClick={() => openSessions(student)}
                    aria-expanded={isOpen}
                  >
                    <span className="teacher-student__name">
                      <strong>{student.profile?.fullName || student.username}</strong>
                      {student.profile?.fullName && (
                        <span className="teacher-muted"> · {student.username}</span>
                      )}
                    </span>

                    <span className="teacher-student__meta">
                      <span className="teacher-muted">{student.sessionCount} phiên</span>

                      {student.flaggedCount > 0 && (
                        <span
                          className={`teacher-flag${
                            student.highRiskCount > 0 ? " teacher-flag--high" : ""
                          }`}
                        >
                          🚩 {student.flaggedCount}
                          {student.highRiskCount > 0 && " ❗"}
                        </span>
                      )}

                      {student.alertCount > 0 && (
                        <span className="teacher-flag teacher-flag--mail">
                          ✉️ {student.alertCount}
                        </span>
                      )}

                      <span className="teacher-student__caret" aria-hidden="true">
                        {isOpen ? "▴" : "▾"}
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="teacher-student__sessions">
                      {sessionsLoading ? (
                        <p className="teacher-empty">Đang tải hội thoại...</p>
                      ) : sessions.length === 0 ? (
                        <p className="teacher-empty">
                          Em này chưa có phiên trò chuyện nào được ghi nhận.
                        </p>
                      ) : (
                        sessions.map((session) => (
                          <SessionCard key={session.id} session={session} />
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
