// Bảng "Tài khoản người dùng" — dùng chung cho khu vực quản trị viên và phòng
// tâm lý học đường.
//
// Tách khỏi AdminPage.jsx vì giờ có HAI trang cần ĐÚNG cái bảng này: quản trị
// viên nhìn cả hệ thống, phòng tâm lý nhìn trường mình. Chép sang trang thứ hai
// thì hai bên trôi lệch nhau ngay ở chỗ khó thấy nhất — mấy ô chọn lọc ăn theo
// nhau, cách so bù khi hai dòng bằng điểm, cột nào vào file Excel — và lúc đó
// cùng một thao tác ở hai trang lại ra hai kết quả khác nhau mà không ai biết
// bên nào đúng.
//
// Khác nhau giữa hai trang KHÔNG nằm ở cách xem, chỉ nằm ở việc được làm gì:
// trang nào đưa xuống `onSave` / `onDelete` / `onApproval` thì trang đó có nút
// Sửa / Xoá / Duyệt. Không đưa thì bảng vẫn đủ mọi thứ để đọc — tìm kiếm, bốn ô
// lọc, ba cột xếp được, phân trang, tải Excel, mở lịch sử hội thoại từng em.
// Nút vắng mặt vì KHÔNG CÓ VIỆC ĐỂ LÀM, không phải vì bị ẩn đi: máy chủ vẫn là
// nơi chặn thật (mấy endpoint sửa/xoá đều là adminOnly).

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ROLES, STATUS, roleLabel, statusLabel } from "../../constants/roles";
import { matchesQuery } from "../../utils/search";
import { buildFacets, filterByFacets, hasFilters, noFilters } from "../../utils/facets";
import { dateTimeCell } from "../../utils/xlsx";
import AlertEmailModal from "./AlertEmailModal";
import ExportExcelButton from "./ExportExcelButton";
import FacetSelect from "./FacetSelect";
import SortHeader, { cycleSort } from "./SortHeader";
import TablePager from "./TablePager";
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

// --- Bốn ô chọn lọc của bảng tài khoản ---------------------------------------
//
// Bốn chiều này là bốn cột đầu của bảng, và đều là tập ĐÓNG lấy thẳng từ dữ liệu:
// vai trò nào đang có, trường nào đã có tài khoản, lớp nào đã tồn tại. Mở ô chọn
// ra là thấy hết những gì có thật, kèm số lượng — không phải gõ thử rồi kết luận
// nhầm là "trường đó chưa có trong hệ thống".
//
// Bốn ô ĂN THEO NHAU và ăn theo cả ô tìm kiếm (xem utils/facets.js), y hệt bảng
// lớp của bảng điều khiển — hai bảng lọc theo cùng mấy chiều thì phải cư xử
// giống nhau, nếu không thì cùng một thao tác ở hai chỗ lại ra hai kết quả khác
// nhau và không ai biết chỗ nào đúng.
//
// Vai trò cũng là MỘT ô chọn như ba chiều kia, không phải hàng nút riêng: bốn ô
// đứng cạnh nhau thì nhìn là biết bảng đang bị lọc theo những gì, và lọc theo
// trường xong thì ô Vai trò chỉ còn những vai trò thật sự có ở trường đó.
const USER_FACETS = [
  {
    id: "role",
    label: "Vai trò",
    all: "Tất cả vai trò",
    empty: "— Chưa rõ —",
    of: (u) => u.role,
    // Trong dữ liệu vai trò là "user"/"teacher"/"admin", trên màn hình phải đọc
    // ra tiếng Việt — nhưng giá trị lọc vẫn là mã, để không phụ thuộc vào chữ.
    format: (code) => roleLabel(code),
    // Thứ tự cố định, không theo bảng chữ cái: xếp theo mã thì "admin" lên đầu và
    // nhóm đông nhất (học sinh) tụt xuống cuối.
    values: [ROLES.STUDENT, ROLES.TEACHER, ROLES.COUNSELOR, ROLES.ADMIN]
  },
  {
    id: "school",
    label: "Trường",
    all: "Tất cả trường",
    empty: "— Chưa khai trường —",
    of: (u) => u.profile?.school
  },
  {
    id: "className",
    label: "Lớp",
    all: "Tất cả lớp",
    empty: "— Chưa khai lớp —",
    of: (u) => u.profile?.className
  },
  {
    id: "grade",
    label: "Khối",
    all: "Tất cả khối",
    empty: "— Chưa khai khối —",
    of: (u) => u.profile?.grade
  }
];

const NO_USER_FILTERS = noFilters(USER_FACETS);

// --- Sắp xếp bảng tài khoản ---------------------------------------------------
//
// Ba cột số của bảng, bấm thẳng vào TIÊU ĐỀ CỘT (xem SortHeader.jsx — ba trạng
// thái ↕ ↓ ↑, dùng chung với bảng trường của bảng điều khiển).
//
// Trước đây ba con số này gộp chung vào một cột "Phiên" nên phải có một hàng nút
// sắp xếp riêng: bấm vào tiêu đề của một cột gộp thì không nói được là đang xếp
// theo con số nào trong đó. Tách ra ba cột thì tiêu đề cột tự nói đủ nghĩa, và
// hàng nút kia thành thừa.
//
// Chỉ MỘT cột bật được cùng lúc: cả ba đều xếp lại đúng một bảng, nên "vừa theo
// số hội thoại vừa theo số phiên gắn cờ" là câu không có nghĩa.
const SORTS = [
  {
    id: "sessionCount",
    label: "Hội thoại",
    // Bằng số hội thoại thì em nào nhiều dấu hiệu hơn lên trước: hai dòng cùng 12
    // phiên mà một em có 5 phiên bị gắn cờ thì đó mới là dòng cần nhìn.
    tiebreak: (a, b) => (b.flaggedCount || 0) - (a.flaggedCount || 0)
  },
  {
    id: "flaggedCount",
    label: "Bị gắn cờ",
    // Bằng số phiên gắn cờ thì so tiếp số phiên KHẨN CẤP — đúng cách stats.js xếp
    // "lớp cần chú ý" lên đầu, để hai bảng trên cùng một trang không nói ngược nhau.
    tiebreak: (a, b) => (b.highRiskCount || 0) - (a.highRiskCount || 0)
  },
  {
    id: "highRiskCount",
    label: "Khẩn cấp",
    // Bằng số phiên khẩn cấp thì lùi về số phiên gắn cờ — cùng 1 phiên khẩn cấp
    // mà một em có thêm 6 phiên đáng lo thì em đó cần nhìn trước.
    tiebreak: (a, b) => (b.flaggedCount || 0) - (a.flaggedCount || 0)
  }
];

// Mũi tên ↑/↓ chỉ đổi chiều của CON SỐ trên nút. Phần so bù (bằng nhau thì xếp
// theo mức đáng chú ý, rồi tới tên) luôn giữ nguyên chiều — lật cả nó thì bấm
// "tăng dần" xong dòng đáng lo nhất tụt vào giữa bảng, chỗ không ai nhìn.
function compareBySort(sort) {
  const field = SORTS.find((item) => item.id === sort.id);
  const sign = sort.dir === "asc" ? 1 : -1;

  return (a, b) =>
    sign * ((a[sort.id] || 0) - (b[sort.id] || 0)) ||
    field.tiebreak(a, b) ||
    String(a.username).localeCompare(String(b.username), "vi", { numeric: true });
}

// Số cột của bảng tài khoản — dòng chi tiết mở ra bên dưới phải trải hết bề ngang
// bằng colSpan. Tính từ SORTS thay vì gõ sẵn một con số: thêm một cột số nữa mà
// quên sửa colSpan thì bảng vẹo mất một góc, và không có gì báo lỗi cả.
//
//   7 cột chữ (tài khoản · điện thoại · email · vai trò · trường · lớp · khối)
//   + 3 cột số + 1 cột hành động
const USERS_COLUMN_COUNT = 7 + SORTS.length + 1;

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
  // Các vai trò được đọc dữ liệu học sinh phải qua vòng duyệt.
  // "Đã duyệt" cho một thứ chưa từng phải duyệt.
  {
    header: "Trạng thái",
    value: (r) =>
      [ROLES.TEACHER, ROLES.COUNSELOR].includes(r.role) ? statusLabel(r.status) : "",
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

/**
 * @param {object[]} users        Dòng của bảng, đã kèm sessionCount/flaggedCount/highRiskCount
 * @param {boolean}  loading      Đang tải danh sách
 * @param {number}   selfId       Tài khoản đang đăng nhập — đánh dấu "(bạn)" và không cho tự xoá
 * @param {node}     note         Đoạn ghi chú dưới tiêu đề, mỗi trang nói một chuyện khác
 * @param {function} sessionsUrl  (id) => URL lịch sử hội thoại của một tài khoản
 * @param {function} onError      Báo lỗi lên trang cha
 * @param {function} [onSave]     (id, body) => Promise — có thì bảng mới có nút Sửa
 * @param {function} [onDelete]   (row) => Promise — có thì bảng mới có nút Xoá
 * @param {function} [onApproval] (row, status) => Promise — có thì mới có nút Duyệt/Gỡ duyệt
 * @param {boolean}  [allowAlerts] Cho soạn email cảnh báo từ một phiên hội thoại
 */
export default function AccountsPanel({
  users = [],
  loading = false,
  selfId = null,
  note = null,
  sessionsUrl,
  onError,
  onSave,
  onDelete,
  onApproval,
  allowAlerts = false
}) {
  // --- Bảng tài khoản: tìm kiếm + phân trang ---------------------------------
  const [query, setQuery] = useState("");
  // Bốn ô chọn: vai trò · trường · lớp · khối. "" ở một chiều = không lọc chiều đó.
  const [filters, setFilters] = useState(NO_USER_FILTERS);

  // Cách xếp bảng: null = thứ tự mặc định (theo lúc đăng ký), hoặc
  // { id: "sessionCount" | "flaggedCount", dir: "desc" | "asc" }.
  const [sort, setSort] = useState(null);

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

  // Đang mở đúng bảng đó ở đúng dòng đó thì bấm lần nữa là ĐÓNG lại. Cùng một
  // nút vừa mở vừa đóng, không cần thêm dấu ✕ ở mỗi bảng.
  const isOpen = (id, mode) => expanded?.id === id && expanded.mode === mode;

  const openSessions = async (target) => {
    if (isOpen(target.id, "sessions")) return setExpanded(null);

    setExpanded({ id: target.id, mode: "sessions" });
    setSessions([]);
    setSessionsLoading(true);
    try {
      const res = await axios.get(sessionsUrl(target.id));
      setSessions(res.data.sessions);
    } catch (err) {
      onError?.(err.response?.data?.error || "Không tải được lịch sử hội thoại.");
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

  const submitEdit = async (id) => {
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

    setSaving(true);
    try {
      // Chỉ đóng bảng sửa khi trang cha báo là LƯU ĐƯỢC. Đóng vô điều kiện thì
      // lưu hỏng cũng trông y hệt lưu xong, và những gì vừa gõ biến mất theo.
      if (await onSave(id, body)) setExpanded(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (target) => {
    setDeleting(true);
    try {
      if (await onDelete(target)) {
        setExpanded(null);
        setSessions([]);
      }
    } finally {
      setDeleting(false);
    }
  };

  const runApproval = (target, status) => onApproval(target, status);

  // --- Lọc và cắt trang -------------------------------------------------------
  //
  // Ô gõ chữ lọc TRƯỚC, bốn ô chọn lọc sau. Tách hai bước vì các ô chọn phải liệt
  // kê mục dựa trên KẾT QUẢ TÌM KIẾM — gõ "diem" xong thì ô Trường chỉ còn mấy
  // trường khớp, chứ không phải cả danh sách toàn huyện.
  //
  // Dò trên đủ mọi thứ có trong bảng: tên tài khoản, họ tên, trường, lớp, khối,
  // email, số điện thoại. Gõ không dấu vẫn ra — "doan thi diem" tìm thấy "Đoàn
  // Thị Điểm" (xem utils/search.js).
  const searchedUsers = useMemo(
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

  const filteredUsers = useMemo(
    () => filterByFacets(searchedUsers, USER_FACETS, filters),
    [searchedUsers, filters]
  );

  const userFacets = useMemo(
    () => buildFacets(searchedUsers, USER_FACETS, filters),
    [searchedUsers, filters]
  );

  const filtersOn = Boolean(query.trim()) || hasFilters(USER_FACETS, filters);

  const resetFilters = () => {
    setQuery("");
    setFilters(NO_USER_FILTERS);
  };

  // Sắp xếp SAU khi lọc, và luôn trên một bản sao — filteredUsers là kết quả của
  // một useMemo khác, sort() tại chỗ sẽ xáo chính cái mảng đó và làm lần render
  // sau đọc phải thứ tự đã bị đổi mà không ai gọi sắp xếp.
  const sortedUsers = useMemo(
    () => (sort ? [...filteredUsers].sort(compareBySort(sort)) : filteredUsers),
    [filteredUsers, sort]
  );

  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  // Kẹp lại thay vì tin vào `page`: gõ thêm một chữ vào ô tìm kiếm có thể làm danh
  // sách ngắn đi đột ngột, và lúc đó trang thứ 5 không còn tồn tại nữa — không kẹp
  // thì bảng hiện ra trống trơn trong khi vẫn còn kết quả.
  const safePage = Math.min(page, pageCount - 1);
  const pageUsers = sortedUsers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Đổi từ khoá, đổi vai trò hay đổi cách xếp thì quay về trang đầu — bảng vừa
  // xếp lại thì trang 3 của thứ tự cũ chẳng còn nghĩa gì, mà đó lại đúng là lúc
  // người ta muốn nhìn mấy dòng đầu nhất.
  useEffect(() => {
    setPage(0);
  }, [query, filters, sort]);

  // Dòng đang mở bảng chi tiết mà trôi khỏi trang đang xem (do lọc hay chuyển
  // trang) thì đóng lại: để mở thì nó sẽ bật ra ở một dòng khác của trang mới.
  useEffect(() => {
    if (expanded && !pageUsers.some((u) => u.id === expanded.id)) setExpanded(null);
    // pageUsers dựng lại mỗi lần render nên chỉ nghe theo hai thứ thật sự đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, sort, safePage, users]);

  // Tài khoản của bảng chi tiết đang mở — AlertEmailModal cần tên em đó
  const openUser = users.find((u) => u.id === expanded?.id) || null;

  return (
    <>
    <section className="admin-panel">
      <h2 className="admin-panel__title">
        {USERS_TABLE}
        {/* File tải về mang đúng tên bảng, và chứa ĐÚNG những dòng đang lọc ra —
            tìm "6A1" rồi bấm tải thì được danh sách lớp 6A1, không phải cả trường. */}
        <ExportExcelButton
          name={USERS_TABLE}
          columns={USERS_COLUMNS}
          rows={sortedUsers}
          className="admin-btn admin-btn--sm admin-btn--ghost admin-export-btn"
        />
      </h2>

      {note}

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

        {/* Bốn ô chọn, đúng bốn cột đầu của bảng. Mỗi mục in sẵn số lượng
            ("Học sinh (25)") nên chưa bấm đã biết bấm vào được mấy dòng, và các
            ô ăn theo nhau nên không tổ hợp nào bấm ra bảng trống. */}
        {userFacets.map((facet) => (
          <FacetSelect
            key={facet.id}
            facet={facet}
            value={filters[facet.id]}
            onChange={(id, value) => setFilters((prev) => ({ ...prev, [id]: value }))}
          />
        ))}

        <span className="admin-toolbar__count">
          {filtersOn
            ? `${filteredUsers.length} / ${users.length} tài khoản khớp`
            : `${users.length} tài khoản`}
        </span>

        {filtersOn && (
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--ghost"
            onClick={resetFilters}
          >
            Xoá bộ lọc
          </button>
        )}
      </div>

      {loading ? (
        <p className="admin-empty">Đang tải...</p>
      ) : users.length === 0 ? (
        <p className="admin-empty">Chưa có tài khoản nào.</p>
      ) : filteredUsers.length === 0 ? (
        <p className="admin-empty">
          {query.trim()
            ? `Không có tài khoản nào khớp với “${query}”. Thử bớt từ khoá hoặc bớt một ô lọc đi xem sao.`
            : "Không có tài khoản nào khớp bộ lọc đang đặt."}
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--ghost admin-empty__reset"
            onClick={resetFilters}
          >
            Xoá bộ lọc
          </button>
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
                {/* Ba cột số, mỗi cột một con số và bấm được để xếp — giống hệt
                    bảng lớp và bảng trường của bảng điều khiển, để ba bảng cùng
                    nói về hội thoại trên một trang đọc ra cùng một kiểu. */}
                {SORTS.map((item) => (
                  <SortHeader
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    sort={sort}
                    onSort={(id) => setSort((prev) => cycleSort(prev, id))}
                  />
                ))}
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className={expanded?.id === row.id ? "admin-row--open" : ""}>
                    <td>
                      <strong>{row.username}</strong>
                      {row.id === selfId && <span className="admin-self"> (bạn)</span>}
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
                      {[ROLES.TEACHER, ROLES.COUNSELOR].includes(row.role) &&
                        row.status !== STATUS.APPROVED && (
                        <div className={`admin-status admin-status--${row.status}`}>
                          {statusLabel(row.status)}
                        </div>
                      )}
                    </td>
                    <td className="admin-muted">{row.profile?.school || "—"}</td>
                    <td className="admin-muted">{row.profile?.className || "—"}</td>
                    <td className="admin-muted">{row.profile?.grade || "—"}</td>
                    {/* Số 0 in thành gạch ngang: cả bảng phần lớn là số 0 (giáo
                        viên và quản trị viên không trò chuyện), để nguyên thì mắt
                        phải lọc lấy mấy ô có số thật giữa một rừng số 0 giống hệt
                        nhau. */}
                    <td>{row.sessionCount || <span className="admin-muted">—</span>}</td>
                    <td>
                      {row.flaggedCount > 0 ? (
                        <span
                          className="admin-flag"
                          title={`${row.flaggedCount} phiên có dấu hiệu tiêu cực cần xem lại`}
                        >
                          🚩 {row.flaggedCount}
                        </span>
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.highRiskCount > 0 ? (
                        <span
                          className="admin-flag admin-flag--high"
                          title={`${row.highRiskCount} phiên khẩn cấp — cần xem ngay`}
                        >
                          ❗ {row.highRiskCount}
                        </span>
                      ) : (
                        <span className="admin-muted">—</span>
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
                        {onApproval &&
                          [ROLES.TEACHER, ROLES.COUNSELOR].includes(row.role) &&
                          row.status !== STATUS.APPROVED && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--primary"
                            onClick={() => runApproval(row, STATUS.APPROVED)}
                          >
                            Duyệt
                          </button>
                        )}
                        {onApproval &&
                          [ROLES.TEACHER, ROLES.COUNSELOR].includes(row.role) &&
                          row.status === STATUS.APPROVED && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--ghost"
                            onClick={() => runApproval(row, STATUS.REJECTED)}
                          >
                            Gỡ duyệt
                          </button>
                        )}
                        {onSave && (
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
                        )}
                        {/* Không cho tự xoá tài khoản đang đăng nhập */}
                        {onDelete && row.id !== selfId && (
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
                      <td colSpan={USERS_COLUMN_COUNT}>
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
                                onAlert={allowAlerts ? setAlertSession : undefined}
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
                                  onClick={() => submitEdit(row.id)}
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
                                  onClick={() => confirmDelete(row)}
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

        {/* Phân trang dùng chung với bảng trường của bảng điều khiển (xem
            TablePager.jsx): ngoài Trước/Sau còn có nhảy thẳng về đầu, tới cuối
            và ±5 trang. Vài chục trang mà chỉ có hai mũi tên thì đi tới cuối
            bảng là hai mươi cú bấm — mà đang xếp giảm dần thì cuối bảng chính
            là chỗ đáng nhìn. */}
        <TablePager
          page={safePage}
          pages={pageCount}
          onPage={setPage}
          pageSize={PAGE_SIZE}
          total={filteredUsers.length}
          unit="tài khoản"
        />
        </>
      )}
    </section>

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
    </>
  );
}
