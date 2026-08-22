// Mấy ô chọn lọc "ăn theo nhau" của các bảng trang quản trị.
//
// Tách ra khỏi AdminDashboard.jsx vì giờ có HAI bảng dùng đúng cơ chế này —
// bảng lớp của bảng điều khiển (Trường · Lớp · Khối · GVCN) và bảng tài khoản
// (Vai trò · Trường · Lớp · Khối). Chép lại lần thứ hai thì hai bên trôi lệch
// nhau, mà mấy quy tắc dưới đây đều thuộc loại quên một cái là bộ lọc thành cái
// bẫy chứ không báo lỗi gì:
//
//   1. Mỗi ô liệt kê những gì CÒN LẠI sau các ô KIA — chọn trường xong thì ô Lớp
//      chỉ còn lớp của trường đó. Nhờ vậy không tổ hợp nào bấm ra bảng trống.
//   2. Ô đang lọc KHÔNG tự thu hẹp theo chính nó, nếu không thì mở ô Trường ra
//      chỉ còn đúng cái trường đang chọn — và không đổi sang trường khác được nữa.
//   3. Mục đang chọn LUÔN còn trong danh sách, kể cả khi vừa bị lọc về 0 dòng:
//      biến mất khỏi ô chọn thì không còn cách nào bỏ chọn nó.
//
// Một "field" mô tả một chiều lọc:
//
//   { id, label, all, empty, of(row), format?(value), values? }
//
//   of      lấy giá trị thô từ một dòng
//   format  (tuỳ chọn) đổi giá trị thô thành chữ hiện trên màn hình — vai trò lưu
//           là "user" nhưng phải đọc là "Học sinh"
//   values  (tuỳ chọn) thứ tự cố định của các mục, thay cho thứ tự bảng chữ cái

// Ô trống cũng phải chọn được — "lớp nào CHƯA CÓ giáo viên chủ nhiệm" là câu hỏi
// hay gặp nhất, mà chuỗi rỗng thì đã là giá trị của mục "Tất cả" rồi. Lấy ký hiệu
// tập rỗng làm mã riêng vì không tên trường/lớp/người nào chứa nó.
export const NONE = "∅";

export function facetValue(raw) {
  const text = String(raw ?? "").trim();
  return text || NONE;
}

/** Bộ lọc rỗng (mọi chiều đều "tất cả"). */
export function noFilters(fields) {
  return Object.fromEntries(fields.map((field) => [field.id, ""]));
}

export function hasFilters(fields, filters) {
  return fields.some((field) => filters[field.id]);
}

/**
 * Dòng này có qua hết các ô đang chọn không.
 *
 * @param {string} [except] Bỏ qua đúng một chiều — dùng khi đếm mục cho chính ô đó
 */
export function passesFilters(row, fields, filters, except = "") {
  return fields.every(
    (field) =>
      field.id === except ||
      !filters[field.id] ||
      facetValue(field.of(row)) === filters[field.id]
  );
}

export function filterByFacets(rows, fields, filters) {
  return rows.filter((row) => passesFilters(row, fields, filters));
}

function labelOf(field, value) {
  if (value === NONE) return field.empty;
  return field.format ? field.format(value) : value;
}

/**
 * Danh sách mục cho từng ô chọn, kèm số dòng của mỗi mục.
 *
 * `rows` phải là phần ĐÃ qua ô tìm kiếm — ô gõ chữ lọc trước, mấy ô chọn lọc
 * tiếp trên phần còn lại, nên gõ "diem" xong thì ô Trường chỉ còn mấy trường
 * khớp chứ không phải cả danh sách toàn huyện.
 */
export function buildFacets(rows, fields, filters) {
  return fields.map((field) => {
    const counts = new Map();

    for (const row of rows) {
      if (!passesFilters(row, fields, filters, field.id)) continue;
      const value = facetValue(field.of(row));
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    const selected = filters[field.id];
    if (selected && !counts.has(selected)) counts.set(selected, 0);

    const options = [...counts.entries()]
      .sort((a, b) => {
        // Thứ tự cố định thì theo đó; giá trị lạ (không có trong `values`) xuống
        // cuối thay vì lên đầu — indexOf trả về -1 và -1 sẽ thắng mọi thứ.
        if (field.values) {
          const rank = (value) => {
            const index = field.values.indexOf(value);
            return index === -1 ? field.values.length : index;
          };
          const diff = rank(a[0]) - rank(b[0]);
          if (diff) return diff;
        }

        // "Chưa khai" xuống cuối — nó là chỗ trống của dữ liệu, không phải một
        // cái tên, nên xếp lẫn theo bảng chữ cái chỉ làm rối. numeric để 6A10
        // đứng sau 6A9 chứ không phải sau 6A1.
        if (a[0] === NONE) return 1;
        if (b[0] === NONE) return -1;
        return String(a[0]).localeCompare(String(b[0]), "vi", { numeric: true });
      })
      .map(([value, count]) => ({ value, count, label: labelOf(field, value) }));

    return {
      id: field.id,
      label: field.label,
      all: field.all,
      options,
      total: options.reduce((sum, option) => sum + option.count, 0)
    };
  });
}
