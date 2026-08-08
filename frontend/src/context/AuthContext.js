import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

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

  // profile: { fullName, grade, school, className } — tất cả đều không bắt buộc.
  // Đăng ký xong KHÔNG tự đăng nhập: backend không cấp token, người dùng được
  // đưa về màn hình đăng nhập để tự đăng nhập (xem Register.jsx).
  const register = async (username, email, password, profile = {}) => {
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/api/register`, {
        username,
        email,
        password,
        profile
      });

      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Registration failed";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // role: "user" | "admin" — lấy từ dropdown "Bạn là" ở trang đăng nhập
  const login = async (email, password, role = "user") => {
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        email,
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
    isAdmin: user?.role === "admin"
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