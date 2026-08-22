// Mấy mảnh nhỏ dùng chung của các thẻ thống kê — ô số, chú giải, thanh ngang.
//
// Tách ra khỏi AdminDashboard.jsx vì giờ có HAI file cùng vẽ mấy thứ này (bảng
// điều khiển và các thẻ chia theo khối / mức độ dùng). Chép lại thì hai bên trôi
// lệch nhau: một bên đổi màu thanh hay đổi cách làm tròn phần trăm, bên kia
// không đổi, và hai thẻ nằm cạnh nhau trên cùng màn hình lại vẽ khác kiểu.
//
// KHÔNG có state, không gọi API — mỗi thứ ở đây chỉ nhận props rồi vẽ ra.

import { formatNumber } from "../../utils/days";
import "../../styles/AdminDashboard.css";

// Tỉ lệ phần trăm, chỉ dùng để đọc — không có mẫu số thì trả về chuỗi rỗng chứ
// không phải "0%", vì 0% và "chưa có gì để tính" là hai chuyện khác nhau.
export function percentOf(part, total) {
  if (!total) return "";
  return `${Math.round((part / total) * 100)}%`;
}

// Ô số liệu. `raw` để dùng nguyên chuỗi đã định dạng sẵn (số có phần thập phân
// chẳng hạn — formatNumber sẽ làm tròn mất).
export function StatTile({ label, value, hint, tone = "", raw = false }) {
  return (
    <div className={`dash-tile${tone ? ` dash-tile--${tone}` : ""}`}>
      <span className="dash-tile__label">{label}</span>
      <strong className="dash-tile__value">{raw ? value : formatNumber(value)}</strong>
      {hint && <span className="dash-tile__hint">{hint}</span>}
    </div>
  );
}

// Chú giải — luôn có mặt khi biểu đồ từ hai chuỗi trở lên, để danh tính không
// bao giờ chỉ nằm ở màu sắc.
export function Legend({ series }) {
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
export function BarRow({ label, icon, value, max, color, note }) {
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
