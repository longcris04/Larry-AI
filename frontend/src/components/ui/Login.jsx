import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaMobileAlt, FaLock, FaEye, FaEyeSlash, FaUserShield } from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import AuthInput from "./AuthInput";
import GradientButton from "./GradientButton";
import PlayfulBackground from "./PlayfulBackground";
import SpeakerToggle from "./SpeakerToggle";
import { usePublicSettings } from "../../hooks/usePublicSettings";
import { ROLES } from "../../constants/roles";
import { PASSWORD_RESET_EMAIL } from "../../constants/systemMessages";
import "../../styles/AuthForms.css";

export default function Login() {
  const { login, loginAsGuest } = useAuth();

  // Một lần hỏi máy chủ, hai câu trả lời:
  //   guestMode  — tắt thì cả khối "hoặc → Trò chuyện ngay" biến mất
  //   voice.tts  — máy chủ chưa khai TTS_MODEL thì không vẽ nút loa
  const { guestMode, voice, loading: settingsLoading } = usePublicSettings();

  // Vừa đăng ký xong thì Register.jsx điều hướng về đây, kèm sẵn số điện thoại
  const { state } = useLocation();
  const justRegistered = !!state?.justRegistered;
  // Giáo viên vừa đăng ký: chưa đăng nhập được cho tới khi quản trị viên duyệt,
  // nên lời chúc mừng phải nói đúng chuyện đó thay vì mời đăng nhập ngay.
  const pendingApproval = !!state?.pendingApproval;

  // Số điện thoại HOẶC email. Tài khoản mới định danh bằng số điện thoại, nhưng
  // tài khoản tạo trước khi đổi chỉ có email — nhận cả hai để không ai bị bỏ lại
  // bên ngoài sau một lần deploy.
  const [identifier, setIdentifier] = useState(state?.identifier || state?.email || "");

  const [password, setPassword] = useState("");

  // "Bạn là" — học sinh, giáo viên chủ nhiệm, hay quản trị viên.
  // Cùng một email không dùng được cho hai vai trò (backend chặn từ lúc đăng ký),
  // nhưng vẫn phải chọn đúng ở đây vì tài khoản cũ có thể còn trùng email.
  const [role, setRole] = useState(ROLES.STUDENT);

  const [remember, setRemember] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [guestLoading, setGuestLoading] = useState(false);

  const [error, setError] = useState("");

  // Bấm "Quên mật khẩu?" thì hiện ra một dòng nhỏ chỉ chỗ xin cấp lại mật khẩu.
  // Chưa có luồng tự đặt lại: học sinh đăng ký bằng SỐ ĐIỆN THOẠI và phần lớn để
  // trống ô email, nên gửi link đặt lại qua email là gửi vào chỗ không có ai.
  const [showResetHint, setShowResetHint] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    setError("");

    const result = await login(identifier, password, role);

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
          <div className="auth-card__avatar">
            <img className="brand-logo" src={`${process.env.PUBLIC_URL}/logo_mark.png`} alt="Larry AI" />
          </div>
          {/* Title */}

          <h1 className="auth-title">Đăng nhập</h1>

          <p className="auth-subtitle">
            Đăng nhập để bắt đầu trò chuyện cùng Larry
          </p>

          {/* GIỌNG NÓI CỦA LARRY — chọn trước khi vào chat.
              Đặt ở đây chứ không chỉ để trong khung chat vì hai lý do. Một: mặc
              định là TẮT, nên em nào không thấy nút này sẽ không bao giờ biết
              Larry biết nói. Hai: bật sẵn từ đây thì lời chào đầu tiên đã có
              tiếng — bật khi Larry đang chào thì câu đó đã trôi qua rồi.
              Lựa chọn được nhớ lại, và nút ở đầu khung chat vẫn đổi được. */}
          {!settingsLoading && voice.tts && <SpeakerToggle variant="pill" />}

          {justRegistered && !error && (
            <div className={`auth-success${pendingApproval ? " auth-success--pending" : ""}`}>
              {pendingApproval
                ? state?.message ||
                  "⏳ Đã gửi yêu cầu tạo tài khoản giáo viên chủ nhiệm. Quản trị viên sẽ duyệt trước khi bạn đăng nhập được."
                : "🎉 Tạo tài khoản thành công! Đăng nhập để bắt đầu trò chuyện cùng Larry."}
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* SỐ ĐIỆN THOẠI (hoặc email, cho tài khoản cũ).
                type="text" chứ không phải "tel"/"email": ô này nhận cả hai kiểu,
                đặt type="email" thì trình duyệt chặn ngay số điện thoại đúng. */}

            <div className="form-group">
              <label htmlFor="identifier">Số điện thoại</label>

              <AuthInput
                id="identifier"
                leftIcon={<FaMobileAlt />}
                type="text"
                placeholder="Nhập số điện thoại của bạn"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />

              <p className="auth-hint">
                Tài khoản đăng ký trước đây bằng email thì vẫn đăng nhập bằng email như cũ.
              </p>
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
                  <option value={ROLES.STUDENT}>Người dùng</option>
                  <option value={ROLES.TEACHER}>Giáo viên chủ nhiệm</option>
                  <option value={ROLES.ADMIN}>Quản trị viên</option>
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

              <button
                type="button"
                className="forgot-btn"
                onClick={() => setShowResetHint((v) => !v)}
                aria-expanded={showResetHint}
                aria-controls="reset-hint"
              >
                Quên mật khẩu?
              </button>

              {/* Dòng chỉ dẫn, chỉ hiện sau khi bấm. Nằm BÊN TRONG hàng này chứ
                  không phải sau nó: hàng có margin-bottom 28px, đặt ra ngoài thì
                  dòng chữ trôi xuống sát nút "Đăng nhập" và trông như đang nói về
                  cái nút đó. Nó chiếm trọn chiều ngang nhờ flex-basis 100%. */}
              {showResetHint && (
                <p id="reset-hint" className="auth-hint auth-hint--reset" role="status">
                  hãy gửi email liên hệ tới{" "}
                  {/* Bấm được để mở sẵn ứng dụng thư. Máy không cài ứng dụng thư
                      nào thì nó vẫn là chữ đọc và bôi đen chép lại được như thường. */}
                  <a href={`mailto:${PASSWORD_RESET_EMAIL}`}>{PASSWORD_RESET_EMAIL}</a>{" "}
                  để được cấp lại mật khẩu!
                </p>
              )}
            </div>

            {/* LOGIN */}

            <GradientButton type="submit" loading={loading} fullWidth>
              {loading ? "Đang đăng nhập..." : "Đăng nhập →"}
            </GradientButton>
          </form>

          {/* VÀO CHAT NGAY, KHÔNG CẦN ĐĂNG NHẬP
              Cả khối này do quản trị viên bật/tắt. Tắt thì gỡ luôn cả dấu phân
              cách "hoặc" — để lại một chữ "hoặc" lửng lơ giữa form và dòng "Chưa
              có tài khoản?" trông như trang bị vỡ. */}
          {!settingsLoading && guestMode && (
            <>
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
            </>
          )}

          {/* bottom */}

          <div className="auth-bottom">
            Chưa có tài khoản?
            <Link to="/register">Đăng ký ngay</Link>
          </div>

          {/* Đường về trang giới thiệu — hai trang đứng song song, qua lại tuỳ ý */}
          <div className="auth-bottom auth-bottom--about">
            Chưa biết Larry là ai?
            <Link to="/gioi-thieu">Xem giới thiệu</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
