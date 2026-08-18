import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_GUEST_MODE_URL, API_BASE_URL, SETTINGS_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import { ROLES, STATUS, roleLabel, statusLabel } from "../../constants/roles";
import AdminDashboard from "./AdminDashboard";
import AlertEmailModal from "./AlertEmailModal";
import "../../styles/AdminPage.css";

const EMPTY_FORM = {
  username: "",
  phone: "",
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

  // Chế độ khách. `null` = chưa đọc xong, để nút không nhấp nháy từ Bật sang Tắt
  // ngay trước mắt quản trị viên rồi khiến họ tưởng mình vừa bấm nhầm.
  const [guestMode, setGuestMode] = useState(null);
  const [guestModeSaving, setGuestModeSaving] = useState(false);

  // Nút "Tải lại" ở đầu trang phải làm mới CẢ bảng điều khiển. Bảng đó tự quản
  // khoảng ngày của nó nên trang này không gọi API hộ được — tăng số đếm là cách
  // bảo nó tải lại mà không phải kéo state khoảng ngày lên đây.
  const [refreshKey, setRefreshKey] = useState(0);

  const loadGuestMode = useCallback(async () => {
    try {
      const res = await axios.get(SETTINGS_URL);
      setGuestMode(Boolean(res.data?.guestMode));
    } catch (err) {
      setError("Không đọc được cài đặt chế độ khách.");
    }
  }, []);

  const toggleGuestMode = async () => {
    const next = !guestMode;

    // Hỏi lại khi TẮT, không hỏi khi bật. Tắt là gỡ mất đường vào của những em
    // chưa có tài khoản — đúng loại hậu quả không nhìn thấy ngay từ trang quản trị.
    if (!next) {
      const ok = window.confirm(
        "Tắt chế độ khách?\n\n" +
          "Nút “Trò chuyện với Larry ngay” sẽ biến mất khỏi trang đăng nhập, và học sinh " +
          "chưa có tài khoản sẽ không vào nói chuyện được nữa — các em phải đăng ký trước.\n\n" +
          "Bạn có thể bật lại bất cứ lúc nào."
      );
      if (!ok) return;
    }

    setGuestModeSaving(true);
    setError("");
    try {
      const res = await axios.patch(ADMIN_GUEST_MODE_URL, { enabled: next });
      setGuestMode(Boolean(res.data?.guestMode));
    } catch (err) {
      setError(err.response?.data?.error || "Không đổi được cài đặt chế độ khách.");
    } finally {
      setGuestModeSaving(false);
    }
  };

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
    loadGuestMode();
  }, [loadUsers, loadGuestMode]);

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
      phone: target.phone || "",
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
        phone: form.phone,
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

  // Duyệt / từ chối một tài khoản giáo viên chủ nhiệm.
  //
  // Tài khoản này đọc được tóm tắt hội thoại của cả một lớp, nên bước duyệt là
  // thật chứ không phải thủ tục — từ chối cũng là một kết quả hợp lệ.
  const setApproval = async (target, status) => {
    if (status === STATUS.REJECTED) {
      const ok = window.confirm(
        `Từ chối tài khoản giáo viên "${target.username}"?\n` +
          "Tài khoản sẽ không đăng nhập được cho tới khi bạn duyệt lại."
      );
      if (!ok) return;
    }

    setError("");
    try {
      await axios.post(`${API_BASE_URL}/api/admin/users/${target.id}/approval`, { status });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không cập nhật được trạng thái duyệt.");
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

  const pendingTeachers = users.filter(
    (u) => u.role === ROLES.TEACHER && u.status === STATUS.PENDING
  );

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
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              loadUsers();
              // Tải lại cả công tắc: có thể quản trị viên khác vừa đổi ở máy họ
              loadGuestMode();
              setRefreshKey((n) => n + 1);
            }}
          >
            Tải lại
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {/* Việc CẦN LÀM lên đầu trang. Giáo viên đã đăng ký mà chưa được duyệt thì
          không đăng nhập được — để lẫn trong bảng dài phía dưới là rất dễ quên,
          và thầy cô ngồi chờ mà không biết chờ ai. */}
      {pendingTeachers.length > 0 && (
        <section className="admin-panel admin-panel--pending">
          <h2 className="admin-panel__title">
            ⏳ Chờ duyệt: {pendingTeachers.length} tài khoản giáo viên chủ nhiệm
          </h2>

          <p className="admin-note">
            Tài khoản giáo viên chủ nhiệm đọc được tóm tắt hội thoại của cả lớp. Hãy xác nhận
            đúng người, đúng lớp trước khi duyệt. Học sinh đăng ký thì không cần bước này.
          </p>

          <ul className="admin-pending">
            {pendingTeachers.map((row) => (
              <li key={row.id} className="admin-pending__item">
                <div className="admin-pending__info">
                  <strong>{row.profile?.fullName || row.username}</strong>
                  {/* Số điện thoại trước — email có thể trống, và số mới là thứ
                      gọi được để xác minh đúng người trước khi duyệt */}
                  <span className="admin-muted"> · {row.phone || row.email || "chưa có liên hệ"}</span>
                  <div className="admin-muted">
                    Chủ nhiệm: {row.teacherInfo?.classLabel || "chưa khai lớp"}
                    {row.profile?.dateOfBirth && ` · sinh ${row.profile.dateOfBirth}`}
                    {typeof row.teacherInfo?.studentCount === "number" &&
                      ` · ghép được ${row.teacherInfo.studentCount} học sinh`}
                  </div>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--primary"
                    onClick={() => setApproval(row, STATUS.APPROVED)}
                  >
                    ✅ Duyệt
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => setApproval(row, STATUS.REJECTED)}
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bảng điều khiển. Đặt SAU khối chờ duyệt vì khối đó là việc phải làm
          ngay, còn đây là để nắm tình hình — nhưng trên mọi thứ còn lại, vì nó
          trả lời câu hỏi "hệ thống đang ra sao" mà các bảng dưới chỉ trả lời
          được từng dòng một. Khối chờ duyệt chỉ hiện khi thật sự có người chờ,
          nên phần lớn thời gian đây vẫn là thứ đầu tiên đập vào mắt. */}
      <AdminDashboard onError={setError} refreshKey={refreshKey} />

      {/* Công tắc chế độ khách. Đặt trên bảng tài khoản vì nó tác động tới MỌI
          người vào web, còn bảng dưới là việc của từng tài khoản một. */}
      <section className="admin-panel">
        <h2 className="admin-panel__title">Chế độ khách</h2>

        <p className="admin-note">
          Cho phép trò chuyện với Larry mà không cần đăng nhập — chính là nút{" "}
          <strong>“Trò chuyện với Larry ngay”</strong> ở trang đăng nhập. Tắt đi thì nút biến
          mất, và máy chủ cũng từ chối mọi phiên khách, kể cả khi có người gọi thẳng vào API.
        </p>

        <div className="admin-setting">
          <div className="admin-setting__info">
            <strong>
              {guestMode === null
                ? "Đang đọc cài đặt..."
                : guestMode
                  ? "🟢 Đang BẬT"
                  : "🔴 Đang TẮT"}
            </strong>
            <div className="admin-muted">
              {guestMode === null
                ? "Chờ máy chủ trả lời."
                : guestMode
                  ? "Học sinh chưa có tài khoản vẫn vào nói chuyện với Larry được."
                  : "Chỉ tài khoản đã đăng ký mới trò chuyện được. Phiên khách đang mở vẫn chạy tiếp cho tới khi các em đóng."}
            </div>
          </div>

          <button
            type="button"
            className={`admin-btn ${guestMode ? "admin-btn--danger" : "admin-btn--primary"}`}
            onClick={toggleGuestMode}
            disabled={guestMode === null || guestModeSaving}
          >
            {guestModeSaving
              ? "Đang lưu..."
              : guestMode
                ? "Tắt chế độ khách"
                : "Bật chế độ khách"}
          </button>
        </div>
      </section>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Tài khoản người dùng</h2>

        <p className="admin-note">
          Vai trò không sửa được từ đây. Tài khoản quản trị chỉ được tạo bằng lệnh{" "}
          <code>npm run create-admin</code> chạy trên máy chủ. Với giáo viên chủ nhiệm, cột{" "}
          <strong>Lớp</strong> là lớp họ chủ nhiệm — Larry ghép thầy cô với học sinh dựa trên
          trường và lớp khớp nhau.
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
                  {/* Số điện thoại đứng trước email: đó mới là danh tính của tài
                      khoản. Email giờ không bắt buộc nên nhiều dòng sẽ trống. */}
                  <th>Số điện thoại</th>
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
                      <td colSpan={9}>
                        <div className="admin-edit">
                          <div className="admin-edit__grid">
                            <label>
                              Tên tài khoản
                              <input
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                              />
                            </label>
                            {/* Danh tính của tài khoản — đổi số ở đây là đổi luôn
                                cách người đó đăng nhập. Bỏ trống được, nhưng chỉ
                                khi tài khoản còn email (backend chặn nếu trống cả
                                hai, vì lúc đó không ai vào được nữa). */}
                            <label>
                              Số điện thoại
                              <input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                      <td className="admin-muted">{row.phone || "—"}</td>
                      <td className="admin-muted">{row.email || "—"}</td>
                      <td>
                        <span className={`admin-tag admin-tag--${row.role}`}>
                          {roleLabel(row.role)}
                        </span>

                        {/* Chỉ giáo viên mới đi qua vòng duyệt — hiện trạng thái
                            ngay cạnh vai trò để biết tài khoản đã dùng được chưa */}
                        {row.role === ROLES.TEACHER && row.status !== STATUS.APPROVED && (
                          <div className={`admin-status admin-status--${row.status}`}>
                            {statusLabel(row.status)}
                          </div>
                        )}
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
                          {/* Quản trị viên và giáo viên không trò chuyện với Larry
                              nên không có hội thoại nào để xem */}
                          {row.role === ROLES.STUDENT && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={() => openSessions(row)}
                            >
                              Hội thoại
                            </button>
                          )}

                          {/* Duyệt lại được cả tài khoản đã từ chối trước đó */}
                          {row.role === ROLES.TEACHER && row.status !== STATUS.APPROVED && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--primary"
                              onClick={() => setApproval(row, STATUS.APPROVED)}
                            >
                              Duyệt
                            </button>
                          )}
                          {row.role === ROLES.TEACHER && row.status === STATUS.APPROVED && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--ghost"
                              onClick={() => setApproval(row, STATUS.REJECTED)}
                            >
                              Gỡ duyệt
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
