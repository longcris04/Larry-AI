// Biểu đồ cột theo ngày — dùng chung cho mọi màn hình thống kê của quản trị viên.
//
// Cột chồng: phần dưới là chuỗi thứ nhất, phần trên là chuỗi thứ hai. Vẽ bằng
// div chứ không phải SVG — nhãn trục là chữ thật nên tự co giãn theo khổ màn
// hình mà không phải đo đạc gì, và mỗi cột là một vùng chạm cao hết khung chứ
// không phải mấy pixel của riêng cái cột thấp tè.
//
// Một chuỗi thì nó là biểu đồ cột thường; nhiều chuỗi thì thành cột chồng. Nhờ
// vậy bảng điều khiển (hội thoại an toàn / có dấu hiệu) và tab tần suất sử dụng
// (chỉ một con số mỗi ngày) dùng CHUNG một bộ code — kể cả phần đọc bằng bàn
// phím và dòng mô tả cho trình đọc màn hình, thứ rất dễ bị bỏ quên nếu chép lại.
//
// Mỗi phần tử `days` là { date: "yyyy-mm-dd", [key của từng chuỗi]: số }.
// `series` là [{ key, label, color: "--tên-biến-css" }].

import { useState } from "react";
import { formatDay, formatNumber, niceMax } from "../../utils/days";
import "../../styles/AdminDashboard.css";

export default function DayColumnChart({ days, series, emptyText }) {
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
