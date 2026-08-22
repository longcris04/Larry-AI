// Hai thẻ thống kê chia nhóm của bảng điều khiển:
//
//   1. Tài khoản học sinh theo khối 6 / 7 / 8 / 9
//   2. Học sinh chia theo số lượt đã dùng Larry (1 lần, 2–5, 6–10, trên 10)
//
// Cả hai đều xem được theo BA cách, chọn bằng hàng nút ngay trên thẻ:
//
//   Tất cả các trường   gộp mọi trường lại làm một
//   Theo từng trường    mỗi trường một dòng
//   Theo từng ngày      mỗi ngày một cột
//
// Vì sao ba cách nhìn nằm trong CÙNG một thẻ chứ không phải ba thẻ dựng sẵn: đây
// vẫn là một con số, chỉ khác cách cắt. Trải cả ba ra màn hình thì trang dài gấp
// ba, và người đọc phải tự nhớ ba bảng đó có cùng bộ lọc ngày hay không. Một thẻ
// đổi cách nhìn thì câu hỏi "cùng số liệu ấy, tách theo trường thì sao" trả lời
// bằng đúng một cú bấm.
//
// KHÔNG gọi API riêng: mọi thứ ở đây lấy từ stats.byGrade và stats.usage của
// cùng một lần gọi /api/admin/stats mà bảng điều khiển đã thực hiện, nên khoảng
// ngày ở đầu trang chi phối luôn hai thẻ này — không có chuyện hai chỗ trên cùng
// màn hình nói về hai khoảng thời gian khác nhau.

import { useState } from "react";

import { formatDay, formatNumber } from "../../utils/days";
import { BarRow, Legend, StatTile, percentOf } from "./DashParts";
import DayColumnChart from "./DayColumnChart";
import ExportExcelButton from "./ExportExcelButton";
import "../../styles/AdminDashboard.css";

const SCOPES = [
  { id: "all", label: "Tất cả các trường", file: "tất cả các trường" },
  { id: "school", label: "Theo từng trường", file: "theo từng trường" },
  { id: "day", label: "Theo từng ngày", file: "theo từng ngày" }
];

// Khoá của các chuỗi số liệu phải TRÙNG KHÍT với backend/stats.js (GRADE_KEYS và
// USAGE_KEYS). Đổi tên khoá ở một bên thôi thì cột vẽ ra bằng 0 hết mà không có
// lỗi nào báo lên — số liệu vẫn về đủ, chỉ là không ai đọc đúng khoá của nó.
//
// Màu: cả hai bộ đều là thang MỘT MÀU nhạt→đậm, vì cả hai đều có thứ tự thật
// (lớp 6 < 7 < 8 < 9; 1 lần < 2–5 < 6–10 < trên 10). Thang một màu làm bản thân
// thứ tự đó đọc được ngay trên cột chồng, và quan trọng hơn là nó KHÔNG lấn vào
// bảng màu trạng thái (đỏ/cam/vàng) — ở trang này đỏ và cam đã có nghĩa cố định
// là "khẩn cấp" và "có dấu hiệu", mượn lại chúng cho "lớp 8" là nói sai.
const GRADE_SERIES = [
  { key: "6", label: "Lớp 6", color: "--dash-step-1" },
  { key: "7", label: "Lớp 7", color: "--dash-step-2" },
  { key: "8", label: "Lớp 8", color: "--dash-step-3" },
  { key: "9", label: "Lớp 9", color: "--dash-step-4" },
  { key: "other", label: "Khối khác", color: "--dash-step-other" }
];

const USAGE_SERIES = [
  { key: "once", label: "1 lần", color: "--dash-step-1" },
  { key: "light", label: "2–5 lần", color: "--dash-step-2" },
  { key: "regular", label: "6–10 lần", color: "--dash-step-3" },
  { key: "heavy", label: "Trên 10 lần", color: "--dash-step-4" }
];

// Tên hai thẻ — dùng cho CẢ tiêu đề trên màn hình lẫn tên file tải về, khai một
// chỗ để hai nơi không bao giờ lệch nhau.
const GRADE_TABLE = "Tài khoản học sinh theo khối";
const USAGE_TABLE = "Mức độ sử dụng Larry AI";

// --- Mảnh dùng chung của hai thẻ ---------------------------------------------

function ScopeSwitch({ value, onChange, label }) {
  return (
    <div className="dash-scope" role="group" aria-label={label}>
      {SCOPES.map((scope) => (
        <button
          key={scope.id}
          type="button"
          className={`dash-chip${value === scope.id ? " dash-chip--on" : ""}`}
          aria-pressed={value === scope.id}
          onClick={() => onChange(scope.id)}
        >
          {scope.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Bảng vẽ từ ĐÚNG bộ cột mà nút tải Excel dùng.
 *
 * Một khai báo cột cho cả hai nơi, vì cột trên màn hình và cột trong file mà
 * khai riêng thì sớm muộn cũng lệch — thêm một cột vào bảng, quên thêm vào file,
 * và không có bài kiểm nào bắt được chuyện đó.
 *
 * `value(row)` trả về giá trị THÔ (số hoặc chuỗi) — đó là thứ Excel cần. `cell`
 * chỉ có mặt khi trên màn hình cần khác đi, ví dụ in ngày thành 19/08/2026 trong
 * khi file vẫn giữ 2026-08-19 để Excel sắp xếp đúng.
 */
function DataTable({ label, columns, rows, rowKey }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table dash-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.header}>{cellOf(col, row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellOf(column, row) {
  if (column.cell) return column.cell(row);

  const value = column.value(row);
  if (typeof value !== "number") return value || "—";

  // Số 0 in thành gạch ngang, trừ cột tổng. Một bảng mười trường × năm khối phần
  // lớn là số 0 — để nguyên thì mắt phải lọc lấy mấy ô có số thật giữa một rừng
  // số 0 giống hệt nhau. Riêng cột tổng thì 0 là một câu trả lời, không phải chỗ
  // trống, nên nó vẫn in ra "0".
  if (value === 0 && !column.showZero) return <span className="admin-muted">—</span>;

  return formatNumber(value);
}

// Cột chuỗi số liệu, dùng chung cho bảng theo trường và bảng theo ngày: cùng một
// bộ khoá, chỉ khác cái đứng ở cột đầu.
function seriesColumns(series) {
  return series.map((s) => ({ header: s.label, value: (row) => row[s.key] || 0, width: 12 }));
}

const DAY_COLUMN = {
  header: "Ngày",
  // File giữ dạng yyyy-mm-dd: trong Excel, cột ngày kiểu dd/mm/yyyy bị sắp xếp
  // theo NGÀY TRONG THÁNG chứ không theo thời gian.
  value: (row) => row.date,
  cell: (row) => formatDay(row.date, true),
  width: 12
};

const SCHOOL_COLUMN = {
  header: "Trường",
  value: (row) => row.school,
  cell: (row) => <strong>{row.school}</strong>,
  width: 34
};

/**
 * Phần "theo từng ngày" của cả hai thẻ: chú giải, biểu đồ cột chồng, và một nút
 * đổi sang bảng số.
 *
 * Bảng số KHÔNG phải thứ trang trí thêm: bốn năm đoạn cùng một màu chồng lên
 * nhau thì đoạn mỏng vài pixel gần như không đọc được giá trị bằng mắt. Biểu đồ
 * để thấy hình dạng theo thời gian, bảng để đọc con số — và người dùng bàn phím
 * hay trình đọc màn hình thì bảng mới là đường chính.
 */
function DayView({ days, series, label, emptyText }) {
  const [asTable, setAsTable] = useState(false);
  const rows = days.filter((day) => series.some((s) => day[s.key] > 0));
  const columns = dayColumns(series);

  return (
    <>
      <div className="dash-dayview__bar">
        <Legend series={series} />
        {rows.length > 0 && (
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--ghost"
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? "Xem biểu đồ" : "Xem bảng số liệu"}
          </button>
        )}
      </div>

      {asTable ? (
        <DataTable label={label} columns={columns} rows={rows} rowKey={(row) => row.date} />
      ) : (
        <DayColumnChart days={days} series={series} emptyText={emptyText} />
      )}
    </>
  );
}

// Cột của phần "theo từng ngày" — dùng cho CẢ bảng trên màn hình lẫn nút tải
// Excel ở đầu thẻ, nên hai chỗ không thể lệch cột nhau.
function dayColumns(series) {
  return [
    DAY_COLUMN,
    ...seriesColumns(series),
    {
      header: "Tổng",
      value: (row) => series.reduce((sum, s) => sum + (row[s.key] || 0), 0),
      showZero: true,
      width: 11
    }
  ];
}

// --- Thẻ 1: tài khoản học sinh theo khối --------------------------------------

export function GradeBreakdown({ byGrade }) {
  const [scope, setScope] = useState("all");

  const { total, created, bySchool, daily, withoutSchool, otherLabels } = byGrade;

  // Một dòng cho mỗi khối, dùng cho cả thanh ngang trên màn hình lẫn file Excel
  // của cách nhìn "tất cả".
  const gradeRows = GRADE_SERIES.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    students: total[s.key] || 0,
    created: created[s.key] || 0
  }));

  const maxGrade = Math.max(1, ...gradeRows.map((row) => row.students));

  const allColumns = [
    { header: "Khối", value: (row) => row.label, width: 14 },
    { header: "Tài khoản học sinh", value: (row) => row.students, width: 18 },
    { header: "Mới trong khoảng", value: (row) => row.created, width: 18 }
  ];

  const schoolColumns = [
    SCHOOL_COLUMN,
    ...seriesColumns(GRADE_SERIES),
    { header: "Tổng học sinh", value: (row) => row.all || 0, showZero: true, width: 14 },
    { header: "Mới trong khoảng", value: (row) => row.created || 0, width: 18 }
  ];

  const exports = {
    all: { columns: allColumns, rows: gradeRows },
    school: { columns: schoolColumns, rows: bySchool },
    day: { columns: dayColumns(GRADE_SERIES), rows: daily.filter((day) => day.all > 0) }
  }[scope];

  return (
    <div className="dash-card">
      <BreakdownHead
        title={GRADE_TABLE}
        sub={
          scope === "day"
            ? "Mỗi cột là số tài khoản học sinh ĐƯỢC TẠO trong ngày đó, chia theo khối."
            : "Tổng số tài khoản học sinh đã tạo từ trước tới nay, chia theo khối. Cột “mới trong khoảng” là phần đăng ký trong khoảng ngày đang chọn."
        }
        scope={scope}
        onScope={setScope}
        name={GRADE_TABLE}
        exports={exports}
      />

      {total.all === 0 ? (
        <p className="dash-empty">Chưa có tài khoản học sinh nào.</p>
      ) : scope === "all" ? (
        <>
          <div className="dash-tiles dash-tiles--lead">
            <StatTile
              label="Tổng tài khoản học sinh"
              value={total.all}
              hint={`+${formatNumber(created.all)} trong khoảng này`}
            />
          </div>

          <div className="dash-risks">
            {gradeRows.map((row) => (
              <BarRow
                key={row.key}
                label={row.label}
                value={row.students}
                max={maxGrade}
                color={row.color}
                note={
                  row.created > 0
                    ? `${percentOf(row.students, total.all)} · +${formatNumber(row.created)} mới`
                    : percentOf(row.students, total.all)
                }
              />
            ))}
          </div>
        </>
      ) : scope === "school" ? (
        bySchool.length === 0 ? (
          <p className="dash-empty">Chưa tài khoản học sinh nào khai trường.</p>
        ) : (
          <DataTable
            label={`${GRADE_TABLE} theo từng trường`}
            columns={schoolColumns}
            rows={bySchool}
            rowKey={(row) => row.key}
          />
        )
      ) : (
        <DayView
          days={daily}
          series={GRADE_SERIES}
          label={`${GRADE_TABLE} theo từng ngày`}
          emptyText="Không có tài khoản học sinh nào được tạo trong khoảng này."
        />
      )}

      <GradeFootnotes
        scope={scope}
        other={total.other}
        otherLabels={otherLabels}
        withoutSchool={withoutSchool}
      />
    </div>
  );
}

function GradeFootnotes({ scope, other, otherLabels, withoutSchool }) {
  const notes = [];

  // Ô "khối khác" phải tự khai nó gồm những gì. Một con số 12 không nói được đó
  // là 12 em học lớp 10 hay 12 em bỏ trống ô khối — hai chuyện, hai cách xử lý.
  if (other > 0 && otherLabels.length > 0) {
    notes.push(
      `Ô “Khối khác” gồm: ${otherLabels
        .map((item) => `${item.label} (${formatNumber(item.count)})`)
        .join(" · ")}.`
    );
  }

  if (scope === "school" && withoutSchool > 0) {
    notes.push(
      `${formatNumber(withoutSchool)} tài khoản học sinh chưa khai trường nên không có dòng nào trong bảng này.`
    );
  }

  notes.push(
    "Khối lấy từ ô “Học sinh lớp mấy” trong hồ sơ; em nào bỏ trống ô đó thì suy ra từ tên lớp (“8T1.1” là khối 8)."
  );

  return <p className="dash-foot">{notes.join(" ")}</p>;
}

// --- Thẻ 2: mức độ sử dụng ----------------------------------------------------

export function UsageBreakdown({ usage }) {
  const [scope, setScope] = useState("all");

  const { total, bySchool, daily } = usage;

  const bucketRows = USAGE_SERIES.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    students: total[s.key] || 0
  }));

  const maxBucket = Math.max(1, ...bucketRows.map((row) => row.students));

  const allColumns = [
    { header: "Số lượt đã dùng", value: (row) => row.label, width: 18 },
    { header: "Số học sinh", value: (row) => row.students, width: 14 }
  ];

  const schoolColumns = [
    SCHOOL_COLUMN,
    ...seriesColumns(USAGE_SERIES),
    { header: "Học sinh có dùng", value: (row) => row.users || 0, showZero: true, width: 17 },
    { header: "Chưa dùng lần nào", value: (row) => row.none || 0, width: 18 },
    { header: "Tổng số lượt", value: (row) => row.sessions || 0, width: 14 }
  ];

  const exports = {
    all: { columns: allColumns, rows: bucketRows },
    school: { columns: schoolColumns, rows: bySchool },
    day: { columns: dayColumns(USAGE_SERIES), rows: daily.filter((day) => day.users > 0) }
  }[scope];

  return (
    <div className="dash-card">
      <BreakdownHead
        title={USAGE_TABLE}
        sub={
          scope === "day"
            ? "Mỗi ngày tính RIÊNG: một em vào 3 lượt hôm nay và 1 lượt hôm qua sẽ nằm ở nhóm 2–5 lần của hôm nay và nhóm 1 lần của hôm qua."
            : "Mỗi lượt là một cuộc trò chuyện với Larry. Mỗi học sinh được xếp vào đúng một nhóm theo số lượt của em trong khoảng ngày đang chọn."
        }
        scope={scope}
        onScope={setScope}
        name={USAGE_TABLE}
        exports={exports}
      />

      {scope === "all" ? (
        <>
          <div className="dash-tiles dash-tiles--lead">
            <StatTile
              label="Học sinh đã dùng Larry"
              value={total.users}
              hint={`${formatNumber(total.sessions)} lượt trong khoảng này`}
            />
            <StatTile
              label="Chưa dùng lần nào"
              value={total.none}
              hint={
                total.students
                  ? `${percentOf(total.none, total.students)} trong ${formatNumber(total.students)} tài khoản học sinh`
                  : "chưa có tài khoản học sinh nào"
              }
            />
          </div>

          {total.users === 0 ? (
            <p className="dash-empty">Chưa em nào trò chuyện với Larry trong khoảng này.</p>
          ) : (
            <div className="dash-risks">
              {bucketRows.map((row) => (
                <BarRow
                  key={row.key}
                  label={row.label}
                  value={row.students}
                  max={maxBucket}
                  color={row.color}
                  note={percentOf(row.students, total.users)}
                />
              ))}
            </div>
          )}
        </>
      ) : scope === "school" ? (
        bySchool.length === 0 ? (
          <p className="dash-empty">Chưa tài khoản học sinh nào khai trường.</p>
        ) : (
          <DataTable
            label={`${USAGE_TABLE} theo từng trường`}
            columns={schoolColumns}
            rows={bySchool}
            rowKey={(row) => row.key}
          />
        )
      ) : (
        <DayView
          days={daily}
          series={USAGE_SERIES}
          label={`${USAGE_TABLE} theo từng ngày`}
          emptyText="Không có lượt trò chuyện nào trong khoảng này."
        />
      )}

      <p className="dash-foot">
        Bốn nhóm không chồng lên nhau nên cộng lại đúng bằng số học sinh có dùng. Em không có
        lượt nào không thuộc nhóm nào — “0 lần” là chưa dùng, không phải một mức độ dùng.
        {scope === "school" && " Em chưa khai trường không có mặt trong bảng này."}
      </p>
    </div>
  );
}

// --- Đầu thẻ: tiêu đề, hàng nút đổi cách nhìn, nút tải Excel ------------------

function BreakdownHead({ title, sub, scope, onScope, name, exports }) {
  const scopeName = SCOPES.find((s) => s.id === scope)?.file || "";

  return (
    <div className="dash-card__head">
      <div>
        <h3 className="dash-card__title">{title}</h3>
        <p className="dash-card__sub">{sub}</p>
      </div>

      <div className="dash-card__actions">
        <ScopeSwitch value={scope} onChange={onScope} label={`Cách xem ${title}`} />
        {/* Tên file mang theo cả cách nhìn: tải cả ba cách của cùng một thẻ thì
            trong thư mục Downloads phải phân biệt được ba file, chứ không phải
            "(1)", "(2)" như trình duyệt tự đặt. */}
        <ExportExcelButton
          name={`${name} — ${scopeName}`}
          columns={exports.columns}
          rows={exports.rows}
        />
      </div>
    </div>
  );
}

// --- Cả hai thẻ ---------------------------------------------------------------

export default function AdminBreakdowns({ stats }) {
  // Máy chủ đời cũ (chưa deploy lại) không trả về hai khối này. Vẽ ra thẻ rỗng
  // thì trông như số liệu bằng 0 — trong khi thật ra là chưa có số liệu.
  if (!stats?.byGrade || !stats?.usage) return null;

  return (
    <>
      <GradeBreakdown byGrade={stats.byGrade} />
      <UsageBreakdown usage={stats.usage} />
    </>
  );
}
