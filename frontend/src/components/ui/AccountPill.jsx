import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Lối ra của màn mở đầu.
//
// Trước đây màn này chiếm trọn màn hình và KHÔNG có nút nào để thoát: em lỡ vào
// nhầm tài khoản, hay chỉ muốn quay ra đọc lại trang giới thiệu, thì cách duy
// nhất là tự gõ lại địa chỉ. Nút này đứng cùng hàng với mấy nút kia ở đầu màn
// hình, mở ra một bảng nhỏ: đang là ai, quay về trang giới thiệu, và đăng xuất.
export default function AccountPill() {
  const { user, isGuest, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Tên thật tự khai đứng trước: đăng ký không bắt buộc khai tên, và khi không
  // khai thì username chính là số điện thoại.
  const name = user?.profile?.fullName || user?.username || user?.phone || "Bạn nhỏ";

  return (
    <>
      <button type="button" className="larry-pill" onClick={() => setOpen((prev) => !prev)}>
        👤 Tài khoản
      </button>

      {open && (
        <div className="larry-pop" role="dialog">
          <h4>{user ? name : "Chưa đăng nhập"}</h4>
          <p>{isGuest ? "Bạn đang dùng chế độ khách." : "Bạn ra vào lúc nào cũng được nhé."}</p>

          <Link className="larry-pop__btn" to="/gioi-thieu" onClick={() => setOpen(false)}>
            📖 Về trang giới thiệu
          </Link>

          {user ? (
            <button type="button" className="larry-pop__btn" onClick={logout}>
              {isGuest ? "🔑 Đăng nhập / Đăng ký" : "👋 Đăng xuất"}
            </button>
          ) : (
            <Link className="larry-pop__btn" to="/login" onClick={() => setOpen(false)}>
              🔑 Đăng nhập
            </Link>
          )}

          <button
            type="button"
            className="larry-pop__btn larry-pop__btn--quiet"
            onClick={() => setOpen(false)}
          >
            Đóng
          </button>
        </div>
      )}
    </>
  );
}
