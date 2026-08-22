import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, isTeacher, isCounselor, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Quản trị viên không tham gia trò chuyện — đưa thẳng về khu vực quản trị
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Giáo viên chủ nhiệm cũng vậy: vào đây để nắm tình hình lớp, không phải để
  // trò chuyện với Larry (backend cũng chặn ở blockAdmin trong auth.js)
  if (isTeacher) {
    return <Navigate to="/teacher" replace />;
  }

  if (isCounselor) {
    return <Navigate to="/counselor" replace />;
  }

  return children;
};

export default ProtectedRoute;
