import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthInput from "./AuthInput";
import AuthSelect from "./AuthSelect";
import GradientButton from "./GradientButton";
import LegalModal from "./LegalModal";
import PlayfulBackground from "./PlayfulBackground";
import { GRADE_OPTIONS, SCHOOL_OPTIONS, OTHER_VALUE } from "../../constants/schoolOptions";
import { ROLES } from "../../constants/roles";
import "../../styles/AuthForms.css";

const Register = () => {
  const { register, error: authError } = useAuth();
  const navigate = useNavigate();

  // Ai đang tạo tài khoản. Chọn ở ngay đầu form vì nó đổi cả bộ câu hỏi phía
  // dưới lẫn việc tài khoản có phải chờ duyệt hay không.
  const [accountRole, setAccountRole] = useState(ROLES.STUDENT);
  const isTeacher = accountRole === ROLES.TEACHER;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Học sinh: không bắt buộc field nào. Giáo viên: trường + lớp chủ nhiệm là bắt buộc.
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
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

    // Backend cũng chặn, nhưng bắt ở đây thì thầy cô biết ngay tại ô đang điền
    // thay vì sau một vòng gọi mạng
    if (isTeacher && (!school.trim() || !className.trim())) {
      setError("Vui lòng cho biết bạn chủ nhiệm lớp nào, trường nào.");
      return;
    }

    setLoading(true);

    const result = await register(
      username,
      email,
      password,
      {
        fullName,
        // Khối chỉ có ý nghĩa với học sinh
        grade: isTeacher ? "" : grade,
        school,
        className,
        dateOfBirth
      },
      accountRole
    );

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Không vào thẳng giao diện bên trong — quay về màn hình đăng nhập để tự
    // đăng nhập. `replace` để nút back không quay lại form đã submit.
    //
    // Giáo viên còn phải chờ duyệt, nên báo đúng chuyện đó thay vì mời đăng nhập
    // ngay (đăng nhập lúc này chắc chắn bị chặn).
    navigate("/login", {
      replace: true,
      state: {
        justRegistered: true,
        email,
        pendingApproval: result.pendingApproval,
        message: result.message
      }
    });
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
          {isTeacher ? (
            <>
              Tạo tài khoản giáo viên chủ nhiệm
              <br />
              để theo dõi tình hình lớp mình 🍎
            </>
          ) : (
            <>
              Tạo tài khoản mới để bắt đầu
              <br />
              hành trình cùng AI Larry ❤️
            </>
          )}
        </p>

        {/* Chọn NGAY ĐẦU form, trước khi điền gì: nó đổi cả bộ câu hỏi phía dưới
            lẫn việc tài khoản có phải chờ quản trị viên duyệt hay không. */}
        <div className="role-switch" role="radiogroup" aria-label="Bạn tạo tài khoản với vai trò nào">
          <button
            type="button"
            role="radio"
            aria-checked={!isTeacher}
            className={`role-switch__btn ${!isTeacher ? "role-switch__btn--active" : ""}`}
            onClick={() => setAccountRole(ROLES.STUDENT)}
          >
            <span className="role-switch__icon" aria-hidden="true">🎒</span>
            Học sinh
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isTeacher}
            className={`role-switch__btn ${isTeacher ? "role-switch__btn--active" : ""}`}
            onClick={() => setAccountRole(ROLES.TEACHER)}
          >
            <span className="role-switch__icon" aria-hidden="true">🍎</span>
            Giáo viên chủ nhiệm
          </button>
        </div>

        {isTeacher && (
          <p className="role-switch__note">
            ℹ️ Tài khoản giáo viên chủ nhiệm cần quản trị viên duyệt trước khi đăng nhập được.
          </p>
        )}

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

          {/* Phần thông tin khác hẳn nhau giữa hai vai trò.
              Học sinh: mọi ô đều không bắt buộc — hỏi nhiều quá là em bỏ ngang.
              Giáo viên: trường + lớp chủ nhiệm BẮT BUỘC, vì đó chính là thứ dùng
              để ghép thầy cô với học sinh của mình. */}

          <div className="auth-optional-block">
            <p className="auth-optional-title">
              {isTeacher ? (
                <>
                  Thông tin giáo viên chủ nhiệm{" "}
                  <span className="auth-optional-tag auth-optional-tag--required">bắt buộc</span>
                </>
              ) : (
                <>
                  Kể thêm cho Larry nghe về bạn nhé{" "}
                  <span className="auth-optional-tag">không bắt buộc</span>
                </>
              )}
            </p>

            <div className="form-group">
              <label>{isTeacher ? "Họ và tên đầy đủ" : "Tên"}</label>

              <AuthInput
                id="fullName"
                leftIcon="🙂"
                placeholder={isTeacher ? "Ví dụ: Trần Thị Lan" : "Larry gọi bạn là gì?"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {isTeacher ? (
              <>
                <div className="form-group">
                  <label>Ngày sinh</label>

                  <AuthInput
                    id="dateOfBirth"
                    type="date"
                    leftIcon="🎂"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>

                <AuthInput
                  id="className"
                  label="Bạn chủ nhiệm lớp"
                  leftIcon="📚"
                  placeholder="Ví dụ: 6A1"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                />
              </>
            ) : (
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
            )}

            <AuthSelect
              id="school"
              label={isTeacher ? "Bạn dạy ở trường" : "Trường học của bạn là"}
              leftIcon="🏫"
              placeholder="Chọn trường"
              options={[
                ...SCHOOL_OPTIONS,
                { value: OTHER_VALUE, label: "Trường khác..." },
              ]}
              value={schoolChoice}
              onChange={(e) => setSchoolChoice(e.target.value)}
              required={isTeacher}
            />

            {/* Chỉ hiện ô tự nhập khi chọn "Trường khác" */}
            {schoolChoice === OTHER_VALUE && (
              <AuthInput
                id="schoolOther"
                label="Tên trường"
                leftIcon="✏️"
                placeholder="Ví dụ: THCS Nguyễn Du"
                value={schoolOther}
                onChange={(e) => setSchoolOther(e.target.value)}
                required={isTeacher}
              />
            )}

            {isTeacher && (
              <p className="auth-hint">
                Larry ghép thầy cô với học sinh dựa trên <strong>trường</strong> và{" "}
                <strong>lớp</strong> — hãy ghi giống hệt cách học sinh khai lớp của các em.
              </p>
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
            {loading
              ? "Đang đăng ký..."
              : isTeacher
                ? "Gửi yêu cầu tạo tài khoản"
                : "Đăng ký"}
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
