import React from "react";
import UserMenu from "./UserMenu";
import "../../styles/Header.css";

export default function Header({ children }) {
  return (
    <div className="panel-header">
      <div className="panel-header__left">{children}</div>
      <UserMenu />
    </div>
  );
}
