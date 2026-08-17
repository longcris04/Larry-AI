import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { ROLES } from "../constants/roles";

const AuthContext = createContext();

const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete axios.defaults.headers.common.Authorization;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        setAuthToken(token);
        try {
          const response = await axios.get(`${API_BASE_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data.user);
        } catch (err) {
          localStorage.removeItem("token");
          setAuthToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // phone: SỐ ĐIỆN THOẠI — danh tính của tài khoản, bắt buộc và không trùng nhau.
  // email: không bắt buộc, để trống được (học sinh phần lớn chưa có email riêng).
  //
  // profile: { fullName, grade, school, className, dateOfBirth }
  //   học sinh          — mọi field đều không bắt buộc
  //   giáo viên chủ nhiệm — school và className BẮT BUỘC (backend chặn nếu thiếu),
  //                         vì đó chính là thứ dùng để ghép với học sinh
  //
  // role: "user" (mặc định) | "teacher" — do nút chọn ở đầu form quyết định.
  //
  // Đăng ký xong KHÔNG tự đăng nhập: backend không cấp token. Riêng giáo viên còn
  // phải chờ quản trị viên duyệt, nên trả về cả `pendingApproval` để màn hình
  // đăng nhập nói đúng chuyện đang xảy ra.
  const register = async (phone, email, password, profile = {}, role = ROLES.STUDENT) => {
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        phone,
        email,
        password,
        profile,
        role
      });

      return {
        success: true,
        pendingApproval: Boolean(response.data?.pendingApproval),
        message: response.data?.message || ""
      };
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Registration failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // identifier: số điện thoại HOẶC email. Tài khoản mới định danh bằng số điện
  // thoại, nhưng tài khoản tạo trước khi đổi (và quản trị viên dựng từ biến môi
  // trường) chỉ có email — backend tra cả hai đường.
  //
  // role: "user" | "teacher" | "admin" — lấy từ dropdown "Bạn là" ở trang đăng nhập
  const login = async (identifier, password, role = "user") => {
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        identifier,
        password,
        role
      });

      const { user: userData, token } = response.data;
      localStorage.setItem("token", token);
      setAuthToken(token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Login failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Vào chat ngay, không cần tài khoản
  const loginAsGuest = async () => {
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/guest`);

      const { user: userData, token } = response.data;
      localStorage.setItem("token", token);
      setAuthToken(token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Không kết nối được tới Larry. Thử lại nhé!";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/logout`);
    } catch (err) {
      console.error("Logout error:", err);
    }
    localStorage.removeItem("token");
    setAuthToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    loginAsGuest,
    logout,
    isAuthenticated: !!user,
    isGuest: !!user?.guest,
    isAdmin: user?.role === ROLES.ADMIN,
    isTeacher: user?.role === ROLES.TEACHER
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};