import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function CounselorRoute({ children }) {
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
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isTeacher) return <Navigate to="/teacher" replace />;
  if (!isCounselor) return <Navigate to="/" replace />;

  return children;
}
