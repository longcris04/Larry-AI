import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import AccountsPanel from "./AccountsPanel";
import AdminDashboard from "./AdminDashboard";
import UsageFrequency from "./UsageFrequency";
import "../../styles/TeacherPage.css";

const TABS = [
  { id: "tong-quan", label: "📊 Tổng quan" },
  { id: "tan-suat", label: "📈 Tần suất sử dụng" }
];

export default function CounselorPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState(TABS[0].id);
  const [counselor, setCounselor] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadScope = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/counselor/users`);
      setCounselor(response.data.counselor);
      setUsers(response.data.users || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không tải được dữ liệu của trường.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScope();
  }, [loadScope]);

  const refresh = () => {
    loadScope();
    setRefreshKey((current) => current + 1);
  };

  return (
    <div className="teacher-page">
      <header className="teacher-topbar">
        <div>
          <h1 className="teacher-topbar__title">🧠 Phòng tâm lý học đường</h1>
          <p className="teacher-topbar__subtitle">
            {counselor?.profile?.fullName || user?.username}
            {counselor?.profile?.school && <> · <strong>{counselor.profile.school}</strong></>}
          </p>
        </div>
        <div className="teacher-topbar__actions">
          <button type="button" className="teacher-btn" onClick={refresh} disabled={loading}>
            Tải lại
          </button>
          <button type="button" className="teacher-btn teacher-btn--ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="teacher-error">{error}</div>}

      <nav className="teacher-tabs" role="tablist" aria-label="Khu vực phòng tâm lý học đường">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`teacher-tab${tab === item.id ? " teacher-tab--on" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading && !counselor ? (
        <p className="teacher-empty">Đang tải dữ liệu trường...</p>
      ) : !counselor ? (
        <p className="teacher-empty">Chưa tải được thông tin trường.</p>
      ) : tab === "tong-quan" ? (
        <>
          <AdminDashboard
            onError={setError}
            refreshKey={refreshKey}
            statsUrl={`${API_BASE_URL}/api/counselor/stats`}
            title="📊 Tổng quan trường"
          />
          {/* ĐÚNG bảng tài khoản của khu vực quản trị — cùng ô tìm kiếm, cùng bốn
              ô chọn ăn theo nhau, cùng ba cột số xếp được, cùng nút tải Excel và
              cùng ô lịch sử hội thoại mở ra dưới mỗi dòng. Khác đúng một chỗ:
              không có nút Sửa / Xoá / Duyệt, vì phòng tâm lý đọc dữ liệu của
              trường chứ không quản lý tài khoản. */}
          <AccountsPanel
            users={users}
            loading={loading}
            selfId={counselor?.id}
            sessionsUrl={(id) => `${API_BASE_URL}/api/counselor/users/${id}/sessions`}
            onError={setError}
            note={
              <p className="admin-note">
                Các tài khoản thuộc trường <strong>{counselor?.profile?.school}</strong> — chỉ
                xem, không có thao tác sửa hoặc xoá. Với giáo viên chủ nhiệm, cột{" "}
                <strong>Lớp</strong> là lớp họ chủ nhiệm.
              </p>
            }
          />
        </>
      ) : (
        <UsageFrequency
          key={refreshKey}
          users={users}
          onError={setError}
          apiScope="counselor"
        />
      )}
    </div>
  );
}
