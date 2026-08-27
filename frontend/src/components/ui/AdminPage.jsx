import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_GUEST_MODE_URL, ADMIN_TTS_URL, API_BASE_URL, SETTINGS_URL } from "../../config/api";
import { ROLES, STATUS, roleLabel } from "../../constants/roles";
import AccountsPanel from "./AccountsPanel";
import AdminDashboard from "./AdminDashboard";
import UsageFrequency from "./UsageFrequency";
import "../../styles/AdminPage.css";

// Hai tab của khu vực quản trị. Tách ra vì hai câu hỏi khác nhau: "cả trường
// đang thế nào" (tổng quan) và "em này vào đều không" (tần suất). Nhét chung một
// trang thì phải cuộn rất xa mới tới được thứ mình cần.
const TABS = [
  { id: "tong-quan", label: "📊 Tổng quan" },
  { id: "tan-suat", label: "📈 Tần suất sử dụng" }
];


export default function AdminPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab đang xem. Mặc định là tổng quan — nơi có việc cần làm (giáo viên chờ duyệt).
  const [tab, setTab] = useState(TABS[0].id);

  // Chế độ khách. `null` = chưa đọc xong, để nút không nhấp nháy từ Bật sang Tắt
  // ngay trước mắt quản trị viên rồi khiến họ tưởng mình vừa bấm nhầm.
  const [guestMode, setGuestMode] = useState(null);
  const [guestModeSaving, setGuestModeSaving] = useState(false);

  // Giọng đọc của Larry. Cần HAI giá trị chứ không phải một, vì có hai lý do rất
  // khác nhau khiến học sinh không nghe thấy gì:
  //
  //   ttsEnabled    công tắc trên trang này — bấm tắt để tiết kiệm token
  //   ttsEffective  loa có thật sự kêu không, tức công tắc BẬT *và* máy chủ khai
  //                 đủ TTS_MODEL + khoá API (chính là voice.tts máy chủ trả về)
  //
  // Gộp hai thứ vào một ô trạng thái thì bật công tắc lên mà vẫn im tiếng sẽ
  // trông y hệt một cái nút hỏng. Tách ra thì màn hình nói thẳng được là "đã bật
  // nhưng máy chủ chưa cấu hình model" — hai lỗi, hai chỗ sửa khác nhau.
  const [ttsEnabled, setTtsEnabled] = useState(null);
  const [ttsEffective, setTtsEffective] = useState(false);
  const [ttsSaving, setTtsSaving] = useState(false);

  // Nút "Tải lại" ở đầu trang phải làm mới CẢ bảng điều khiển. Bảng đó tự quản
  // khoảng ngày của nó nên trang này không gọi API hộ được — tăng số đếm là cách
  // bảo nó tải lại mà không phải kéo state khoảng ngày lên đây.
  const [refreshKey, setRefreshKey] = useState(0);

  // MỘT lần gọi cho mọi công tắc — /api/settings trả cả gói. Tách thành hai lần
  // gọi thì có lúc một cái xong một cái lỗi, và trang hiện nửa thật nửa cũ.
  const loadSettings = useCallback(async () => {
    try {
      const res = await axios.get(SETTINGS_URL);
      setGuestMode(Boolean(res.data?.guestMode));
      setTtsEnabled(Boolean(res.data?.ttsEnabled));
      setTtsEffective(Boolean(res.data?.voice?.tts));
    } catch (err) {
      setError("Không đọc được cài đặt hệ thống.");
    }
  }, []);

  const toggleGuestMode = async () => {
    const next = !guestMode;

    // Hỏi lại khi TẮT, không hỏi khi bật. Tắt là gỡ mất đường vào của những em
    // chưa có tài khoản — đúng loại hậu quả không nhìn thấy ngay từ trang quản trị.
    if (!next) {
      const ok = window.confirm(
        "Tắt chế độ khách?\n\n" +
          "Nút “Trò chuyện với Larry ngay” sẽ biến mất khỏi trang đăng nhập, và học sinh " +
          "chưa có tài khoản sẽ không vào nói chuyện được nữa — các em phải đăng ký trước.\n\n" +
          "Bạn có thể bật lại bất cứ lúc nào."
      );
      if (!ok) return;
    }

    setGuestModeSaving(true);
    setError("");
    try {
      const res = await axios.patch(ADMIN_GUEST_MODE_URL, { enabled: next });
      setGuestMode(Boolean(res.data?.guestMode));
    } catch (err) {
      setError(err.response?.data?.error || "Không đổi được cài đặt chế độ khách.");
    } finally {
      setGuestModeSaving(false);
    }
  };

  const toggleTts = async () => {
    const next = !ttsEnabled;

    // Hỏi lại khi TẮT, không hỏi khi bật — cùng lối với chế độ khách: bật là trả
    // lại thứ vốn có, tắt mới là gỡ đi một thứ học sinh đang dùng.
    if (!next) {
      const ok = window.confirm(
        "Tắt giọng đọc của Larry?\n\n" +
          "Larry sẽ không đọc câu trả lời thành tiếng nữa, nút loa biến mất khỏi trang " +
          "đăng nhập và khung chat. Đổi lại, hệ thống không tốn token cho model đọc — " +
          "phần trò chuyện bằng chữ và micro của học sinh vẫn chạy bình thường.\n\n" +
          "Bạn có thể bật lại bất cứ lúc nào."
      );
      if (!ok) return;
    }

    setTtsSaving(true);
    setError("");
    try {
      const res = await axios.patch(ADMIN_TTS_URL, { enabled: next });
      setTtsEnabled(Boolean(res.data?.ttsEnabled));
      setTtsEffective(Boolean(res.data?.voice?.tts));
    } catch (err) {
      setError(err.response?.data?.error || "Không đổi được cài đặt giọng đọc.");
    } finally {
      setTtsSaving(false);
    }
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`);
      setUsers(res.data.users);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadSettings();
  }, [loadUsers, loadSettings]);

  // Bảng tài khoản dựng sẵn `body` rồi mới gọi xuống đây. Trả về true/false để
  // bảng biết có đóng ô sửa lại không — lưu hỏng mà vẫn đóng thì những gì vừa gõ
  // biến mất và màn hình trông y như đã lưu xong.
  const saveEdit = async (id, body) => {
    setError("");
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/users/${id}`, body);
      await loadUsers();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Không lưu được thay đổi.");
      return false;
    }
  };

  // Duyệt / từ chối tài khoản có quyền đọc dữ liệu học sinh.
  //
  // Tài khoản này đọc được tóm tắt hội thoại của cả một lớp, nên bước duyệt là
  // thật chứ không phải thủ tục — từ chối cũng là một kết quả hợp lệ.
  const setApproval = async (target, status) => {
    if (status === STATUS.REJECTED) {
      const ok = window.confirm(
        `Từ chối tài khoản ${roleLabel(target.role)} "${target.username}"?\n` +
          "Tài khoản sẽ không đăng nhập được cho tới khi bạn duyệt lại."
      );
      if (!ok) return;
    }

    setError("");
    try {
      await axios.post(`${API_BASE_URL}/api/admin/users/${target.id}/approval`, { status });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không cập nhật được trạng thái duyệt.");
    }
  };

  // Xoá đi qua HAI bước, và bước hỏi lại nằm ngay dưới dòng của tài khoản đó chứ
  // không phải một hộp thoại window.confirm() bật ra giữa màn hình. Hộp thoại đó
  // che mất chính cái dòng đang nói tới, nên người bấm không đối chiếu lại được
  // tên mình vừa chọn — với thao tác không khôi phục được thì đó là chỗ sai.
  const removeUser = async (target) => {
    setError("");
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${target.id}`);
      await loadUsers();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Không xoá được tài khoản.");
      return false;
    }
  };

  const pendingAccounts = users.filter(
    (u) =>
      [ROLES.TEACHER, ROLES.COUNSELOR].includes(u.role) && u.status === STATUS.PENDING
  );

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <h1 className="admin-topbar__title">👑 Khu vực quản trị viên</h1>
          <p className="admin-topbar__subtitle">
            Đang đăng nhập: <strong>{user?.username}</strong>
          </p>
        </div>
        <div className="admin-topbar__actions">
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              loadUsers();
              // Tải lại cả các công tắc: có thể quản trị viên khác vừa đổi ở máy họ
              loadSettings();
              setRefreshKey((n) => n + 1);
            }}
          >
            Tải lại
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {/* Thanh tab. Dòng báo lỗi nằm TRÊN nó, ngoài mọi tab: lỗi tải danh sách tài
          khoản vẫn phải đọc được kể cả khi đang đứng ở tab tần suất. */}
      <nav className="admin-tabs" role="tablist" aria-label="Khu vực quản trị">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            className={`admin-tab${tab === item.id ? " admin-tab--on" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "tan-suat" && (
        <div id="panel-tan-suat" role="tabpanel" aria-labelledby="tab-tan-suat">
          <UsageFrequency users={users} onError={setError} />
        </div>
      )}

      {tab === "tong-quan" && (
      <div id="panel-tong-quan" role="tabpanel" aria-labelledby="tab-tong-quan">

      {/* Việc CẦN LÀM lên đầu trang. Giáo viên đã đăng ký mà chưa được duyệt thì
          không đăng nhập được — để lẫn trong bảng dài phía dưới là rất dễ quên,
          và thầy cô ngồi chờ mà không biết chờ ai. */}
      {pendingAccounts.length > 0 && (
        <section className="admin-panel admin-panel--pending">
          <h2 className="admin-panel__title">
            ⏳ Chờ duyệt: {pendingAccounts.length} tài khoản
          </h2>

          <p className="admin-note">
            Các tài khoản này đọc được dữ liệu hội thoại của học sinh. Hãy xác nhận đúng người,
            đúng trường và lớp trước khi duyệt. Học sinh không cần bước này.
          </p>

          <ul className="admin-pending">
            {pendingAccounts.map((row) => (
              <li key={row.id} className="admin-pending__item">
                <div className="admin-pending__info">
                  <strong>{row.profile?.fullName || row.username}</strong>
                  {/* Số điện thoại trước — email có thể trống, và số mới là thứ
                      gọi được để xác minh đúng người trước khi duyệt */}
                  <span className="admin-muted"> · {row.phone || row.email || "chưa có liên hệ"}</span>
                  <div className="admin-muted">
                    {row.role === ROLES.TEACHER
                      ? `Chủ nhiệm: ${row.teacherInfo?.classLabel || "chưa khai lớp"}`
                      : `Trường: ${row.profile?.school || "chưa khai trường"}`}
                    {row.profile?.dateOfBirth && ` · sinh ${row.profile.dateOfBirth}`}
                    {typeof row.teacherInfo?.studentCount === "number" &&
                      ` · ghép được ${row.teacherInfo.studentCount} học sinh`}
                  </div>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--primary"
                    onClick={() => setApproval(row, STATUS.APPROVED)}
                  >
                    ✅ Duyệt
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => setApproval(row, STATUS.REJECTED)}
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bảng điều khiển. Đặt SAU khối chờ duyệt vì khối đó là việc phải làm
          ngay, còn đây là để nắm tình hình — nhưng trên mọi thứ còn lại, vì nó
          trả lời câu hỏi "hệ thống đang ra sao" mà các bảng dưới chỉ trả lời
          được từng dòng một. Khối chờ duyệt chỉ hiện khi thật sự có người chờ,
          nên phần lớn thời gian đây vẫn là thứ đầu tiên đập vào mắt. */}
      <AdminDashboard onError={setError} refreshKey={refreshKey} />

      {/* Công tắc chế độ khách. Đặt trên bảng tài khoản vì nó tác động tới MỌI
          người vào web, còn bảng dưới là việc của từng tài khoản một. */}
      <section className="admin-panel">
        <h2 className="admin-panel__title">Chế độ khách</h2>

        <p className="admin-note">
          Cho phép trò chuyện với Larry mà không cần đăng nhập — chính là nút{" "}
          <strong>“Trò chuyện với Larry ngay”</strong> ở trang đăng nhập. Tắt đi thì nút biến
          mất, và máy chủ cũng từ chối mọi phiên khách, kể cả khi có người gọi thẳng vào API.
        </p>

        <div className="admin-setting">
          <div className="admin-setting__info">
            <strong>
              {guestMode === null
                ? "Đang đọc cài đặt..."
                : guestMode
                  ? "🟢 Đang BẬT"
                  : "🔴 Đang TẮT"}
            </strong>
            <div className="admin-muted">
              {guestMode === null
                ? "Chờ máy chủ trả lời."
                : guestMode
                  ? "Học sinh chưa có tài khoản vẫn vào nói chuyện với Larry được."
                  : "Chỉ tài khoản đã đăng ký mới trò chuyện được. Phiên khách đang mở vẫn chạy tiếp cho tới khi các em đóng."}
            </div>
          </div>

          <button
            type="button"
            className={`admin-btn ${guestMode ? "admin-btn--danger" : "admin-btn--primary"}`}
            onClick={toggleGuestMode}
            disabled={guestMode === null || guestModeSaving}
          >
            {guestModeSaving
              ? "Đang lưu..."
              : guestMode
                ? "Tắt chế độ khách"
                : "Bật chế độ khách"}
          </button>
        </div>
      </section>

      {/* Công tắc giọng đọc. Đặt cạnh chế độ khách vì cùng loại: hai thứ tác động
          tới MỌI người vào web, không phải việc của từng tài khoản. */}
      <section className="admin-panel">
        <h2 className="admin-panel__title">Giọng đọc của Larry (TTS)</h2>

        <p className="admin-note">
          Larry đọc câu trả lời thành tiếng cho học sinh nghe. Mỗi lượt đọc là một lần gọi
          model đọc và <strong>tính tiền theo số chữ</strong>, nên đây là công tắc tiết kiệm
          token: tắt đi thì nút loa biến mất ở trang đăng nhập lẫn khung chat, và máy chủ từ
          chối mọi yêu cầu đọc — kể cả khi có người gọi thẳng vào API. Phần trò chuyện bằng
          chữ và micro của học sinh <strong>không bị ảnh hưởng</strong>.
        </p>

        <div className="admin-setting">
          <div className="admin-setting__info">
            <strong>
              {ttsEnabled === null
                ? "Đang đọc cài đặt..."
                : ttsEnabled
                  ? "🟢 Đang BẬT"
                  : "🔴 Đang TẮT"}
            </strong>
            <div className="admin-muted">
              {ttsEnabled === null
                ? "Chờ máy chủ trả lời."
                : !ttsEnabled
                  ? "Larry chỉ trả lời bằng chữ. Không tốn token cho model đọc."
                  : ttsEffective
                    ? "Larry đọc câu trả lời thành tiếng khi học sinh bật nút loa."
                    : "⚠️ Đã bật ở đây nhưng máy chủ chưa gọi được model đọc — kiểm tra TTS_MODEL và OPENROUTER_API_KEY trong backend/.env."}
            </div>
          </div>

          <button
            type="button"
            className={`admin-btn ${ttsEnabled ? "admin-btn--danger" : "admin-btn--primary"}`}
            onClick={toggleTts}
            disabled={ttsEnabled === null || ttsSaving}
          >
            {ttsSaving ? "Đang lưu..." : ttsEnabled ? "Tắt giọng đọc" : "Bật giọng đọc"}
          </button>
        </div>
      </section>

      <AccountsPanel
        users={users}
        loading={loading}
        selfId={user?.id}
        sessionsUrl={(id) => `${API_BASE_URL}/api/admin/users/${id}/sessions`}
        onError={setError}
        onSave={saveEdit}
        onDelete={removeUser}
        onApproval={setApproval}
        allowAlerts
        note={
          <p className="admin-note">
            Vai trò không sửa được từ đây. Tài khoản quản trị chỉ được tạo bằng lệnh{" "}
            <code>npm run create-admin</code> chạy trên máy chủ. Với giáo viên chủ nhiệm, cột{" "}
            <strong>Lớp</strong> là lớp họ chủ nhiệm — Larry ghép thầy cô với học sinh dựa trên
            trường và lớp khớp nhau.
          </p>
        }
      />
      </div>
      )}

    </div>
  );
}
