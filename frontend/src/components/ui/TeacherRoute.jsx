import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Chỉ cho tài khoản giáo viên chủ nhiệm đi qua.
 *
 * Đây là hàng rào của GIAO DIỆN, không phải của dữ liệu: mọi route
 * /api/teacher/* ở backend đều tự kiểm tra vai trò và trạng thái duyệt lần nữa
 * (xem requireTeacher trong backend/auth.js). Chặn ở đây chỉ để người vào nhầm
 * thấy đúng trang của mình thay vì một trang trống báo lỗi.
 */
const TeacherRoute = ({ children }) => {
  const { isAuthenticated, isTeacher, isAdmin, isCounselor, loading } = useAuth();
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

  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isCounselor) return <Navigate to="/counselor" replace />;
  if (!isTeacher) return <Navigate to="/" replace />;

  return children;
};

export default TeacherRoute;
