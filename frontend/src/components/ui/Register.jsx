import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthInput from "./AuthInput";
import AuthSelect from "./AuthSelect";
import GradientButton from "./GradientButton";
import LegalModal from "./LegalModal";
import PlayfulBackground from "./PlayfulBackground";
import { GRADE_OPTIONS, SCHOOL_OPTIONS, OTHER_VALUE } from "../../constants/schoolOptions";
import "../../styles/AuthForms.css";

const Register = () => {
  const { register, error: authError } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Thông tin học sinh — tất cả đều không bắt buộc
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  // Trường: chọn trong danh sách, hoặc chọn "Trường khác" rồi tự nhập
  const [schoolChoice, setSchoolChoice] = useState("");
  const [schoolOther, setSchoolOther] = useState("");

  const school = schoolChoice === OTHER_VALUE ? schoolOther : schoolChoice;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [agree, setAgree] = useState(false);
  // Slug của văn bản đang mở: "dieu-khoan" | "chinh-sach-bao-mat" | null
  const [legalDoc, setLegalDoc] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!agree) {
      setError("Bạn cần đồng ý với Điều khoản sử dụng.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);

    const result = await register(username, email, password, {
      fullName,
      grade,
      school,
      className
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Không vào thẳng giao diện chat — quay về màn hình đăng nhập để học sinh
    // tự đăng nhập bằng tài khoản vừa tạo. `replace` để nút back không quay
    // lại form đã submit.
    navigate("/login", { replace: true, state: { justRegistered: true, email } });
  };

  return (
    <div className="auth-container">
      <PlayfulBackground />

      <div className="auth-card">
        {/* Avatar */}

        <div className="auth-card__avatar auth-card__avatar--pink">🤖</div>

        {/* Title */}

        <h1 className="auth-title">
          Larry <span>⭐</span>
        </h1>

        <p className="auth-subtitle">
          Tạo tài khoản mới để bắt đầu
          <br />
          hành trình cùng AI Larry ❤️
        </p>

        {(error || authError) && (
          <div className="auth-error">{error || authError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Name */}

          <div className="form-group">
            <label>Họ và tên</label>

            <AuthInput
              id="username"
              leftIcon="👤"
              placeholder="Nhập họ và tên của bạn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Email */}

          <div className="form-group">
            <label>Email</label>

            <AuthInput
              id="email"
              type="email"
              leftIcon="✉️"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}

          <div className="form-group">
            <label>Mật khẩu</label>

            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              leftIcon="🔒"
              rightIcon={showPassword ? "🙈" : "👁"}
              onRightIconClick={() => setShowPassword(!showPassword)}
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Confirm */}

          <div className="form-group">
            <label>Xác nhận mật khẩu</label>

            <AuthInput
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              leftIcon="🔒"
              rightIcon={showConfirmPassword ? "🙈" : "👁"}
              onRightIconClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
              placeholder="Nhập lại mật khẩu của bạn"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Thông tin học sinh — không bắt buộc */}

          <div className="auth-optional-block">
            <p className="auth-optional-title">
              Kể thêm cho Larry nghe về bạn nhé{" "}
              <span className="auth-optional-tag">không bắt buộc</span>
            </p>

            <div className="form-group">
              <label>Tên</label>

              <AuthInput
                id="fullName"
                leftIcon="🙂"
                placeholder="Larry gọi bạn là gì?"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-row">
              <AuthSelect
                id="grade"
                label="Bạn là học sinh khối"
                leftIcon="🎒"
                placeholder="Chọn khối"
                options={GRADE_OPTIONS.map((value) => ({
                  value,
                  label: `Khối ${value}`,
                }))}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />

              <AuthInput
                id="className"
                label="Lớp của bạn"
                leftIcon="📚"
                placeholder="Ví dụ: 6A1"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>

            <AuthSelect
              id="school"
              label="Trường học của bạn là"
              leftIcon="🏫"
              placeholder="Chọn trường"
              options={[
                ...SCHOOL_OPTIONS,
                { value: OTHER_VALUE, label: "Trường khác..." },
              ]}
              value={schoolChoice}
              onChange={(e) => setSchoolChoice(e.target.value)}
            />

            {/* Chỉ hiện ô tự nhập khi học sinh chọn "Trường khác" */}
            {schoolChoice === OTHER_VALUE && (
              <AuthInput
                id="schoolOther"
                label="Tên trường của bạn"
                leftIcon="✏️"
                placeholder="Ví dụ: THCS Nguyễn Du"
                value={schoolOther}
                onChange={(e) => setSchoolOther(e.target.value)}
              />
            )}
          </div>

          {/* Checkbox */}

          <label className="auth-terms">
            <input
              type="checkbox"
              checked={agree}
              onChange={() => setAgree(!agree)}
            />

            {/* Mở hộp thoại thay vì điều hướng, để không mất những gì đã điền */}
            <span>
              Tôi đồng ý với{" "}
              <button
                type="button"
                className="auth-terms__link"
                onClick={() => setLegalDoc("dieu-khoan")}
              >
                Điều khoản
              </button>{" "}
              và{" "}
              <button
                type="button"
                className="auth-terms__link"
                onClick={() => setLegalDoc("chinh-sach-bao-mat")}
              >
                Chính sách bảo mật
              </button>
            </span>
          </label>

          {/* Register */}

          <GradientButton
            type="submit"
            fullWidth
            variant="pink"
            loading={loading}
            rightIcon="→"
            disabled={!agree}
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </GradientButton>
        </form>

        {/* Footer */}

        <div className="auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </div>
      </div>

      {legalDoc && <LegalModal slug={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
};

export default Register;
