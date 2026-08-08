import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import AlertEmailModal from "./AlertEmailModal";
import "../../styles/AdminPage.css";

const EMPTY_FORM = {
  username: "",
  email: "",
  password: "",
  fullName: "",
  grade: "",
  school: "",
  className: "",
};

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

// Phiên được đánh dấu khi có BẤT KỲ dấu hiệu tiêu cực nào về học sinh, không chỉ
// bắt nạt. Bản ghi cũ chỉ có bullyingDetected nên vẫn phải đọc tới nó.
function isFlagged(session) {
  return session.flagged ?? session.bullyingDetected === true;
}

function riskLevelOf(session) {
  if (!isFlagged(session)) return "none";
  return session.riskLevel && session.riskLevel !== "none" ? session.riskLevel : "low";
}

export default function AdminPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Phiên đang được soạn email cảnh báo cho giáo viên chủ nhiệm
  const [alertSession, setAlertSession] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`);
      setUsers(res.data.users);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openSessions = async (target) => {
    setSelectedUser(target);
    setSessions([]);
    setSessionsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/${target.id}/sessions`);
      setSessions(res.data.sessions);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được lịch sử hội thoại.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const startEdit = (target) => {
    setEditingId(target.id);
    setForm({
      username: target.username || "",
      email: target.email || "",
      password: "",
      fullName: target.profile?.fullName || "",
      grade: target.profile?.grade || "",
      school: target.profile?.school || "",
      className: target.profile?.className || "",
    });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    setError("");
    try {
      const body = {
        username: form.username,
        email: form.email,
        profile: {
          fullName: form.fullName,
          grade: form.grade,
          school: form.school,
          className: form.className,
        },
      };
      if (form.password.trim()) body.password = form.password.trim();

      await axios.patch(`${API_BASE_URL}/api/admin/users/${id}`, body);
      setEditingId(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không lưu được thay đổi.");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (target) => {
    const ok = window.confirm(
      `Xoá tài khoản "${target.username}"?\nToàn bộ lịch sử hội thoại của tài khoản này cũng bị xoá và không khôi phục được.`
    );
    if (!ok) return;

    setError("");
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${target.id}`);
      if (selectedUser?.id === target.id) {
        setSelectedUser(null);
        setSessions([]);
      }
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không xoá được tài khoản.");
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <h1 className="admin-topbar__title">👑 Khu vực quản trị viên</h1>
          <p className="admin-topbar__subtitle">
            Đang đăng nhập: <strong>{user?.username}</strong>
          </p>
        </div>
        <div className="admin-topbar__actions">
          <button type="button" className="admin-btn" onClick={loadUsers}>
            Tải lại
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Tài khoản người dùng</h2>

        <p className="admin-note">
          Vai trò không sửa được từ đây. Tài khoản quản trị chỉ được tạo bằng lệnh{" "}
          <code>npm run create-admin</code> chạy trên máy chủ.
        </p>

        {loading ? (
          <p className="admin-empty">Đang tải...</p>
        ) : users.length === 0 ? (
          <p className="admin-empty">Chưa có tài khoản nào.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trường</th>
                  <th>Lớp</th>
                  <th>Khối</th>
                  <th>Phiên</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id} className="admin-row--editing">
                      <td colSpan={8}>
                        <div className="admin-edit">
                          <div className="admin-edit__grid">
                            <label>
                              Tên tài khoản
                              <input
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                              />
                            </label>
                            <label>
                              Email
                              <input
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                              />
                            </label>
                            <label>
                              Mật khẩu mới
                              <input
                                type="password"
                                placeholder="Để trống nếu không đổi"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                              />
                            </label>
                            <label>
                              Tên
                              <input
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                              />
                            </label>
                            {/* Cùng thứ tự với cột trong bảng: Trường → Lớp → Khối */}
                            <label>
                              Trường
                              <input
                                value={form.school}
                                onChange={(e) => setForm({ ...form, school: e.target.value })}
                              />
                            </label>
                            <label>
                              Lớp
                              <input
                                value={form.className}
                                onChange={(e) => setForm({ ...form, className: e.target.value })}
                              />
                            </label>
                            <label>
                              Khối
                              <input
                                value={form.grade}
                                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                              />
                            </label>
                          </div>

                          <div className="admin-edit__actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn--primary"
                              disabled={saving}
                              onClick={() => saveEdit(row.id)}
                            >
                              {saving ? "Đang lưu..." : "Lưu"}
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => setEditingId(null)}
                            >
                              Huỷ
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.username}</strong>
                        {row.id === user?.id && (
                          <span className="admin-self"> (bạn)</span>
                        )}
                        {row.profile?.fullName && (
                          <div className="admin-muted">{row.profile.fullName}</div>
                        )}
                      </td>
                      <td className="admin-muted">{row.email}</td>
                      <td>
                        <span className={`admin-tag admin-tag--${row.role}`}>
                          {row.role === "admin" ? "Quản trị viên" : "Người dùng"}
                        </span>
                      </td>
                      <td className="admin-muted">{row.profile?.school || "—"}</td>
                      <td className="admin-muted">{row.profile?.className || "—"}</td>
                      <td className="admin-muted">{row.profile?.grade || "—"}</td>
                      <td>
                        {row.sessionCount}
                        {row.flaggedCount > 0 && (
                          <span
                            className={`admin-flag${
                              row.highRiskCount > 0 ? " admin-flag--high" : ""
                            }`}
                            title={
                              row.highRiskCount > 0
                                ? `${row.flaggedCount} phiên có dấu hiệu tiêu cực, trong đó ${row.highRiskCount} phiên khẩn cấp`
                                : `${row.flaggedCount} phiên có dấu hiệu tiêu cực cần xem lại`
                            }
                          >
                            🚩 {row.flaggedCount}
                            {row.highRiskCount > 0 && " ❗"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="admin-actions">
                          {/* Quản trị viên không trò chuyện nên không có hội thoại */}
                          {row.role !== "admin" && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={() => openSessions(row)}
                            >
                              Hội thoại
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--ghost"
                            onClick={() => startEdit(row)}
                          >
                            Sửa
                          </button>
                          {/* Không cho tự xoá tài khoản đang đăng nhập */}
                          {row.id !== user?.id && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger"
                              onClick={() => removeUser(row)}
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedUser && (
        <section className="admin-panel">
          <h2 className="admin-panel__title">
            Hội thoại của <strong>{selectedUser.username}</strong>
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--ghost"
              onClick={() => setSelectedUser(null)}
            >
              Đóng
            </button>
          </h2>

          {sessionsLoading ? (
            <p className="admin-empty">Đang tải...</p>
          ) : sessions.length === 0 ? (
            <p className="admin-empty">
              Tài khoản này chưa có phiên hội thoại nào được ghi nhận.
            </p>
          ) : (
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
                      <span className="admin-session__count">
                        {session.messageCount} tin nhắn
                      </span>
                    </div>

                    <div className="admin-session__status">
                      {level === "none" ? (
                        <span className="admin-badge">
                          Học sinh ổn — không có dấu hiệu tiêu cực
                        </span>
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
                      <p className="admin-session__checkin">
                        📝 Phiếu cảm xúc: {session.checkinNote}
                      </p>
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
                          onClick={() => setAlertSession(session)}
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
          )}
        </section>
      )}

      {alertSession && (
        <AlertEmailModal
          session={alertSession}
          studentName={
            selectedUser?.profile?.fullName || selectedUser?.username || "Học sinh"
          }
          onClose={() => setAlertSession(null)}
          onSent={(alert) => {
            // Ghi lại ngay vào danh sách đang hiển thị, không cần tải lại cả trang
            setSessions((prev) =>
              prev.map((s) =>
                s.id === alertSession.id ? { ...s, alerts: [...(s.alerts || []), alert] } : s
              )
            );
          }}
        />
      )}
    </div>
  );
}
