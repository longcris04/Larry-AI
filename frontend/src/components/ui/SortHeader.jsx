// Tiêu đề cột bấm được, dùng chung cho bảng trường (bảng điều khiển) và bảng tài
// khoản. Hai bảng trên cùng một trang quản trị thì bấm phải ra cùng một kiểu.
//
// Mỗi cột đi qua BA trạng thái: ↕ chưa xếp → ↓ nhiều nhất lên đầu → ↑ ít nhất
// lên đầu → về mặc định. Có trạng thái thứ ba vì thứ tự mặc định của mỗi bảng
// cũng là một thứ tự thật (trường cần chú ý lên đầu; tài khoản theo lúc đăng ký),
// không phải chỗ tạm trú — sắp xếp xong mà không có đường về thì phải tải lại cả
// trang mới thấy lại danh sách như cũ.
//
// Bấm lần đầu là GIẢM DẦN, không phải tăng dần: người ta mở mấy bảng này để tìm
// dòng nhiều nhất hoặc đáng chú ý nhất, chứ không phải để đếm ngược từ 0.

import "../../styles/AdminPage.css";

/**
 * Bấm cột đang bật thì đảo chiều, bấm lần thứ ba thì về mặc định. Bấm cột khác
 * thì cột này tự tắt — hai cách xếp không chồng lên nhau được.
 *
 * @returns {{id: string, dir: "desc"|"asc"}|null} `null` = thứ tự mặc định
 */
export function cycleSort(prev, id) {
  if (prev?.id !== id) return { id, dir: "desc" };
  if (prev.dir === "desc") return { id, dir: "asc" };
  return null;
}

/**
 * Chữ đọc lên cho trình đọc màn hình, và cũng là tooltip.
 *
 * Nói VIỆC SẼ XẢY RA khi bấm, còn mũi tên trên tiêu đề nói TÌNH TRẠNG HIỆN TẠI —
 * trộn hai thứ này là nguồn gốc của mấy cái nút bấm vào làm ngược hẳn điều nó ghi.
 */
export function sortHint(label, sort, id) {
  if (sort?.id !== id) return `Sắp xếp theo ${label}, nhiều nhất lên đầu`;
  if (sort.dir === "desc") {
    return `Đang xếp ${label} nhiều nhất lên đầu — bấm để đảo lại, ít nhất lên đầu`;
  }
  return `Đang xếp ${label} ít nhất lên đầu — bấm để bỏ sắp xếp, về thứ tự mặc định`;
}

export default function SortHeader({ id, label, sort, onSort }) {
  const on = sort?.id === id;
  const hint = sortHint(label, sort, id);

  return (
    // aria-sort là thứ trình đọc màn hình dùng để nói "cột này đang xếp giảm
    // dần" lúc người dùng đi ngang qua tiêu đề — mũi tên ↓ chỉ là hình vẽ.
    <th aria-sort={on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className={`admin-sort${on ? " admin-sort--on" : ""}`}
        aria-pressed={on}
        aria-label={hint}
        title={hint}
        onClick={() => onSort(id)}
      >
        {label}
        <span className="admin-sort__arrow" aria-hidden="true">
          {on ? (sort.dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}
