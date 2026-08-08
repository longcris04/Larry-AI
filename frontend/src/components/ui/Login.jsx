import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaUserShield } from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import AuthInput from "./AuthInput";
import GradientButton from "./GradientButton";
import PlayfulBackground from "./PlayfulBackground";
import "../../styles/AuthForms.css";

export default function Login() {
  const { login, loginAsGuest } = useAuth();

  // Vừa đăng ký xong thì Register.jsx điều hướng về đây, kèm sẵn email
  const { state } = useLocation();
  const justRegistered = !!state?.justRegistered;

  const [email, setEmail] = useState(state?.email || "");

  const [password, setPassword] = useState("");

  // "Bạn là" — người dùng hay quản trị viên
  const [role, setRole] = useState("user");

  const [remember, setRemember] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [guestLoading, setGuestLoading] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    setError("");

    const result = await login(email, password, role);

    if (!result.success) {
      setError(result.error);
    }

    setLoading(false);
  };

  // Vào thẳng màn hình chat, bỏ qua đăng nhập
  const handleGuest = async () => {
    setGuestLoading(true);

    setError("");

    const result = await loginAsGuest();

    if (!result.success) {
      setError(result.error);
    }

    setGuestLoading(false);
  };

  return (
    <div className="auth-page">
      <PlayfulBackground />

      <div className="auth-wrapper">
        <div className="auth-card">
          {/* Avatar */}
          <div className="auth-card__avatar">🤖</div>
          {/* Title */}

          <h1 className="auth-title">Đăng nhập</h1>

          <p className="auth-subtitle">
            Đăng nhập để bắt đầu trò chuyện cùng Larry
          </p>

          {justRegistered && !error && (
            <div className="auth-success">
              🎉 Tạo tài khoản thành công! Đăng nhập để bắt đầu trò chuyện cùng Larry.
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* EMAIL */}

            <div className="form-group">
              <label>Email</label>

              <AuthInput
                id="email"
                leftIcon={<FaEnvelope />}
                type="email"
                placeholder="Nhập email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* PASSWORD */}

            <div className="form-group">
              <label>Mật khẩu</label>

              <AuthInput
                id="password"
                leftIcon={<FaLock />}
                rightIcon={showPassword ? <FaEyeSlash /> : <FaEye />}
                onRightIconClick={() => setShowPassword(!showPassword)}
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* BẠN LÀ — chọn vai trò đăng nhập */}

            <div className="form-group">
              <label htmlFor="role">Bạn là</label>

              <div className="form-field-icon">
                <span className="form-field-icon__left" aria-hidden="true">
                  <FaUserShield />
                </span>

                <select
                  id="role"
                  className="auth-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="user">Người dùng</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
            </div>

            {/* remember */}

            <div className="auth-remember-row">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={() => setRemember(!remember)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>

              <button type="button" className="forgot-btn">
                Quên mật khẩu?
              </button>
            </div>

            {/* LOGIN */}

            <GradientButton type="submit" loading={loading} fullWidth>
              {loading ? "Đang đăng nhập..." : "Đăng nhập →"}
            </GradientButton>
          </form>

          {/* VÀO CHAT NGAY, KHÔNG CẦN ĐĂNG NHẬP */}

          <div className="auth-divider">
            <span>hoặc</span>
          </div>

          <GradientButton
            variant="success"
            loading={guestLoading}
            disabled={loading}
            onClick={handleGuest}
            fullWidth
          >
            {guestLoading ? "Đang mở phòng chat..." : "Trò chuyện với Larry ngay! 💬"}
          </GradientButton>

          <p className="auth-guest-hint">
            Không cần đăng ký — vào nói chuyện với Larry luôn.
          </p>

          {/* bottom */}

          <div className="auth-bottom">
            Chưa có tài khoản?
            <Link to="/register">Đăng ký ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
