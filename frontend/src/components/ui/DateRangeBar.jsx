import { useMemo } from "react";

import { shiftDay, todayKey } from "../../utils/days";
import "../../styles/AdminDashboard.css";

const PRESETS = [
  { id: "7", label: "7 ngày", days: 7 },
  { id: "30", label: "30 ngày", days: 30 },
  { id: "90", label: "90 ngày", days: 90 }
];

// Hàng chọn ngày dùng chung cho bảng điều khiển và tab tần suất sử dụng.
export default function DateRangeBar({ range, onChange, busy = false }) {
  const today = todayKey();

  const activePreset = useMemo(() => {
    if (range.to !== today) return "";
    const preset = PRESETS.find((item) => shiftDay(today, -(item.days - 1)) === range.from);
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
            onChange={(event) =>
              event.target.value && onChange({ ...range, from: event.target.value })
            }
          />
        </label>
        <label>
          Đến
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(event) =>
              event.target.value && onChange({ ...range, to: event.target.value })
            }
          />
        </label>
      </div>

      {busy && <span className="dash-filters__busy">Đang cập nhật…</span>}
    </div>
  );
}
