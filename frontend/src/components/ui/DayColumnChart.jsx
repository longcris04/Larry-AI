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
//
// `showValues` (tuỳ chọn) in con số ngay trên đầu cột: cột nhóm thì MỖI cột một
// số (kể cả số 0), cột chồng thì một số là tổng của ngày, đặt trên đỉnh chồng.
// Chỗ hẹp thì số tự ẩn — xem `.dash-col__value` trong AdminDashboard.css. Ngày
// không có gì thì không cột nào và không số nào.
//
// `onSelect(day)` (tuỳ chọn) biến mỗi cột thành thứ BẤM ĐƯỢC — dùng cho biểu đồ
// tổng, nơi một cột cao bất thường luôn kéo theo câu hỏi "ngày đó là những em
// nào". Khi có nó thì khung vẽ thành một danh sách chọn thật sự (mũi tên để đi,
// Enter/Space để chọn) chứ không phải cái div bấm được mà chỉ chuột mới dùng nổi.

import { useId, useState } from "react";
import { formatDay, formatNumber, niceMax } from "../../utils/days";
import "../../styles/AdminDashboard.css";

export default function DayColumnChart({
  days,
  series,
  emptyText,
  grouped = false,
  onSelect,
  selectedDate = "",
  showValues = false
}) {
  const [cursor, setCursor] = useState(null);
  const listId = useId();
  const pickable = typeof onSelect === "function";

  const heights = days.map((day) =>
    grouped
      ? Math.max(0, ...series.map((item) => day[item.key] || 0))
      : series.reduce((sum, item) => sum + (day[item.key] || 0), 0)
  );
  const max = niceMax(Math.max(0, ...heights));
  const hasData = heights.some((value) => value > 0);

  // Khoảng 7 nhãn ngày là vừa đọc; nhiều hơn thì chữ chồng lên nhau
  const labelStep = Math.max(1, Math.ceil(days.length / 7));

  // Con số DÀI NHẤT sẽ in ra dài mấy ký tự. "3" và "1.024" cần hai khoảng rất
  // khác nhau, mà CSS thì đo được bề ngang cột chứ không đoán được bề ngang chữ
  // — nên chỗ hẹp tới đâu mới phải giấu số là do CON SỐ quyết định, ở đây đếm
  // sẵn rồi giao lại cho CSS qua tên lớp. Đếm cho CẢ biểu đồ chứ không từng
  // ngày: một hàng số lúc có lúc không nhìn còn rối hơn là không có.
  const valueRoom = Math.min(
    4,
    Math.max(
      1,
      ...days.map((day, index) =>
        grouped
          ? Math.max(...series.map((item) => formatNumber(day[item.key] || 0).length))
          : formatNumber(heights[index]).length
      )
    )
  );

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
    else if (pickable && (event.key === "Enter" || event.key === " ")) {
      // Chưa trỏ vào đâu thì Enter chọn ngày đầu tiên chứ không im lặng
      const index = cursor === null ? 0 : cursor;
      setCursor(index);
      onSelect(days[index]);
    } else return;
    event.preventDefault();
  };

  const describe = (day) =>
    `${formatDay(day.date, true)}: ${series
      .map((s) => `${s.label} ${formatNumber(day[s.key] || 0)}`)
      .join(", ")}`;

  const active = cursor === null ? null : days[cursor];

  // Vị trí ngang của bảng đọc nhanh, tính theo bề ngang khung vẽ. Sát mép thì
  // NEO THEO MÉP thay vì căn giữa: căn giữa ở cột đầu/cuối làm bảng tràn hẳn ra
  // ngoài thẻ và bị cắt mất một nửa.
  const tipLeft = cursor === null ? 0 : ((cursor + 0.5) / days.length) * 100;
  const tipShift = tipLeft < 15 ? "0" : tipLeft > 85 ? "-100%" : "-50%";
  const readout = active ? describe(active) : "";

  if (!hasData) return <p className="dash-empty">{emptyText}</p>;

  return (
    <div
      className={`dash-chart${showValues ? ` dash-chart--values dash-chart--v${valueRoom}` : ""}`}
    >
      <div className="dash-chart__frame">
        <div className="dash-chart__yaxis" aria-hidden="true">
          <span>{formatNumber(max)}</span>
          <span>{formatNumber(max / 2)}</span>
          <span>0</span>
        </div>

        <div
          className="dash-chart__plot"
          tabIndex={0}
          role={pickable ? "listbox" : "group"}
          aria-label={
            pickable
              ? "Biểu đồ theo ngày. Mũi tên trái/phải để đi từng ngày, Enter để xem những học sinh của ngày đó."
              : "Biểu đồ theo ngày. Dùng phím mũi tên trái/phải để đọc từng ngày."
          }
          aria-activedescendant={
            pickable && cursor !== null ? `${listId}-${cursor}` : undefined
          }
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
              const height = heights[index];
              // Đoạn trên cùng có dữ liệu mới được bo góc — bo cả hai đoạn thì
              // chỗ nối giữa chúng lõm vào trông như thiếu mất một mẩu.
              const topKey = [...series].reverse().find((s) => day[s.key] > 0)?.key;

              // Đoạn cõng con số DẪN — số duy nhất còn trụ lại khi ô hẹp dần.
              // Cột chồng lấy đoạn trên cùng (đỉnh chồng = tổng), cột nhóm lấy
              // đoạn CAO NHẤT (đỉnh nhóm = chuỗi lớn nhất). Cả hai bằng `height`.
              const valueKey = !height
                ? undefined
                : grouped
                  ? series.find((s) => (day[s.key] || 0) === height)?.key
                  : topKey;

              const picked = pickable && selectedDate === day.date;

              return (
                <div
                  key={day.date}
                  id={pickable ? `${listId}-${index}` : undefined}
                  className={
                    `dash-col${cursor === index ? " dash-col--on" : ""}` +
                    `${pickable ? " dash-col--pick" : ""}${picked ? " dash-col--picked" : ""}`
                  }
                  role={pickable ? "option" : undefined}
                  aria-selected={pickable ? picked : undefined}
                  aria-label={pickable ? describe(day) : undefined}
                  onMouseEnter={() => setCursor(index)}
                  onFocus={() => setCursor(index)}
                  onClick={pickable ? () => onSelect(day) : undefined}
                >
                  <div className={`dash-col__stack${grouped ? " dash-col__stack--grouped" : ""}`}>
                    {series.map((s) => {
                      const value = day[s.key] || 0;

                      // Cột nhóm: ngày CÓ dữ liệu thì chuỗi bằng 0 vẫn giữ đúng
                      // ô của nó — bỏ hẳn ô đi thì mấy cột còn lại giãn ra lấp
                      // chỗ trống và ngày 2/0/0 phình to ngang ngày 2/2/2, đọc
                      // thành "ngày này nhiều" trong khi nó chỉ thiếu hai chuỗi.
                      // Ngày im lặng hẳn thì ngược lại: không vẽ ô nào.
                      // (Cột chồng không có chuyện này — bỏ đoạn 0 đi thì chồng
                      // vẫn cao đúng như cũ, mà vẽ ra lại thành một vạch xám kẹt
                      // giữa chồng.)
                      if (!value && (!grouped || !height)) return null;

                      return (
                        <div
                          key={s.key}
                          className="dash-col__seg"
                          style={{
                            height: `${(value / max) * 100}%`,
                            background: value ? `var(${s.color})` : "var(--dash-grid)",
                            borderRadius: grouped || s.key === topKey ? "4px 4px 0 0" : 0
                          }}
                        >
                          {/* aria-hidden: dòng mô tả và bảng đọc nhanh đã đọc
                              đủ mọi con số rồi, in lại chỉ làm ồn */}
                          {showValues && (grouped || s.key === valueKey) && (
                            <b
                              className={
                                `dash-col__value${s.key === valueKey ? " dash-col__value--lead" : ""}`
                              }
                              aria-hidden="true"
                            >
                              {formatNumber(grouped ? value : height)}
                            </b>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {height === 0 && <div className="dash-col__zero" />}
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
