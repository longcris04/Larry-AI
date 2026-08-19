// Nút "Tải Excel" đứng cạnh mỗi bảng ở trang quản trị.
//
// File tải về LẤY ĐÚNG TÊN BẢNG hiện trên màn hình ("Tài khoản người dùng.xlsx",
// "Các lớp đã tạo tài khoản.xlsx"...). Đó là chủ ý: quản trị viên tải bốn bảng
// liền nhau rồi mở thư mục Downloads, phải nhìn tên là biết file nào của bảng
// nào — chứ không phải mở từng file ra dò.
//
// Dữ liệu lấy từ state của trang, KHÔNG gọi thêm API. Nhờ vậy cái tải về luôn
// khớp với cái đang nhìn thấy (kể cả khoảng ngày vừa chọn ở bảng điều khiển),
// không tốn thêm một lượt gọi máy chủ, và không có chuyện token hết hạn giữa
// chừng làm hỏng lượt tải.

import { useState } from "react";
import { downloadTableAsExcel } from "../../utils/xlsx";

export default function ExportExcelButton({
  name,
  columns,
  rows = [],
  className = "admin-btn admin-btn--sm admin-btn--ghost"
}) {
  const [error, setError] = useState("");

  // Bảng rỗng thì không vẽ nút. Một file Excel chỉ có mỗi dòng tiêu đề không
  // giúp được gì, và một cái nút bấm vào ra file trống thì khó hiểu hơn là
  // không có nút.
  if (rows.length === 0) return null;

  const handleClick = () => {
    setError("");
    try {
      downloadTableAsExcel({ name, columns, rows });
    } catch (err) {
      // Dựng file chạy hoàn toàn trong trình duyệt nên gần như không hỏng được,
      // nhưng im lặng khi hỏng thì quản trị viên bấm mãi mà không hiểu vì sao
      // không thấy file đâu.
      setError(err.message || "Không tạo được file Excel.");
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        title={`Tải "${name}" về máy dưới dạng file Excel (${rows.length} dòng)`}
      >
        ⬇️ Tải Excel
      </button>

      {error && <span className="admin-export-error">{error}</span>}
    </>
  );
}
