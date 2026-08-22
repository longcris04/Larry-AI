// Một ô chọn lọc của bảng quản trị. Phần tính toán nằm ở utils/facets.js.
//
// Dùng chung cho bảng lớp (bảng điều khiển) và bảng tài khoản — hai bảng trên
// cùng một trang, lọc theo cùng mấy chiều (Trường · Lớp · Khối), nên phải mở ra
// trông giống hệt nhau và đọc lên cũng giống hệt nhau.

import "../../styles/AdminPage.css";

export default function FacetSelect({ facet, value, onChange }) {
  return (
    <label className="admin-facet">
      <span className="admin-facet__label">{facet.label}</span>

      {/* Tên gọi cho trình đọc màn hình phải khai thẳng ở đây. Thẻ <label> bọc cả
          ô chọn, mà chữ của một <label> gồm luôn chữ của MỌI mục bên trong —
          không có dòng này thì ô Trường được đọc thành "Trường Tất cả trường
          Đoàn Thị Điểm Lê Quý Đôn…" */}
      <select
        aria-label={`Lọc theo ${facet.label}`}
        className={`admin-facet__select${value ? " admin-facet__select--on" : ""}`}
        value={value}
        onChange={(e) => onChange(facet.id, e.target.value)}
      >
        {/* Số in cạnh mỗi mục trả lời "chọn cái này thì được mấy dòng" — chưa bấm
            đã biết, không phải bấm thử rồi bấm lui. */}
        <option value="">
          {facet.all} ({facet.total})
        </option>
        {facet.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}
