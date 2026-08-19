import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_GUEST_MODE_URL, API_BASE_URL, SETTINGS_URL } from "../../config/api";
import { ROLES, STATUS, roleLabel, statusLabel } from "../../constants/roles";
import { matchesQuery } from "../../utils/search";
import { dateTimeCell } from "../../utils/xlsx";
import AdminDashboard from "./AdminDashboard";
import AlertEmailModal from "./AlertEmailModal";
import ExportExcelButton from "./ExportExcelButton";
import UsageFrequency from "./UsageFrequency";
import UserSessionsPanel from "./UserSessionsPanel";
import "../../styles/AdminPage.css";

const EMPTY_FORM = {
  username: "",
  phone: "",
  email: "",
  password: "",
  fullName: "",
  grade: "",
  school: "",
  className: "",
};

// Hai tab của khu vực quản trị. Tách ra vì hai câu hỏi khác nhau: "cả trường
// đang thế nào" (tổng quan) và "em này vào đều không" (tần suất). Nhét chung một
// trang thì phải cuộn rất xa mới tới được thứ mình cần.
const TABS = [
  { id: "tong-quan", label: "📊 Tổng quan" },
  { id: "tan-suat", label: "📈 Tần suất sử dụng" }
];

// Số dòng mỗi trang của bảng tài khoản. Mười dòng vừa một màn hình mà không phải
// cuộn — quan trọng vì bấm vào một dòng giờ mở ra bảng chi tiết ngay bên dưới nó,
// và người xem cần thấy được cả dòng lẫn phần vừa mở ra cùng lúc.
const PAGE_SIZE = 10;

// Tên bảng — dùng cho CẢ tiêu đề trên màn hình lẫn tên file tải về, khai một chỗ
// để hai nơi không bao giờ lệch nhau.
const USERS_TABLE = "Tài khoản người dùng";

// Cột của file Excel cho bảng tài khoản.
//
// Nhiều hơn số cột nhìn thấy trên màn hình một chút, và đó là chủ ý: mấy thông
// tin đang nằm dưới dạng phù hiệu nhỏ (🚩 3, ❗, "Chờ duyệt") được tách ra thành
// cột riêng, có giá trị SỐ. Trên màn hình chúng chỉ cần liếc là hiểu; trong
// Excel thì phải lọc và sắp xếp được — đó mới là lý do người ta tải file về.
const USERS_COLUMNS = [
  { header: "Tài khoản", value: (r) => r.username, width: 22 },
  { header: "Họ và tên", value: (r) => r.profile?.fullName || "", width: 26 },
  { header: "Số điện thoại", value: (r) => r.phone || "", width: 16 },
  { header: "Email", value: (r) => r.email || "", width: 28 },
  { header: "Vai trò", value: (r) => roleLabel(r.role), width: 20 },
  // Chỉ giáo viên mới đi qua vòng duyệt — vai trò khác để trống thay vì ghi
  // "Đã duyệt" cho một thứ chưa từng phải duyệt.
  {
    header: "Trạng thái",
    value: (r) => (r.role === ROLES.TEACHER ? statusLabel(r.status) : ""),
    width: 14
  },
  { header: "Trường", value: (r) => r.profile?.school || "", width: 30 },
  { header: "Lớp", value: (r) => r.profile?.className || "", width: 10 },
  { header: "Khối", value: (r) => r.profile?.grade || "", width: 8 },
  { header: "Số phiên", value: (r) => r.sessionCount ?? 0, width: 10 },
  { header: "Phiên có dấu hiệu", value: (r) => r.flaggedCount ?? 0, width: 17 },
  { header: "Phiên khẩn cấp", value: (r) => r.highRiskCount ?? 0, width: 15 },
  { header: "Trò chuyện gần nhất", value: (r) => dateTimeCell(r.lastSessionAt), width: 20 }
];

export default function AdminPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab đang xem. Mặc định là tổng quan — nơi có việc cần làm (giáo viên chờ duyệt).
  const [tab, setTab] = useState(TABS[0].id);

  // --- Bảng tài khoản: tìm kiếm + phân trang ---------------------------------
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Dòng đang mở bảng chi tiết bên dưới: { id, mode: "sessions" | "edit" | "delete" }.
  // Mỗi lúc chỉ MỘT dòng được mở. Cho mở nhiều dòng cùng lúc thì bảng bị xé thành
  // từng mảnh và không còn đọc được theo cột nữa.
  const [expanded, setExpanded] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Phiên đang được soạn email cảnh báo cho giáo viên chủ nhiệm
  const [alertSession, setAlertSession] = useState(null);

  // Chế độ khách. `null` = chưa đọc xong, để nút không nhấp nháy từ Bật sang Tắt
  // ngay trước mắt quản trị viên rồi khiến họ tưởng mình vừa bấm nhầm.
  const [guestMode, setGuestMode] = useState(null);
  const [guestModeSaving, setGuestModeSaving] = useState(false);

  // Nút "Tải lại" ở đầu trang phải làm mới CẢ bảng điều khiển. Bảng đó tự quản
  // khoảng ngày của nó nên trang này không gọi API hộ được — tăng số đếm là cách
  // bảo nó tải lại mà không phải kéo state khoảng ngày lên đây.
  const [refreshKey, setRefreshKey] = useState(0);

  const loadGuestMode = useCallback(async () => {
    try {
      const res = await axios.get(SETTINGS_URL);
      setGuestMode(Boolean(res.data?.guestMode));
    } catch (err) {
      setError("Không đọc được cài đặt chế độ khách.");
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
    loadGuestMode();
  }, [loadUsers, loadGuestMode]);

  // Đang mở đúng bảng đó ở đúng dòng đó thì bấm lần nữa là ĐÓNG lại. Cùng một
  // nút vừa mở vừa đóng, không cần thêm dấu ✕ ở mỗi bảng.
  const isOpen = (id, mode) => expanded?.id === id && expanded.mode === mode;

  const openSessions = async (target) => {
    if (isOpen(target.id, "sessions")) return setExpanded(null);

    setExpanded({ id: target.id, mode: "sessions" });
    setSessions([]);
    setSessionsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/${target.id}/sessions`);
      setSessions(res.data.sessions);
    } catch (err) {
      setError(err.response?.data?.error || "Không tải được lịch sử hội thoại.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const startEdit = (target) => {
    if (isOpen(target.id, "edit")) return setExpanded(null);

    setExpanded({ id: target.id, mode: "edit" });
    setForm({
      username: target.username || "",
      phone: target.phone || "",
      email: target.email || "",
      password: "",
      fullName: target.profile?.fullName || "",
      grade: target.profile?.grade || "",
      school: target.profile?.school || "",
      className: target.profile?.className || "",
    });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    setError("");
    try {
      const body = {
        username: form.username,
        phone: form.phone,
        email: form.email,
        profile: {
          fullName: form.fullName,
          grade: form.grade,
          school: form.school,
          className: form.className,
        },
      };
      if (form.password.trim()) body.password = form.password.trim();

      await axios.patch(`${API_BASE_URL}/api/admin/users/${id}`, body);
      setExpanded(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không lưu được thay đổi.");
    } finally {
      setSaving(false);
    }
  };

  // Duyệt / từ chối một tài khoản giáo viên chủ nhiệm.
  //
  // Tài khoản này đọc được tóm tắt hội thoại của cả một lớp, nên bước duyệt là
  // thật chứ không phải thủ tục — từ chối cũng là một kết quả hợp lệ.
  const setApproval = async (target, status) => {
    if (status === STATUS.REJECTED) {
      const ok = window.confirm(
        `Từ chối tài khoản giáo viên "${target.username}"?\n` +
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
    setDeleting(true);
    setError("");
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${target.id}`);
      setExpanded(null);
      setSessions([]);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Không xoá được tài khoản.");
    } finally {
      setDeleting(false);
    }
  };

  const pendingTeachers = users.filter(
    (u) => u.role === ROLES.TEACHER && u.status === STATUS.PENDING
  );

  // --- Lọc và cắt trang -------------------------------------------------------
  //
  // Dò trên đủ mọi thứ có trong bảng: tên tài khoản, họ tên, trường, lớp, khối,
  // email, số điện thoại. Gõ không dấu vẫn ra — "doan thi diem" tìm thấy "Đoàn
  // Thị Điểm" (xem utils/search.js).
  const filteredUsers = useMemo(
    () =>
      users.filter((u) =>
        matchesQuery(query, [
          u.username,
          u.profile?.fullName,
          u.profile?.school,
          u.profile?.className,
          u.profile?.grade,
          u.email,
          u.phone
        ])
      ),
    [users, query]
  );

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  // Kẹp lại thay vì tin vào `page`: gõ thêm một chữ vào ô tìm kiếm có thể làm danh
  // sách ngắn đi đột ngột, và lúc đó trang thứ 5 không còn tồn tại nữa — không kẹp
  // thì bảng hiện ra trống trơn trong khi vẫn còn kết quả.
  const safePage = Math.min(page, pageCount - 1);
  const pageUsers = filteredUsers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Đổi từ khoá tìm kiếm thì quay về trang đầu — kết quả mới không liên quan gì
  // tới việc mình đang đứng ở trang mấy của kết quả cũ.
  useEffect(() => {
    setPage(0);
  }, [query]);

  // Dòng đang mở bảng chi tiết mà trôi khỏi trang đang xem (do lọc hay chuyển
  // trang) thì đóng lại: để mở thì nó sẽ bật ra ở một dòng khác của trang mới.
  useEffect(() => {
    if (expanded && !pageUsers.some((u) => u.id === expanded.id)) setExpanded(null);
    // pageUsers dựng lại mỗi lần render nên chỉ nghe theo hai thứ thật sự đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, safePage, users]);

  // Tài khoản của bảng chi tiết đang mở — AlertEmailModal cần tên em đó
  const openUser = users.find((u) => u.id === expanded?.id) || null;

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
              // Tải lại cả công tắc: có thể quản trị viên khác vừa đổi ở máy họ
              loadGuestMode();
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
      {pendingTeachers.length > 0 && (
        <section className="admin-panel admin-panel--pending">
          <h2 className="admin-panel__title">
            ⏳ Chờ duyệt: {pendingTeachers.length} tài khoản giáo viên chủ nhiệm
          </h2>

          <p className="admin-note">
            Tài khoản giáo viên chủ nhiệm đọc được tóm tắt hội thoại của cả lớp. Hãy xác nhận
            đúng người, đúng lớp trước khi duyệt. Học sinh đăng ký thì không cần bước này.
          </p>

          <ul className="admin-pending">
            {pendingTeachers.map((row) => (
              <li key={row.id} className="admin-pending__item">
                <div className="admin-pending__info">
                  <strong>{row.profile?.fullName || row.username}</strong>
                  {/* Số điện thoại trước — email có thể trống, và số mới là thứ
                      gọi được để xác minh đúng người trước khi duyệt */}
                  <span className="admin-muted"> · {row.phone || row.email || "chưa có liên hệ"}</span>
                  <div className="admin-muted">
                    Chủ nhiệm: {row.teacherInfo?.classLabel || "chưa khai lớp"}
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

      <section className="admin-panel">
        <h2 className="admin-panel__title">
          {USERS_TABLE}
          {/* File tải về mang đúng tên bảng, và chứa ĐÚNG những dòng đang lọc ra —
              tìm "6A1" rồi bấm tải thì được danh sách lớp 6A1, không phải cả trường. */}
          <ExportExcelButton
            name={USERS_TABLE}
            columns={USERS_COLUMNS}
            rows={filteredUsers}
            className="admin-btn admin-btn--sm admin-btn--ghost admin-export-btn"
          />
        </h2>

        <p className="admin-note">
          Vai trò không sửa được từ đây. Tài khoản quản trị chỉ được tạo bằng lệnh{" "}
          <code>npm run create-admin</code> chạy trên máy chủ. Với giáo viên chủ nhiệm, cột{" "}
          <strong>Lớp</strong> là lớp họ chủ nhiệm — Larry ghép thầy cô với học sinh dựa trên
          trường và lớp khớp nhau.
        </p>

        {/* Ô tìm kiếm dò trên MỌI cột của bảng cùng lúc, và gõ không dấu vẫn ra.
            Một trường cấp 2 có hàng trăm tài khoản; bắt nhớ chính xác cách gõ hoa
            thường và dấu của tên trường thì ô này gần như vô dụng. */}
        <div className="admin-toolbar">
          <label className="admin-search">
            <span className="admin-search__icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, trường, lớp, khối, email hay số điện thoại…"
              aria-label="Tìm tài khoản"
            />
            {query && (
              <button
                type="button"
                className="admin-search__clear"
                onClick={() => setQuery("")}
                aria-label="Xoá từ khoá tìm kiếm"
              >
                ✕
              </button>
            )}
          </label>

          <span className="admin-toolbar__count">
            {query.trim()
              ? `${filteredUsers.length} / ${users.length} tài khoản khớp`
              : `${users.length} tài khoản`}
          </span>
        </div>

        {loading ? (
          <p className="admin-empty">Đang tải...</p>
        ) : users.length === 0 ? (
          <p className="admin-empty">Chưa có tài khoản nào.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="admin-empty">
            Không có tài khoản nào khớp với “{query}”. Thử bớt từ khoá đi xem sao.
          </p>
        ) : (
          <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--users">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  {/* Số điện thoại đứng trước email: đó mới là danh tính của tài
                      khoản. Email giờ không bắt buộc nên nhiều dòng sẽ trống. */}
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trường</th>
                  <th>Lớp</th>
                  <th>Khối</th>
                  <th>Phiên</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr className={expanded?.id === row.id ? "admin-row--open" : ""}>
                      <td>
                        <strong>{row.username}</strong>
                        {row.id === user?.id && <span className="admin-self"> (bạn)</span>}
                        {row.profile?.fullName && (
                          <div className="admin-muted">{row.profile.fullName}</div>
                        )}
                      </td>
                      <td className="admin-muted">{row.phone || "—"}</td>
                      <td className="admin-muted">{row.email || "—"}</td>
                      <td>
                        <span className={`admin-tag admin-tag--${row.role}`}>
                          {roleLabel(row.role)}
                        </span>

                        {/* Chỉ giáo viên mới đi qua vòng duyệt — hiện trạng thái
                            ngay cạnh vai trò để biết tài khoản đã dùng được chưa */}
                        {row.role === ROLES.TEACHER && row.status !== STATUS.APPROVED && (
                          <div className={`admin-status admin-status--${row.status}`}>
                            {statusLabel(row.status)}
                          </div>
                        )}
                      </td>
                      <td className="admin-muted">{row.profile?.school || "—"}</td>
                      <td className="admin-muted">{row.profile?.className || "—"}</td>
                      <td className="admin-muted">{row.profile?.grade || "—"}</td>
                      <td>
                        {row.sessionCount}
                        {row.flaggedCount > 0 && (
                          <span
                            className={`admin-flag${
                              row.highRiskCount > 0 ? " admin-flag--high" : ""
                            }`}
                            title={
                              row.highRiskCount > 0
                                ? `${row.flaggedCount} phiên có dấu hiệu tiêu cực, trong đó ${row.highRiskCount} phiên khẩn cấp`
                                : `${row.flaggedCount} phiên có dấu hiệu tiêu cực cần xem lại`
                            }
                          >
                            🚩 {row.flaggedCount}
                            {row.highRiskCount > 0 && " ❗"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="admin-actions">
                          {/* Quản trị viên và giáo viên không trò chuyện với Larry
                              nên không có hội thoại nào để xem */}
                          {row.role === ROLES.STUDENT && (
                            <button
                              type="button"
                              className={`admin-btn admin-btn--sm${
                                isOpen(row.id, "sessions") ? " admin-btn--primary" : ""
                              }`}
                              aria-expanded={isOpen(row.id, "sessions")}
                              onClick={() => openSessions(row)}
                            >
                              Hội thoại
                            </button>
                          )}

                          {/* Duyệt lại được cả tài khoản đã từ chối trước đó */}
                          {row.role === ROLES.TEACHER && row.status !== STATUS.APPROVED && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--primary"
                              onClick={() => setApproval(row, STATUS.APPROVED)}
                            >
                              Duyệt
                            </button>
                          )}
                          {row.role === ROLES.TEACHER && row.status === STATUS.APPROVED && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--ghost"
                              onClick={() => setApproval(row, STATUS.REJECTED)}
                            >
                              Gỡ duyệt
                            </button>
                          )}
                          <button
                            type="button"
                            className={`admin-btn admin-btn--sm${
                              isOpen(row.id, "edit") ? " admin-btn--primary" : " admin-btn--ghost"
                            }`}
                            aria-expanded={isOpen(row.id, "edit")}
                            onClick={() => startEdit(row)}
                          >
                            Sửa
                          </button>
                          {/* Không cho tự xoá tài khoản đang đăng nhập */}
                          {row.id !== user?.id && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger"
                              aria-expanded={isOpen(row.id, "delete")}
                              onClick={() =>
                                setExpanded(
                                  isOpen(row.id, "delete") ? null : { id: row.id, mode: "delete" }
                                )
                              }
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* BẢNG CHI TIẾT, mở ra ngay dưới đúng dòng vừa bấm.
                        Trước đây phần hội thoại nằm ở cuối trang: bấm xong phải
                        cuộn qua cả bảng mới thấy, mà tới nơi thì không còn nhìn
                        thấy mình vừa bấm vào ai. */}
                    {expanded?.id === row.id && (
                      <tr className="admin-row-panel">
                        <td colSpan={9}>
                          <div className={`admin-drawer admin-drawer--${expanded.mode}`}>
                            {expanded.mode === "sessions" && (
                              <>
                                <div className="admin-drawer__head">
                                  <h3 className="admin-drawer__title">
                                    Hội thoại của <strong>{row.username}</strong>
                                  </h3>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--ghost"
                                    onClick={() => setExpanded(null)}
                                  >
                                    Đóng
                                  </button>
                                </div>

                                <UserSessionsPanel
                                  sessions={sessions}
                                  loading={sessionsLoading}
                                  onAlert={setAlertSession}
                                />
                              </>
                            )}

                            {expanded.mode === "edit" && (
                              <div className="admin-edit">
                                <div className="admin-drawer__head">
                                  <h3 className="admin-drawer__title">
                                    Sửa tài khoản <strong>{row.username}</strong>
                                  </h3>
                                </div>

                                <div className="admin-edit__grid">
                                  <label>
                                    Tên tài khoản
                                    <input
                                      value={form.username}
                                      onChange={(e) =>
                                        setForm({ ...form, username: e.target.value })
                                      }
                                    />
                                  </label>
                                  {/* Danh tính của tài khoản — đổi số ở đây là đổi
                                      luôn cách người đó đăng nhập. Bỏ trống được,
                                      nhưng chỉ khi tài khoản còn email (backend chặn
                                      nếu trống cả hai, vì lúc đó không ai vào được nữa). */}
                                  <label>
                                    Số điện thoại
                                    <input
                                      value={form.phone}
                                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Email
                                    <input
                                      value={form.email}
                                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Mật khẩu mới
                                    <input
                                      type="password"
                                      placeholder="Để trống nếu không đổi"
                                      value={form.password}
                                      onChange={(e) =>
                                        setForm({ ...form, password: e.target.value })
                                      }
                                    />
                                  </label>
                                  <label>
                                    Tên
                                    <input
                                      value={form.fullName}
                                      onChange={(e) =>
                                        setForm({ ...form, fullName: e.target.value })
                                      }
                                    />
                                  </label>
                                  {/* Cùng thứ tự với cột trong bảng: Trường → Lớp → Khối */}
                                  <label>
                                    Trường
                                    <input
                                      value={form.school}
                                      onChange={(e) => setForm({ ...form, school: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    Lớp
                                    <input
                                      value={form.className}
                                      onChange={(e) =>
                                        setForm({ ...form, className: e.target.value })
                                      }
                                    />
                                  </label>
                                  <label>
                                    Khối
                                    <input
                                      value={form.grade}
                                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                                    />
                                  </label>
                                </div>

                                <div className="admin-edit__actions">
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--primary"
                                    disabled={saving}
                                    onClick={() => saveEdit(row.id)}
                                  >
                                    {saving ? "Đang lưu..." : "Lưu"}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--ghost"
                                    onClick={() => setExpanded(null)}
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              </div>
                            )}

                            {expanded.mode === "delete" && (
                              <div className="admin-confirm">
                                <p className="admin-confirm__text">
                                  Xoá tài khoản <strong>{row.username}</strong>
                                  {row.profile?.fullName && ` (${row.profile.fullName})`}?
                                  <br />
                                  Toàn bộ <strong>{row.sessionCount} phiên hội thoại</strong> của
                                  tài khoản này cũng bị xoá và{" "}
                                  <strong>không khôi phục được</strong>.
                                </p>

                                <div className="admin-confirm__actions">
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--danger"
                                    disabled={deleting}
                                    onClick={() => removeUser(row)}
                                  >
                                    {deleting ? "Đang xoá..." : "Xoá thật"}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--sm admin-btn--ghost"
                                    onClick={() => setExpanded(null)}
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phân trang. Chỉ hiện khi có nhiều hơn một trang — một mũi tên xám
              không bấm được ở dưới bảng 3 dòng chỉ làm người ta phân vân. */}
          {pageCount > 1 && (
            <div className="admin-pager">
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                aria-label="Trước — 10 tài khoản trước đó"
              >
                ← Trước
              </button>

              <span className="admin-pager__info">
                Trang <strong>{safePage + 1}</strong> / {pageCount}
                <span className="admin-muted">
                  {" "}
                  · đang xem {safePage * PAGE_SIZE + 1}–
                  {Math.min((safePage + 1) * PAGE_SIZE, filteredUsers.length)} trong{" "}
                  {filteredUsers.length}
                </span>
              </span>

              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--ghost"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                aria-label="Sau — 10 tài khoản tiếp theo"
              >
                Sau →
              </button>
            </div>
          )}
          </>
        )}
      </section>
      </div>
      )}

      {alertSession && (
        <AlertEmailModal
          session={alertSession}
          studentName={openUser?.profile?.fullName || openUser?.username || "Học sinh"}
          onClose={() => setAlertSession(null)}
          onSent={(alert) => {
            // Ghi lại ngay vào danh sách đang hiển thị, không cần tải lại cả trang
            setSessions((prev) =>
              prev.map((s) =>
                s.id === alertSession.id ? { ...s, alerts: [...(s.alerts || []), alert] } : s
              )
            );
          }}
        />
      )}
    </div>
  );
}
