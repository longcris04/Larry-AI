import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import TeacherOverview from "./TeacherOverview";
import UsageFrequency from "./UsageFrequency";
import "../../styles/TeacherPage.css";

const TABS = [
  { id: "tong-quan", label: "📊 Tổng quan" },
  { id: "tan-suat", label: "📈 Tần suất sử dụng" }
];

export default function TeacherPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState(TABS[0].id);
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadScope = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/students`);
      setTeacher(response.data.teacher);
      setStudents(response.data.students || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không tải được dữ liệu lớp.");
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
          <h1 className="teacher-topbar__title">🍎 Khu vực giáo viên</h1>
          <p className="teacher-topbar__subtitle">
            {teacher?.profile?.fullName || user?.username}
            {teacher?.classLabel && (
              <>
                {" · "}
                <strong>{teacher.classLabel}</strong>
              </>
            )}
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

      <nav className="teacher-tabs" role="tablist" aria-label="Khu vực giáo viên">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`teacher-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`teacher-panel-${item.id}`}
            className={`teacher-tab${tab === item.id ? " teacher-tab--on" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading && !teacher ? (
        <p className="teacher-empty">Đang tải dữ liệu lớp...</p>
      ) : !teacher ? (
        <p className="teacher-empty">Chưa tải được thông tin trường và lớp chủ nhiệm.</p>
      ) : (
        <>
          {tab === "tong-quan" && (
            <div
              id="teacher-panel-tong-quan"
              role="tabpanel"
              aria-labelledby="teacher-tab-tong-quan"
            >
              <TeacherOverview
                teacher={teacher}
                students={students}
                onError={setError}
                refreshKey={refreshKey}
              />
            </div>
          )}

          {tab === "tan-suat" && (
            <div
              id="teacher-panel-tan-suat"
              role="tabpanel"
              aria-labelledby="teacher-tab-tan-suat"
            >
              <UsageFrequency
                key={refreshKey}
                users={students}
                onError={setError}
                apiScope="teacher"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
