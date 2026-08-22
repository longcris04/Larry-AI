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
import { isValidPhone, normalizePhone, PHONE_HINT } from "../../utils/phone";
import "../../styles/AuthForms.css";

const Register = () => {
  const { register, error: authError } = useAuth();
  const navigate = useNavigate();

  // Ai đang tạo tài khoản. Chọn ở ngay đầu form vì nó đổi cả bộ câu hỏi phía
  // dưới lẫn việc tài khoản có phải chờ duyệt hay không.
  const [accountRole, setAccountRole] = useState(ROLES.STUDENT);
  const isTeacher = accountRole === ROLES.TEACHER;
  const isCounselor = accountRole === ROLES.COUNSELOR;
  const needsApproval = isTeacher || isCounselor;

  // Số điện thoại là DANH TÍNH của tài khoản: bắt buộc, mỗi số một tài khoản.
  // Email chỉ là kênh liên lạc thêm nên để trống được — học sinh phần lớn chưa
  // có email riêng, bắt khai là dựng thêm một hàng rào trước cửa.
  const [phone, setPhone] = useState("");
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

    // Bắt ở đây để lỗi hiện ngay tại ô đang gõ. Máy chủ vẫn kiểm tra lại và vẫn
    // là nơi quyết định số này đã có ai dùng chưa.
    if (!isValidPhone(phone)) {
      setError(PHONE_HINT);
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

    if (isCounselor && (!fullName.trim() || !email.trim() || !school.trim())) {
      setError("Vui lòng khai đủ họ tên, email, số điện thoại và trường.");
      return;
    }

    setLoading(true);

    // Gửi lên bản đã chuẩn hoá để thứ hiện ở màn hình đăng nhập ngay sau đó
    // giống hệt thứ đã lưu — gõ "0912 345 678" mà bảo đăng nhập bằng
    // "0912345678" thì các em tưởng mình đăng ký hụt.
    const cleanPhone = normalizePhone(phone);

    const result = await register(
      cleanPhone,
      email,
      password,
      {
        fullName,
        // Khối chỉ có ý nghĩa với học sinh
        grade: needsApproval ? "" : grade,
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
        identifier: cleanPhone,
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

        <div className="auth-card__avatar auth-card__avatar--pink">
          <img className="brand-logo" src={`${process.env.PUBLIC_URL}/logo_mark.png`} alt="Larry AI" />
        </div>

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
          ) : isCounselor ? (
            <>
              Tạo tài khoản phòng tâm lý học đường
              <br />
              để theo dõi tình hình trong trường 🧠
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
            aria-checked={accountRole === ROLES.STUDENT}
            className={`role-switch__btn ${accountRole === ROLES.STUDENT ? "role-switch__btn--active" : ""}`}
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
          <button
            type="button"
            role="radio"
            aria-checked={isCounselor}
            className={`role-switch__btn ${isCounselor ? "role-switch__btn--active" : ""}`}
            onClick={() => setAccountRole(ROLES.COUNSELOR)}
          >
            <span className="role-switch__icon" aria-hidden="true">🧠</span>
            Phòng tâm lý học đường
          </button>
        </div>

        {needsApproval && (
          <p className="role-switch__note">
            ℹ️ Tài khoản này cần quản trị viên duyệt trước khi đăng nhập được.
          </p>
        )}

        {(error || authError) && (
          <div className="auth-error">{error || authError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Số điện thoại — DANH TÍNH của tài khoản.
              Không hỏi họ tên ở đây nữa: tên thật hỏi một lần ở ô "Tên" phía
              dưới là đủ, hỏi hai lần thì người dùng không hiểu hai ô khác nhau
              chỗ nào. Cái cần ở trên cùng là thứ dùng để đăng nhập. */}

          <div className="form-group">
            <label htmlFor="phone">Số điện thoại</label>

            <AuthInput
              id="phone"
              type="tel"
              leftIcon="📱"
              placeholder="Ví dụ: 0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <p className="auth-hint">
              Đây là số dùng để đăng nhập. Mỗi số chỉ tạo được một tài khoản.
            </p>
          </div>

          {/* Email — để trống được */}

          <div className="form-group">
            <label htmlFor="email">
              Email{" "}
              {!isCounselor && <span className="auth-optional-tag">không bắt buộc</span>}
            </label>

            <AuthInput
              id="email"
              type="email"
              leftIcon="✉️"
              placeholder={isCounselor ? "Nhập email của phòng tâm lý" : "Nhập email của bạn (nếu có)"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={isCounselor}
            />

            {/* Với thầy cô thì đây không hẳn là tuỳ chọn: email cảnh báo về học
                sinh trong lớp gửi tới chính địa chỉ này. Bỏ trống thì tài khoản
                vẫn tạo được, chỉ là sẽ không nhận được bản sao nào. */}
            {isTeacher && (
              <p className="auth-hint">
                Thầy cô nên khai email: bản sao cảnh báo về học sinh trong lớp sẽ được gửi
                tới địa chỉ này.
              </p>
            )}
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
              ) : isCounselor ? (
                <>
                  Thông tin phòng tâm lý học đường{" "}
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
              <label>{needsApproval ? "Họ và tên đầy đủ" : "Tên"}</label>

              <AuthInput
                id="fullName"
                leftIcon="🙂"
                placeholder={needsApproval ? "Ví dụ: Trần Thị Lan" : "Larry gọi bạn là gì?"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isCounselor}
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
            ) : isCounselor ? null : (
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
              label={isTeacher ? "Bạn dạy ở trường" : isCounselor ? "Trường phụ trách" : "Trường học của bạn là"}
              leftIcon="🏫"
              placeholder="Chọn trường"
              options={[
                ...SCHOOL_OPTIONS,
                { value: OTHER_VALUE, label: "Trường khác..." },
              ]}
              value={schoolChoice}
              onChange={(e) => setSchoolChoice(e.target.value)}
              required={needsApproval}
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
                required={needsApproval}
              />
            )}

            {isTeacher && (
              <p className="auth-hint">
                Larry ghép thầy cô với học sinh dựa trên <strong>trường</strong> và{" "}
                <strong>lớp</strong> — hãy ghi giống hệt cách học sinh khai lớp của các em.
              </p>
            )}
            {isCounselor && (
              <p className="auth-hint">
                Sau khi được duyệt, tài khoản chỉ xem dữ liệu của đúng trường đã khai.
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
              : needsApproval
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
