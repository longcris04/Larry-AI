import React from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/UserMenu.css";

export default function UserMenu() {
  const { user, isGuest, logout } = useAuth();

  if (!user) return null;

  const name = user.username || user.email || "Bạn nhỏ";
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

      <button type="button" className="user-menu__logout" onClick={logout}>
        {isGuest ? "Đăng nhập / Đăng ký" : "Đăng xuất"}
      </button>
    </div>
  );
}
