import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/UserMenu.css";

export default function UserMenu() {
  const { user, isGuest, logout } = useAuth();

  if (!user) return null;

  // Tên thật tự khai đứng trước: đăng ký không bắt buộc khai tên, và khi không
  // khai thì username chính là số điện thoại — thấy dãy số của mình ở góc màn
  // hình thì chẳng khác gì chưa đăng nhập.
  const name = user.profile?.fullName || user.username || user.phone || user.email || "Bạn nhỏ";
  const initials = isGuest ? "👋" : name.slice(0, 2).toUpperCase();

  return (
    <div className="user-menu">
      <div className="user-menu__top">
        <div className="user-menu__avatar">
          <span>{initials}</span>
        </div>
        <div className="user-menu__text">
          <span className="user-menu__label">
            {isGuest ? "Chế độ khách" : "Đã đăng nhập"}
          </span>
          <span className="user-menu__name">{name}</span>
        </div>
      </div>

      {/* Hai lối ra, đứng cạnh nhau: một để đi xem lại giới thiệu rồi quay vào,
          một để rời hẳn. Thiếu cái thứ nhất thì muốn xem lại trang giới thiệu
          phải đăng xuất — cái giá quá đắt cho một việc vô hại. */}
      <Link className="user-menu__about" to="/gioi-thieu">
        📖 Trang giới thiệu
      </Link>

      <button type="button" className="user-menu__logout" onClick={logout}>
        {isGuest ? "Đăng nhập / Đăng ký" : "Đăng xuất"}
      </button>
    </div>
  );
}
