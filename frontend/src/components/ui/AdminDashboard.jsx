import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ADMIN_STATS_URL } from "../../config/api";
import { riskCategoryLabel, riskLevelLabel } from "../../constants/riskCategories";
import { dateTimeCell } from "../../utils/xlsx";
import ExportExcelButton from "./ExportExcelButton";
import "../../styles/AdminDashboard.css";

// Bảng điều khiển của quản trị viên.
//
// Toàn bộ số liệu tới từ MỘT lần gọi /api/admin/stats (xem backend/stats.js), và
// một hàng lọc DUY NHẤT ở trên cùng quyết định khoảng ngày cho mọi ô bên dưới.
// Cố ý không cho từng biểu đồ có bộ lọc riêng: hai ô trên cùng màn hình mà nói
// về hai khoảng thời gian khác nhau là cách chắc chắn nhất để người đọc cộng
// nhầm hai con số với nhau.
//
// Màu vẽ dữ liệu chỉ có ba vai trò, khai ở AdminDashboard.css:
//   - chuỗi "an toàn" / "học sinh"  → xanh dương
//   - chuỗi "giáo viên"             → cam
//   - "có dấu hiệu" và ba mức rủi ro→ bảng màu TRẠNG THÁI, luôn đi kèm icon và
//     nhãn chữ, không bao giờ để màu tự nói một mình.
// Các cặp màu đứng cạnh nhau trong cùng một biểu đồ đã được kiểm tra khoảng cách
// màu (kể cả với người mù màu) trước khi chọn — đừng đổi lẻ một mã màu.

// Giờ Việt Nam, khớp với TZ_OFFSET_MINUTES của backend. Hai bên phải cắt ngày
// giống nhau, nếu không thì nút "Hôm nay" ở đây hỏi một khoảng mà máy chủ hiểu
// thành hôm khác.
const TZ_OFFSET_MINUTES = 420;
const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date(Date.now() + TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

function shiftDay(key, deltaDays) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + deltaDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function formatDay(key, withYear = false) {
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

// Tỉ lệ phần trăm, chỉ dùng để đọc — không có mẫu số thì trả về chuỗi rỗng chứ
// không phải "0%", vì 0% và "chưa có gì để tính" là hai chuyện khác nhau.
function percentOf(part, total) {
  if (!total) return "";
  return `${Math.round((part / total) * 100)}%`;
}

/**
 * Trần "đẹp" cho trục dọc — luôn là số CHẴN để vạch giữa cũng là số nguyên.
 * Vạch trục lẻ kiểu 12,5 làm người đọc dừng lại đúng ở chỗ đáng lẽ phải liếc qua.
 */
function niceMax(value) {
  if (value <= 2) return 2;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => normalized <= s) || 10;
  return Math.ceil((step * magnitude) / 2) * 2;
}

// --- Hàng lọc khoảng ngày -----------------------------------------------------

const PRESETS = [
  { id: "7", label: "7 ngày", days: 7 },
  { id: "30", label: "30 ngày", days: 30 },
  { id: "90", label: "90 ngày", days: 90 }
];

function DateRangeBar({ range, onChange, busy }) {
  const today = todayKey();

  // Khoảng hiện tại có trùng đúng một nút bấm sẵn nào không. Tính ra thay vì
  // nhớ nút nào vừa bấm: người dùng sửa tay hai ô ngày thành đúng 7 ngày gần
  // nhất thì nút "7 ngày" cũng phải sáng lên.
  const activePreset = useMemo(() => {
    if (range.to !== today) return "";
    const preset = PRESETS.find((p) => shiftDay(today, -(p.days - 1)) === range.from);
    return preset ? preset.id : "";
  }, [range.from, range.to, today]);

  const isThisMonth = range.to === today && range.from === `${today.slice(0, 7)}-01`;

  return (
    <div className="dash-filters">
      <span className="dash-filters__label">Khoảng thời gian</span>

      <div className="dash-filters__presets" role="group" aria-label="Chọn nhanh khoảng thời gian">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`dash-chip${activePreset === preset.id ? " dash-chip--on" : ""}`}
            aria-pressed={activePreset === preset.id}
            onClick={() => onChange({ from: shiftDay(today, -(preset.days - 1)), to: today })}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`dash-chip${isThisMonth ? " dash-chip--on" : ""}`}
          aria-pressed={isThisMonth}
          onClick={() => onChange({ from: `${today.slice(0, 7)}-01`, to: today })}
        >
          Tháng này
        </button>
      </div>

      <div className="dash-filters__custom">
        <label>
          Từ
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && onChange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          Đến
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => e.target.value && onChange({ ...range, to: e.target.value })}
          />
        </label>
      </div>

      {busy && <span className="dash-filters__busy">Đang cập nhật…</span>}
    </div>
  );
}

// --- Ô số liệu ----------------------------------------------------------------

function StatTile({ label, value, hint, tone = "" }) {
  return (
    <div className={`dash-tile${tone ? ` dash-tile--${tone}` : ""}`}>
      <span className="dash-tile__label">{label}</span>
      <strong className="dash-tile__value">{formatNumber(value)}</strong>
      {hint && <span className="dash-tile__hint">{hint}</span>}
    </div>
  );
}

// --- Biểu đồ cột theo ngày ----------------------------------------------------
//
// Cột chồng: phần dưới là chuỗi thứ nhất, phần trên là chuỗi thứ hai. Vẽ bằng
// div chứ không phải SVG — nhãn trục là chữ thật nên tự co giãn theo khổ màn
// hình mà không phải đo đạc gì, và mỗi cột là một vùng chạm cao hết khung chứ
// không phải mấy pixel của riêng cái cột thấp tè.

function DayColumnChart({ days, series, emptyText }) {
  const [cursor, setCursor] = useState(null);

  const totals = days.map((day) => series.reduce((sum, s) => sum + (day[s.key] || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const hasData = totals.some((t) => t > 0);

  // Khoảng 7 nhãn ngày là vừa đọc; nhiều hơn thì chữ chồng lên nhau
  const labelStep = Math.max(1, Math.ceil(days.length / 7));

  const move = (delta) => {
    setCursor((prev) => {
      const next = (prev === null ? 0 : prev) + delta;
      return Math.max(0, Math.min(days.length - 1, next));
    });
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowRight") move(1);
    else if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "Home") setCursor(0);
    else if (event.key === "End") setCursor(days.length - 1);
    else if (event.key === "Escape") setCursor(null);
    else return;
    event.preventDefault();
  };

  const active = cursor === null ? null : days[cursor];

  // Vị trí ngang của bảng đọc nhanh, tính theo bề ngang khung vẽ. Sát mép thì
  // NEO THEO MÉP thay vì căn giữa: căn giữa ở cột đầu/cuối làm bảng tràn hẳn ra
  // ngoài thẻ và bị cắt mất một nửa.
  const tipLeft = cursor === null ? 0 : ((cursor + 0.5) / days.length) * 100;
  const tipShift = tipLeft < 15 ? "0" : tipLeft > 85 ? "-100%" : "-50%";
  const readout = active
    ? `${formatDay(active.date, true)}: ${series
        .map((s) => `${s.label} ${formatNumber(active[s.key])}`)
        .join(", ")}`
    : "";

  if (!hasData) return <p className="dash-empty">{emptyText}</p>;

  return (
    <div className="dash-chart">
      <div className="dash-chart__frame">
        <div className="dash-chart__yaxis" aria-hidden="true">
          <span>{formatNumber(max)}</span>
          <span>{formatNumber(max / 2)}</span>
          <span>0</span>
        </div>

        <div
          className="dash-chart__plot"
          tabIndex={0}
          role="group"
          aria-label="Biểu đồ theo ngày. Dùng phím mũi tên trái/phải để đọc từng ngày."
          onKeyDown={onKeyDown}
          onMouseLeave={() => setCursor(null)}
          onBlur={() => setCursor(null)}
        >
          {/* Lưới ngang: nét mảnh, liền, chìm hẳn xuống dưới dữ liệu */}
          <div className="dash-chart__grid" aria-hidden="true">
            <i /><i /><i />
          </div>

          <div className="dash-chart__bars">
            {days.map((day, index) => {
              const total = totals[index];
              // Đoạn trên cùng có dữ liệu mới được bo góc — bo cả hai đoạn thì
              // chỗ nối giữa chúng lõm vào trông như thiếu mất một mẩu.
              const topKey = [...series].reverse().find((s) => day[s.key] > 0)?.key;

              return (
                <div
                  key={day.date}
                  className={`dash-col${cursor === index ? " dash-col--on" : ""}`}
                  onMouseEnter={() => setCursor(index)}
                  onFocus={() => setCursor(index)}
                >
                  <div className="dash-col__stack">
                    {series.map((s) => {
                      const value = day[s.key] || 0;
                      if (!value) return null;
                      return (
                        <div
                          key={s.key}
                          className="dash-col__seg"
                          style={{
                            height: `${(value / max) * 100}%`,
                            background: `var(${s.color})`,
                            borderRadius: s.key === topKey ? "4px 4px 0 0" : 0
                          }}
                        />
                      );
                    })}
                  </div>
                  {total === 0 && <div className="dash-col__zero" />}
                </div>
              );
            })}
          </div>

          {active && (
            <div
              className="dash-tip"
              style={{ left: `${tipLeft}%`, transform: `translateX(${tipShift})` }}
              role="presentation"
            >
              <div className="dash-tip__day">{formatDay(active.date, true)}</div>
              {series.map((s) => (
                <div key={s.key} className="dash-tip__row">
                  <i className="dash-tip__key" style={{ background: `var(${s.color})` }} />
                  <strong>{formatNumber(active[s.key])}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-chart__xaxis" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.date} className="dash-chart__tick">
            {index % labelStep === 0 && <i>{formatDay(day.date)}</i>}
          </span>
        ))}
      </div>

      {/* Người dùng bàn phím và trình đọc màn hình nghe đúng thứ chuột thấy */}
      <p className="dash-sr" aria-live="polite">{readout}</p>
    </div>
  );
}

// Chú giải — luôn có mặt khi biểu đồ từ hai chuỗi trở lên, để danh tính không
// bao giờ chỉ nằm ở màu sắc.
function Legend({ series }) {
  return (
    <div className="dash-legend">
      {series.map((s) => (
        <span key={s.key} className="dash-legend__item">
          <i style={{ background: `var(${s.color})` }} />
          {s.icon ? `${s.icon} ` : ""}
          {s.label}
        </span>
      ))}
    </div>
  );
}

// Một dòng thanh ngang: nhãn – thanh – số. Số luôn hiện thành chữ bên cạnh, nên
// thanh chỉ để so sánh nhanh chứ không phải đường duy nhất để đọc giá trị.
function BarRow({ label, icon, value, max, color, note }) {
  return (
    <div className="dash-barrow">
      <span className="dash-barrow__label">
        {icon && <span aria-hidden="true">{icon} </span>}
        {label}
      </span>
      <span className="dash-barrow__track">
        <i style={{ width: `${max ? (value / max) * 100 : 0}%`, background: `var(${color})` }} />
      </span>
      <span className="dash-barrow__value">{formatNumber(value)}</span>
      {note !== undefined && <span className="dash-barrow__note">{note}</span>}
    </div>
  );
}

// Thanh ngang chồng hai đoạn, dùng cho "hội thoại theo lớp": tổng chiều dài là
// số hội thoại, phần đỏ là số bị gắn cờ.
function StackedBarRow({ title, subtitle, safe, flagged, max }) {
  const total = safe + flagged;
  return (
    <div className="dash-barrow dash-barrow--stack">
      <span className="dash-barrow__label">
        <strong>{title}</strong>
        {subtitle && <em>{subtitle}</em>}
      </span>
      <span className="dash-barrow__track">
        <i
          className="dash-barrow__seg"
          style={{ width: `${max ? (safe / max) * 100 : 0}%`, background: "var(--dash-safe)" }}
        />
        <i
          className="dash-barrow__seg"
          style={{
            width: `${max ? (flagged / max) * 100 : 0}%`,
            background: "var(--dash-flag)",
            borderRadius: "0 4px 4px 0"
          }}
        />
      </span>
      <span className="dash-barrow__value">{formatNumber(total)}</span>
      <span className="dash-barrow__note">
        {flagged > 0 ? `🚩 ${formatNumber(flagged)}` : "—"}
      </span>
    </div>
  );
}

// --- Trang --------------------------------------------------------------------

const CONVERSATION_SERIES = [
  { key: "safe", label: "Không có dấu hiệu", color: "--dash-safe" },
  { key: "flagged", label: "Có dấu hiệu tiêu cực", color: "--dash-flag", icon: "🚩" }
];

const ACCOUNT_SERIES = [
  { key: "newStudents", label: "Học sinh", color: "--dash-student" },
  { key: "newTeachers", label: "Giáo viên chủ nhiệm", color: "--dash-teacher" }
];

// Số dòng bảng lớp hiện sẵn trước khi phải bấm xem thêm
const CLASS_TABLE_LIMIT = 15;

const RISK_ROWS = [
  { key: "high", color: "--dash-high", icon: "🔴" },
  { key: "medium", color: "--dash-medium", icon: "🟠" },
  { key: "low", color: "--dash-low", icon: "🟡" }
];

// Tên ba bảng của màn hình này. Khai một chỗ vì mỗi tên được dùng ở HAI nơi —
// tiêu đề trên màn hình và tên file .xlsx tải về — và hai nơi đó lệch nhau thì
// quản trị viên tải bốn file rồi không biết file nào của bảng nào.
const DAILY_TABLE = "Hội thoại theo ngày";
const CLASSES_TABLE = "Các lớp đã tạo tài khoản";
const SCHOOLS_TABLE = "Các trường đã tạo tài khoản";

// Ngày ghi dạng yyyy-mm-dd chứ không phải 19/08/2026: trong Excel, cột ngày kiểu
// dd/mm/yyyy sắp xếp theo NGÀY TRONG THÁNG chứ không theo thời gian.
const DAILY_COLUMNS = [
  { header: "Ngày", value: (d) => d.date, width: 12 },
  { header: "Hội thoại", value: (d) => d.sessions || 0, width: 11 },
  { header: "Có dấu hiệu", value: (d) => d.flagged || 0, width: 12 },
  { header: "Khẩn cấp", value: (d) => d.high || 0, width: 11 },
  { header: "Tin nhắn", value: (d) => d.messages || 0, width: 11 },
  // Trên màn hình hai con số này gộp vào một ô ("3 HS · 1 GV") cho đỡ chật. Trong
  // file thì tách đôi — gộp lại là một ô chữ, cộng hay lọc đều không được.
  { header: "Học sinh mới", value: (d) => d.newStudents || 0, width: 13 },
  { header: "Giáo viên mới", value: (d) => d.newTeachers || 0, width: 13 },
  { header: "Cảnh báo đã gửi", value: (d) => d.alerts || 0, width: 15 }
];

const CLASSES_COLUMNS = [
  { header: "Trường", value: (r) => r.school || "", width: 32 },
  { header: "Lớp", value: (r) => r.className || "", width: 12 },
  { header: "Khối", value: (r) => r.grade || "", width: 8 },
  { header: "GVCN", value: (r) => r.teacherName || "", width: 24 },
  {
    header: "Trạng thái GVCN",
    value: (r) => (r.teacherName ? (r.teacherStatus === "approved" ? "Đã duyệt" : "Chờ duyệt") : "Chưa có"),
    width: 16
  },
  { header: "Học sinh", value: (r) => r.students || 0, width: 11 },
  { header: "Đang dùng", value: (r) => r.activeStudents || 0, width: 11 },
  { header: "Hội thoại", value: (r) => r.sessions || 0, width: 11 },
  { header: "Bị gắn cờ", value: (r) => r.flagged || 0, width: 11 },
  { header: "Khẩn cấp", value: (r) => r.high || 0, width: 11 },
  { header: "Hoạt động gần nhất", value: (r) => dateTimeCell(r.lastActivityAt), width: 20 }
];

const SCHOOLS_COLUMNS = [
  { header: "Trường", value: (r) => r.school || "", width: 34 },
  { header: "Số lớp", value: (r) => r.classes || 0, width: 10 },
  { header: "Học sinh", value: (r) => r.students || 0, width: 11 },
  { header: "GVCN", value: (r) => r.teachers || 0, width: 10 },
  { header: "Hội thoại", value: (r) => r.sessions || 0, width: 11 },
  { header: "Bị gắn cờ", value: (r) => r.flagged || 0, width: 11 },
  { header: "Khẩn cấp", value: (r) => r.high || 0, width: 11 },
  { header: "Cảnh báo đã gửi", value: (r) => r.alerts || 0, width: 15 }
];

export default function AdminDashboard({ onError, refreshKey = 0 }) {
  const [range, setRange] = useState(() => {
    const today = todayKey();
    return { from: shiftDay(today, -29), to: today };
  });

  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(true);
  const [showDayTable, setShowDayTable] = useState(false);

  // Bảng lớp cắt bớt cho tới khi người dùng bấm xem thêm. Một trường cấp 2 có
  // vài chục lớp, cả huyện thì vài trăm — đổ hết ra làm phần còn lại của trang
  // quản trị trôi xuống dưới tầm nhìn. Các lớp đáng chú ý nhất đã được máy chủ
  // xếp lên đầu (xem byClass trong stats.js) nên phần cắt đi là phần yên ổn.
  const [allClasses, setAllClasses] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await axios.get(ADMIN_STATS_URL, { params: range });
      setStats(res.data);
      setAllClasses(false);
    } catch (err) {
      onError?.(err.response?.data?.error || "Không tải được số liệu thống kê.");
    } finally {
      setBusy(false);
    }
    // refreshKey không được dùng trong thân hàm — nó có mặt ở đây chỉ để nút
    // "Tải lại" của trang cha buộc lần gọi này chạy lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, onError, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Số phiên KHÔNG bị gắn cờ, tính ở đây chứ không bắt máy chủ gửi thêm một cột
  // nữa: nó luôn bằng tổng trừ đi phần bị gắn cờ, và hai nguồn cho cùng một con
  // số là hai chỗ có thể lệch nhau.
  const dailyChart = useMemo(
    () =>
      (stats?.daily || []).map((day) => ({
        ...day,
        safe: Math.max(0, day.sessions - day.flagged)
      })),
    [stats]
  );

  const topClasses = useMemo(() => {
    const rows = (stats?.byClass || []).filter((row) => row.sessions > 0);
    return rows.slice(0, 8);
  }, [stats]);

  const visibleClasses = useMemo(
    () => (allClasses ? stats?.byClass || [] : (stats?.byClass || []).slice(0, CLASS_TABLE_LIMIT)),
    [stats, allClasses]
  );

  const maxClassSessions = Math.max(1, ...topClasses.map((r) => r.sessions));
  const maxCategory = Math.max(1, ...(stats?.byCategory || []).map((c) => c.count));
  const maxRisk = Math.max(1, ...RISK_ROWS.map((r) => stats?.conversations?.[r.key] || 0));

  if (!stats) {
    return (
      <section className="admin-panel">
        <h2 className="admin-panel__title">📊 Bảng điều khiển</h2>
        <p className="admin-empty">{busy ? "Đang tải số liệu…" : "Chưa có số liệu."}</p>
      </section>
    );
  }

  const { accounts, classes, conversations, unassigned } = stats;

  return (
    <section className="admin-panel admin-dash">
      <h2 className="admin-panel__title">📊 Bảng điều khiển</h2>

      <DateRangeBar range={range} onChange={setRange} busy={busy} />

      <p className="admin-note">
        Đang xem <strong>{formatDay(stats.range.from, true)}</strong> →{" "}
        <strong>{formatDay(stats.range.to, true)}</strong> ({stats.range.days} ngày). Số hội
        thoại, số tài khoản mới và mọi biểu đồ bên dưới đều tính trong khoảng này; riêng tổng
        số tài khoản, số lớp và số trường là con số cộng dồn từ trước tới nay.
      </p>

      {/* Nạp lại thì GIỮ nguyên khung cũ và làm mờ đi, không dựng lại từ đầu:
          bảng nhảy một cái rồi hiện số mới khiến người đang đọc mất chỗ. */}
      <div className={`dash-body${busy ? " dash-body--busy" : ""}`}>
        <div className="dash-tiles">
          <StatTile
            label="Tài khoản học sinh"
            value={accounts.students}
            hint={`+${formatNumber(accounts.newStudents)} trong khoảng này`}
          />
          <StatTile
            label="Giáo viên chủ nhiệm"
            value={accounts.teachers}
            hint={
              accounts.teachersPending > 0
                ? `${formatNumber(accounts.teachersApproved)} đã duyệt · ${formatNumber(accounts.teachersPending)} chờ duyệt`
                : `${formatNumber(accounts.teachersApproved)} đã duyệt`
            }
          />
          <StatTile
            label="Lớp đã tạo tài khoản"
            value={classes.total}
            hint={`${formatNumber(classes.schools)} trường · ${formatNumber(classes.withTeacher)} lớp đã có GVCN`}
          />
          <StatTile
            label="Hội thoại"
            value={conversations.sessions}
            hint={`${formatNumber(conversations.activeStudents)} học sinh · ${formatNumber(conversations.messages)} tin nhắn`}
          />
          <StatTile
            label="Hội thoại bị gắn cờ"
            value={conversations.flagged}
            tone="flag"
            hint={
              conversations.sessions
                ? `${percentOf(conversations.flagged, conversations.sessions)} số hội thoại`
                : "chưa có hội thoại nào"
            }
          />
          <StatTile
            label="Hội thoại khẩn cấp"
            value={conversations.high}
            tone="high"
            hint={
              conversations.flagged
                ? `${percentOf(conversations.high, conversations.flagged)} số hội thoại bị gắn cờ · đã gửi ${formatNumber(conversations.alerts)} email cảnh báo`
                : `đã gửi ${formatNumber(conversations.alerts)} email cảnh báo`
            }
          />
        </div>

        {/* --- Hội thoại theo ngày --- */}
        <div className="dash-card">
          <div className="dash-card__head">
            <div>
              <h3 className="dash-card__title">{DAILY_TABLE}</h3>
              <p className="dash-card__sub">
                Mỗi cột là một ngày; phần đỏ là số hội thoại có dấu hiệu tiêu cực.
              </p>
            </div>

            {/* Tải được cả khi đang xem biểu đồ — số liệu vẫn là số liệu đó, chỉ
                khác cách vẽ ra màn hình. Bắt bấm sang chế độ bảng rồi mới cho tải
                là thêm một bước không có lý do. */}
            <div className="dash-card__actions">
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                onClick={() => setShowDayTable((v) => !v)}
              >
                {showDayTable ? "Xem biểu đồ" : "Xem bảng số liệu"}
              </button>

              <ExportExcelButton name={DAILY_TABLE} columns={DAILY_COLUMNS} rows={dailyChart} />
            </div>
          </div>

          <Legend series={CONVERSATION_SERIES} />

          {showDayTable ? (
            <div className="admin-table-wrap">
              <table className="admin-table dash-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Hội thoại</th>
                    <th>Có dấu hiệu</th>
                    <th>Khẩn cấp</th>
                    <th>Tin nhắn</th>
                    <th>Tài khoản mới</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyChart
                    .filter((d) => d.sessions || d.newStudents || d.newTeachers)
                    .map((day) => (
                      <tr key={day.date}>
                        <td>{formatDay(day.date, true)}</td>
                        <td>{formatNumber(day.sessions)}</td>
                        <td>{day.flagged ? `🚩 ${formatNumber(day.flagged)}` : "—"}</td>
                        <td>{day.high ? formatNumber(day.high) : "—"}</td>
                        <td>{formatNumber(day.messages)}</td>
                        <td>
                          {day.newStudents + day.newTeachers === 0
                            ? "—"
                            : `${formatNumber(day.newStudents)} HS · ${formatNumber(day.newTeachers)} GV`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {dailyChart.every((d) => !d.sessions && !d.newStudents && !d.newTeachers) && (
                <p className="dash-empty">Không có hoạt động nào trong khoảng này.</p>
              )}
            </div>
          ) : (
            <DayColumnChart
              days={dailyChart}
              series={CONVERSATION_SERIES}
              emptyText="Không có hội thoại nào trong khoảng này."
            />
          )}
        </div>

        <div className="dash-grid">
          {/* --- Tài khoản mới theo ngày --- */}
          <div className="dash-card">
            <h3 className="dash-card__title">Tài khoản mới theo ngày</h3>
            <p className="dash-card__sub">
              {formatNumber(accounts.newStudents)} học sinh và{" "}
              {formatNumber(accounts.newTeachers)} giáo viên đăng ký trong khoảng này.
            </p>
            <Legend series={ACCOUNT_SERIES} />
            <DayColumnChart
              days={stats.daily}
              series={ACCOUNT_SERIES}
              emptyText="Không có tài khoản nào được tạo trong khoảng này."
            />
          </div>

          {/* --- Mức độ rủi ro + dấu hiệu --- */}
          <div className="dash-card">
            <h3 className="dash-card__title">Mức độ và dấu hiệu</h3>
            <p className="dash-card__sub">
              {formatNumber(conversations.flagged)} hội thoại bị gắn cờ, chia theo mức độ.
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
                {stats.byCategory.map((cat) => (
                  <BarRow
                    key={cat.code}
                    label={riskCategoryLabel(cat.code)}
                    value={cat.count}
                    max={maxCategory}
                    color="--dash-safe"
                  />
                ))}
                <p className="dash-foot">
                  Một hội thoại có thể mang nhiều dấu hiệu, nên tổng ở đây lớn hơn số hội
                  thoại bị gắn cờ.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- Hội thoại theo lớp --- */}
        <div className="dash-card">
          <h3 className="dash-card__title">Hội thoại theo lớp</h3>
          <p className="dash-card__sub">
            {topClasses.length > 0
              ? `${topClasses.length} lớp có hội thoại nhiều nhất trong khoảng này.`
              : "Chưa có lớp nào phát sinh hội thoại trong khoảng này."}
          </p>

          {topClasses.length > 0 && (
            <>
              <Legend series={CONVERSATION_SERIES} />
              <div className="dash-classbars">
                {topClasses.map((row) => (
                  <StackedBarRow
                    key={row.key}
                    title={row.className}
                    subtitle={row.school}
                    safe={Math.max(0, row.sessions - row.flagged)}
                    flagged={row.flagged}
                    max={maxClassSessions}
                  />
                ))}
              </div>
            </>
          )}

          {unassigned.students > 0 && (
            <p className="dash-warn">
              ⚠️ {formatNumber(unassigned.students)} tài khoản học sinh chưa khai đủ trường và
              lớp
              {unassigned.sessions > 0 &&
                ` — ${formatNumber(unassigned.sessions)} hội thoại (${formatNumber(unassigned.flagged)} bị gắn cờ)`}{" "}
              không thuộc lớp nào trong bảng dưới, và cũng chưa ghép được với giáo viên chủ
              nhiệm nào.
            </p>
          )}
        </div>

        {/* --- Danh sách lớp --- */}
        <div className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{CLASSES_TABLE}</h3>

            {/* Tải TẤT CẢ các lớp, không chỉ mấy lớp đang hiện. Bảng trên màn
                hình cắt bớt cho khỏi dài; file tải về mà cũng thiếu thì đúng lúc
                cần tra một lớp yên ổn lại không có. */}
            <ExportExcelButton
              name={CLASSES_TABLE}
              columns={CLASSES_COLUMNS}
              rows={stats.byClass}
            />
          </div>
          <p className="dash-card__sub">
            {formatNumber(classes.total)} lớp thuộc {formatNumber(classes.schools)} trường, lớp
            cần chú ý xếp lên đầu. Cột học sinh là tổng cộng dồn; cột hội thoại tính trong
            khoảng đang xem.
          </p>

          {stats.byClass.length === 0 ? (
            <p className="dash-empty">Chưa có lớp nào — chưa tài khoản nào khai đủ trường và lớp.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table dash-table">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th>Lớp</th>
                    <th>Khối</th>
                    <th>GVCN</th>
                    <th>Học sinh</th>
                    <th>Hội thoại</th>
                    <th>Bị gắn cờ</th>
                    <th>Khẩn cấp</th>
                    <th>Gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClasses.map((row) => (
                    <tr key={row.key}>
                      <td>{row.school}</td>
                      <td><strong>{row.className}</strong></td>
                      <td className="admin-muted">{row.grade || "—"}</td>
                      <td>
                        {row.teacherName ? (
                          <>
                            {row.teacherName}
                            {row.teacherStatus !== "approved" && (
                              <div className="admin-status admin-status--pending">Chờ duyệt</div>
                            )}
                          </>
                        ) : (
                          <span className="dash-gap">Chưa có</span>
                        )}
                      </td>
                      <td>
                        {formatNumber(row.students)}
                        {row.activeStudents > 0 && (
                          <span className="admin-muted"> ({row.activeStudents} đang dùng)</span>
                        )}
                      </td>
                      <td>{formatNumber(row.sessions)}</td>
                      <td>{row.flagged > 0 ? `🚩 ${formatNumber(row.flagged)}` : "—"}</td>
                      <td>
                        {row.high > 0 ? (
                          <span className="dash-high-cell">❗ {formatNumber(row.high)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="admin-muted">{formatTime(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {stats.byClass.length > CLASS_TABLE_LIMIT && (
                <div className="dash-more">
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--ghost"
                    onClick={() => setAllClasses((v) => !v)}
                  >
                    {allClasses
                      ? `Thu gọn — chỉ hiện ${CLASS_TABLE_LIMIT} lớp đầu`
                      : `Xem tất cả ${formatNumber(stats.byClass.length)} lớp`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Danh sách trường --- */}
        <div className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{SCHOOLS_TABLE}</h3>

            <ExportExcelButton
              name={SCHOOLS_TABLE}
              columns={SCHOOLS_COLUMNS}
              rows={stats.bySchool}
            />
          </div>
          <p className="dash-card__sub">
            Gộp mọi lớp của cùng một trường. Tài khoản chưa khai trường không nằm trong bảng này.
          </p>

          {stats.bySchool.length === 0 ? (
            <p className="dash-empty">Chưa có trường nào.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table dash-table">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th>Lớp</th>
                    <th>Học sinh</th>
                    <th>GVCN</th>
                    <th>Hội thoại</th>
                    <th>Bị gắn cờ</th>
                    <th>Khẩn cấp</th>
                    <th>Cảnh báo đã gửi</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bySchool.map((row) => (
                    <tr key={row.key}>
                      <td><strong>{row.school}</strong></td>
                      <td>{formatNumber(row.classes)}</td>
                      <td>{formatNumber(row.students)}</td>
                      <td>{formatNumber(row.teachers)}</td>
                      <td>{formatNumber(row.sessions)}</td>
                      <td>{row.flagged > 0 ? `🚩 ${formatNumber(row.flagged)}` : "—"}</td>
                      <td>
                        {row.high > 0 ? (
                          <span className="dash-high-cell">❗ {formatNumber(row.high)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="admin-muted">
                        {row.alerts > 0 ? `✉️ ${formatNumber(row.alerts)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
