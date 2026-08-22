import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import { formatDay, formatNumber, shiftDay, todayKey } from "../../utils/days";
import DateRangeBar from "./DateRangeBar";
import DayColumnChart from "./DayColumnChart";
import { BarRow, Legend, percentOf, StatTile } from "./DashParts";
import ReadOnlyAccounts from "./ReadOnlyAccounts";
import "../../styles/AdminDashboard.css";

const CONVERSATION_SERIES = [
  { key: "sessions", label: "Cuộc hội thoại", color: "--dash-safe" },
  { key: "flagged", label: "Bị gắn cờ", color: "--dash-flag" },
  { key: "high", label: "Khẩn cấp", color: "--dash-high" }
];

const ACCOUNT_SERIES = [
  { key: "newStudents", label: "Học sinh", color: "--dash-student" },
  { key: "newTeachers", label: "Giáo viên chủ nhiệm", color: "--dash-teacher" }
];

const RISK_ROWS = [
  { key: "high", color: "--dash-high", icon: "🔴" },
  { key: "medium", color: "--dash-medium", icon: "🟠" },
  { key: "low", color: "--dash-low", icon: "🟡" }
];

export default function TeacherOverview({ teacher, students = [], onError, refreshKey = 0 }) {
  const [range, setRange] = useState(() => {
    const today = todayKey();
    return { from: shiftDay(today, -29), to: today };
  });
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/stats`, { params: range });
      setStats(response.data);
    } catch (error) {
      onError?.(error.response?.data?.error || "Không tải được số liệu của lớp.");
    } finally {
      setBusy(false);
    }
  }, [range, onError]);

  useEffect(() => {
    load();
    // refreshKey chỉ dùng để nút tải lại ở trang cha kích hoạt lần gọi mới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);

  if (!stats) {
    return <p className="teacher-empty">{busy ? "Đang tải tổng quan..." : "Chưa có số liệu."}</p>;
  }

  const { accounts, conversations } = stats;
  const maxRisk = Math.max(1, ...RISK_ROWS.map((row) => conversations[row.key] || 0));
  const maxCategory = Math.max(1, ...stats.byCategory.map((category) => category.count));

  return (
    <section className={`admin-panel admin-dash teacher-overview${busy ? " dash-body--busy" : ""}`}>
      <h2 className="admin-panel__title">📊 Tổng quan lớp</h2>
      <DateRangeBar range={range} onChange={setRange} busy={busy} />
      <p className="admin-note">
        Chỉ dữ liệu lớp <strong>{teacher?.classLabel || "đang chủ nhiệm"}</strong>, từ{" "}
        <strong>{formatDay(stats.range.from, true)}</strong> đến{" "}
        <strong>{formatDay(stats.range.to, true)}</strong>.
      </p>

      <div className="dash-tiles">
        <StatTile
          label="Tài khoản học sinh đã tạo"
          value={accounts.newStudents}
          hint={`${formatNumber(accounts.students)} tài khoản hiện có trong lớp`}
        />
        <StatTile
          label="Cuộc hội thoại"
          value={conversations.sessions}
          hint={`${formatNumber(conversations.activeStudents)} học sinh đã sử dụng`}
        />
        <StatTile
          label="Hội thoại bị gắn cờ"
          value={conversations.flagged}
          tone="flag"
          hint={percentOf(conversations.flagged, conversations.sessions) || "chưa có hội thoại"}
        />
        <StatTile
          label="Hội thoại khẩn cấp"
          value={conversations.high}
          tone="high"
          hint={percentOf(conversations.high, conversations.flagged) || "chưa có hội thoại bị gắn cờ"}
        />
      </div>

      <div className="dash-card">
        <h3 className="dash-card__title">Hội thoại theo ngày</h3>
        <p className="dash-card__sub">Tổng số cuộc, số cuộc bị gắn cờ và số cuộc khẩn cấp.</p>
        <Legend series={CONVERSATION_SERIES} />
        <DayColumnChart
          days={stats.daily}
          series={CONVERSATION_SERIES}
          grouped
          emptyText="Lớp chưa có hội thoại nào trong khoảng này."
        />
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h3 className="dash-card__title">Tài khoản mới theo ngày</h3>
          <p className="dash-card__sub">
            {formatNumber(accounts.newStudents)} học sinh tạo tài khoản trong khoảng này.
          </p>
          <Legend series={ACCOUNT_SERIES} />
          <DayColumnChart
            days={stats.daily}
            series={ACCOUNT_SERIES}
            grouped
            emptyText="Không có tài khoản mới trong khoảng này."
          />
        </div>

        <div className="dash-card">
          <h3 className="dash-card__title">Mức độ và dấu hiệu</h3>
          <p className="dash-card__sub">
            {formatNumber(conversations.flagged)} hội thoại bị gắn cờ trong khoảng này.
          </p>
          <div className="dash-risks">
            {RISK_ROWS.map((row) => (
              <BarRow
                key={row.key}
                icon={row.icon}
                label={riskLevelLabel(row.key)}
                value={conversations[row.key] || 0}
                max={maxRisk}
                color={row.color}
                note={percentOf(conversations[row.key], conversations.flagged)}
              />
            ))}
          </div>

          <h4 className="dash-card__subtitle">Dấu hiệu thường gặp</h4>
          {stats.byCategory.length === 0 ? (
            <p className="dash-empty">Chưa ghi nhận dấu hiệu nào.</p>
          ) : (
            <div className="dash-cats">
              {stats.byCategory.map((category) => (
                <BarRow
                  key={category.code}
                  label={riskCategoryLabel(category.code)}
                  value={category.count}
                  max={maxCategory}
                  color="--dash-safe"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ReadOnlyAccounts
        accounts={[teacher, ...students].filter(Boolean)}
        description="Chỉ gồm tài khoản giáo viên của bạn và học sinh trong lớp; bảng chỉ đọc, không sửa hoặc xoá."
      />
    </section>
  );
}
