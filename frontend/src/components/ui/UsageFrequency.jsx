import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";
import { ROLES } from "../../constants/roles";
import { dayKeyOf, formatDay, formatNumber, formatTime, shiftDay, todayKey } from "../../utils/days";
import { buildFacets, facetValue, filterByFacets, NONE, noFilters } from "../../utils/facets";
import { matchesQuery } from "../../utils/search";
import DateRangeBar from "./DateRangeBar";
import DayColumnChart from "./DayColumnChart";
import { Legend } from "./DashParts";
import FacetSelect from "./FacetSelect";
import "../../styles/AdminDashboard.css";

const FILTER_FIELDS = [
  {
    id: "school",
    label: "Trường",
    all: "Tất cả trường",
    empty: "Chưa khai trường",
    of: (user) => user.profile?.school
  },
  {
    id: "grade",
    label: "Khối",
    all: "Tất cả khối",
    empty: "Chưa khai khối",
    of: (user) => user.profile?.grade
  },
  {
    id: "className",
    label: "Lớp",
    all: "Tất cả lớp",
    empty: "Chưa khai lớp",
    of: (user) => user.profile?.className
  }
];

const NO_FILTERS = noFilters(FILTER_FIELDS);
const SERIES = [
  { key: "sessions", label: "Cuộc hội thoại", color: "--dash-safe" },
  { key: "flagged", label: "Bị gắn cờ", color: "--dash-flag" },
  { key: "high", label: "Khẩn cấp", color: "--dash-high" }
];

const SORT_OPTIONS = [
  { key: "sessions", label: "Số cuộc hội thoại" },
  { key: "flagged", label: "Số cuộc bị gắn cờ" },
  { key: "high", label: "Số cuộc khẩn cấp" }
];

// Chọn chuỗi nào lên biểu đồ. "Cả 3" là mặc định vì đó là cách nhìn đủ ngữ cảnh
// nhất — nhưng ba cột chồng cạnh nhau thì một cột 1-2 cuộc gắn cờ gần như biến
// mất bên cạnh cột tổng, nên phải tách được ra xem riêng.
const VIEW_OPTIONS = [
  { key: "all", label: "Cả 3 chỉ số", empty: "hội thoại" },
  { key: "sessions", label: "Tổng số cuộc", empty: "hội thoại" },
  { key: "flagged", label: "Cuộc bị gắn cờ", empty: "cuộc nào bị gắn cờ" },
  { key: "high", label: "Cuộc khẩn cấp", empty: "cuộc nào khẩn cấp" }
];

// Cách bổ biểu đồ tổng. Khối và lớp LUÔN kèm tên trường: "6A1" của THCS A và
// "6A1" của THCS B là hai tập học sinh khác nhau, gộp chung một cột là ra một
// con số không ứng với lớp nào có thật.
const GROUP_MODES = [
  { key: "all", label: "Tất cả" },
  { key: "school", label: "Theo trường" },
  { key: "grade", label: "Theo khối" },
  { key: "className", label: "Theo lớp" }
];

const GROUP_OF = {
  school: (user) => user.profile?.school,
  grade: (user) => user.profile?.grade,
  className: (user) => user.profile?.className
};

const GROUP_TITLE = {
  school: (value) => (value === NONE ? "Chưa khai trường" : value),
  grade: (value) => (value === NONE ? "Chưa khai khối" : `Khối ${value}`),
  className: (value) => (value === NONE ? "Chưa khai lớp" : `Lớp ${value}`)
};

function displayName(user) {
  return user.profile?.fullName || user.username;
}

function datesOf({ from, to }) {
  const dates = [];
  for (let day = from; day <= to && dates.length < 366; day = shiftDay(day, 1)) {
    dates.push(day);
  }
  return dates;
}

function chartRows(sessions, dates) {
  const rows = new Map(
    dates.map((date) => [date, { date, sessions: 0, flagged: 0, high: 0 }])
  );

  for (const session of sessions) {
    const row = rows.get(dayKeyOf(session.startedAt));
    if (!row) continue;
    row.sessions += 1;
    if (session.flagged || session.bullyingDetected) row.flagged += 1;
    if (session.riskLevel === "high") row.high += 1;
  }

  return [...rows.values()];
}

/** Chia danh sách tài khoản đã lọc thành các nhóm, mỗi nhóm một biểu đồ. */
function buildGroups(users, mode) {
  if (mode === "all") {
    return [{ id: "all", title: "Tất cả tài khoản đã lọc", meta: "", users }];
  }

  const groups = new Map();

  for (const user of users) {
    const school = facetValue(user.profile?.school);
    const value = facetValue(GROUP_OF[mode](user));
    const id = mode === "school" ? value : `${school}|${value}`;

    if (!groups.has(id)) {
      groups.set(id, {
        id,
        title: GROUP_TITLE[mode](value),
        meta: mode === "school" ? "" : GROUP_TITLE.school(school),
        // "Chưa khai" xuống cuối, cùng lối xếp với mấy ô chọn lọc
        sort: [school === NONE ? "\uffff" : school, value === NONE ? "\uffff" : value],
        users: []
      });
    }

    groups.get(id).users.push(user);
  }

  return [...groups.values()].sort((a, b) => {
    for (let index = 0; index < a.sort.length; index += 1) {
      const diff = String(a.sort[index]).localeCompare(String(b.sort[index]), "vi", {
        numeric: true
      });
      if (diff) return diff;
    }
    return 0;
  });
}

// Một phiên có được tính vào chỉ số đang xem không. "Cả 3" và "tổng số cuộc"
// đều lấy hết — cột tổng của hai cách nhìn đó là một.
function matchesView(session, view) {
  if (view === "flagged") return Boolean(session.flagged || session.bullyingDetected);
  if (view === "high") return session.riskLevel === "high";
  return true;
}

function usageTotals(sessions) {
  return sessions.reduce(
    (totals, session) => ({
      sessions: totals.sessions + 1,
      flagged: totals.flagged + Number(Boolean(session.flagged || session.bullyingDetected)),
      high: totals.high + Number(session.riskLevel === "high")
    }),
    { sessions: 0, flagged: 0, high: 0 }
  );
}

export default function UsageFrequency({ users = [], onError, apiScope = "admin" }) {
  const today = todayKey();
  const [range, setRange] = useState(() => ({ from: shiftDay(today, -6), to: today }));
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortBy, setSortBy] = useState("sessions");
  const [sortDirection, setSortDirection] = useState("desc");
  const [view, setView] = useState("all");
  const [groupMode, setGroupMode] = useState("all");
  const [groupView, setGroupView] = useState("all");
  const [picked, setPicked] = useState(null);
  const [focus, setFocus] = useState({ id: "", tick: 0 });

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSessionId, setOpenSessionId] = useState("");
  const [details, setDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState("");

  // Ô chọn chỉ liệt kê học sinh CÓ hội thoại trong khoảng đang xem. Cả kho tài
  // khoản thì phần lớn là học sinh im lặng suốt khoảng đó, chọn vào chỉ ra một
  // hàng biểu đồ trống — mà lại làm trôi mất mấy em thật sự cần nhìn.
  const activeIds = useMemo(
    () => new Set(sessions.map((session) => String(session.userId))),
    [sessions]
  );

  const students = useMemo(
    () =>
      users.filter(
        (user) => user.role === ROLES.STUDENT && activeIds.has(String(user.id))
      ),
    [users, activeIds]
  );

  const searched = useMemo(
    () =>
      students.filter((user) =>
        matchesQuery(query, [
          user.username,
          user.profile?.fullName,
          user.profile?.school,
          user.profile?.className,
          user.profile?.grade,
          user.email,
          user.phone
        ])
      ),
    [students, query]
  );

  const filtered = useMemo(
    () => filterByFacets(searched, FILTER_FIELDS, filters),
    [searched, filters]
  );

  const facets = useMemo(
    () => buildFacets(searched, FILTER_FIELDS, filters),
    [searched, filters]
  );

  useEffect(() => {
    const valid = new Set(students.map((user) => String(user.id)));
    setSelectedIds((current) => {
      const next = current.filter((id) => valid.has(id));
      return next.length === current.length ? current : next;
    });
  }, [students]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOpenSessionId("");
    setDetails({});

    axios
      .get(`${API_BASE_URL}/api/${apiScope}/sessions`, { params: range })
      .then((response) => {
        if (active) setSessions(response.data.sessions || []);
      })
      .catch((error) => {
        if (!active) return;
        setSessions([]);
        onError?.(error.response?.data?.error || "Không tải được lịch sử hội thoại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range, onError, apiScope]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUsers = useMemo(
    () => students.filter((user) => selectedSet.has(String(user.id))),
    [students, selectedSet]
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((user) => selectedSet.has(String(user.id)));

  const sessionsByUser = useMemo(() => {
    const grouped = new Map();
    for (const session of sessions) {
      const key = String(session.userId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(session);
    }
    return grouped;
  }, [sessions]);

  const dates = useMemo(() => datesOf(range), [range]);

  const visibleSeries = useMemo(
    () => (view === "all" ? SERIES : SERIES.filter((item) => item.key === view)),
    [view]
  );
  const viewLabel = VIEW_OPTIONS.find((option) => option.key === view).empty;

  const groupSeries = useMemo(
    () => (groupView === "all" ? SERIES : SERIES.filter((item) => item.key === groupView)),
    [groupView]
  );
  const groupViewLabel = VIEW_OPTIONS.find((option) => option.key === groupView).empty;

  // Biểu đồ tổng đi theo bộ LỌC chứ không theo mấy ô đã tích: câu hỏi "lớp 6A1
  // dùng nhiều hay ít" hỏi về cả lớp, còn tích từng em là để đọc chi tiết.
  const groupRows = useMemo(() => {
    const groups = buildGroups(filtered, groupMode);

    return groups.map((group) => {
      const groupSessions = group.users.flatMap(
        (user) => sessionsByUser.get(String(user.id)) || []
      );
      return {
        ...group,
        days: chartRows(groupSessions, dates),
        totals: usageTotals(groupSessions)
      };
    });
  }, [filtered, groupMode, sessionsByUser, dates]);

  // Đổi cách bổ nhóm hay đổi bộ lọc thì nhóm đang mở không còn nghĩa gì nữa
  useEffect(() => {
    setPicked(null);
  }, [groupMode, filtered, sessions]);

  const pickedGroup = picked
    ? groupRows.find((group) => group.id === picked.groupId)
    : null;

  // Những em làm nên đúng cái cột vừa bấm — cùng ngày, cùng nhóm, và cùng loại
  // cuộc hội thoại mà biểu đồ đang hiện.
  const contributors = useMemo(() => {
    if (!pickedGroup) return [];

    return pickedGroup.users
      .map((user) => {
        const daySessions = (sessionsByUser.get(String(user.id)) || []).filter(
          (session) =>
            dayKeyOf(session.startedAt) === picked.date && matchesView(session, groupView)
        );
        return { user, sessions: daySessions, totals: usageTotals(daySessions) };
      })
      .filter((row) => row.sessions.length > 0)
      .sort(
        (a, b) =>
          b.sessions.length - a.sessions.length ||
          displayName(a.user).localeCompare(displayName(b.user), "vi")
      );
  }, [pickedGroup, picked, sessionsByUser, groupView]);

  const selectedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return selectedUsers
      .map((user) => {
        const userSessions = sessionsByUser.get(String(user.id)) || [];
        return { user, sessions: userSessions, totals: usageTotals(userSessions) };
      })
      .sort((a, b) => {
        const difference = a.totals[sortBy] - b.totals[sortBy];
        if (difference !== 0) return difference * direction;
        return displayName(a.user).localeCompare(displayName(b.user), "vi");
      });
  }, [selectedUsers, sessionsByUser, sortBy, sortDirection]);

  const pickDay = (groupId, day) => {
    setPicked((current) =>
      current && current.groupId === groupId && current.date === day.date
        ? null
        : { groupId, date: day.date }
    );
  };

  // Từ một cái tên trong bảng "ngày này gồm những em nào" đi thẳng tới biểu đồ
  // và hội thoại của em đó: tự tích vào nếu chưa tích, rồi đưa con trỏ tới hàng.
  const focusStudent = (user) => {
    const key = String(user.id);
    setSelectedIds((current) => (current.includes(key) ? current : [...current, key]));
    setFocus((current) => ({ id: key, tick: current.tick + 1 }));
  };

  useEffect(() => {
    if (!focus.id) return;
    const node = document.getElementById(`usage-row-${focus.id}`);
    if (!node) return;
    // focus trước, cuộn sau: người dùng bàn phím và trình đọc màn hình phải
    // ĐANG ĐỨNG ở hàng đó, không phải chỉ nhìn thấy nó trôi qua.
    node.focus?.({ preventScroll: true });
    node.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [focus, selectedIds]);

  const toggleUser = (id) => {
    const key = String(id);
    setSelectedIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const toggleFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const user of filtered) {
        const key = String(user.id);
        if (allFilteredSelected) next.delete(key);
        else next.add(key);
      }
      return [...next];
    });
  };

  const toggleSession = useCallback(
    async (session) => {
      if (openSessionId === session.id) {
        setOpenSessionId("");
        return;
      }

      setOpenSessionId(session.id);
      if (details[session.id]) return;

      setDetailLoading(session.id);
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/${apiScope}/sessions/${encodeURIComponent(session.id)}`
        );
        setDetails((current) => ({ ...current, [session.id]: response.data }));
      } catch (error) {
        onError?.(error.response?.data?.error || "Không tải được nội dung hội thoại.");
        setOpenSessionId("");
      } finally {
        setDetailLoading("");
      }
    },
    [apiScope, details, onError, openSessionId]
  );

  return (
    <section className="admin-panel usage-panel">
      <h2 className="admin-panel__title">📈 Tần suất sử dụng</h2>
      <p className="admin-note">
        Chọn khoảng ngày rồi chọn học sinh cần theo dõi. Danh sách tài khoản chỉ gồm học sinh có
        hội thoại trong khoảng này. Mục 2 tính trên TẤT CẢ tài khoản khớp bộ lọc, mục 3 chỉ vẽ
        những tài khoản đã tích; nội dung từng phiên chỉ tải sau khi bấm mở.
      </p>

      <section className="dash-card usage-section" aria-labelledby="usage-select-title">
        <h3 id="usage-select-title" className="dash-card__title">1. Chọn tài khoản</h3>
        <p className="dash-card__sub">
          Chỉ hiện học sinh có ít nhất một cuộc hội thoại trong khoảng ngày đã chọn.
        </p>
        <DateRangeBar range={range} onChange={setRange} busy={loading} />

        {loading ? (
          <p className="admin-empty">Đang tải danh sách tài khoản có hội thoại…</p>
        ) : students.length === 0 ? (
          <p className="admin-empty">Không có tài khoản nào có hội thoại trong khoảng này.</p>
        ) : (
          <>
            <div className="usage-filterbar">
              <label className="usage-field usage-field--search">
                <span>Tìm học sinh</span>
                <input
                  type="search"
                  className="usage-input"
                  aria-label="Tìm học sinh theo tên, email hoặc số điện thoại"
                  placeholder="Tên, trường, lớp, khối, email hay số điện thoại…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              {facets.map((facet) => (
                <FacetSelect
                  key={facet.id}
                  facet={facet}
                  value={filters[facet.id]}
                  onChange={(id, value) => setFilters((current) => ({ ...current, [id]: value }))}
                />
              ))}
            </div>

            <div className="usage-selectionbar">
              <label className="usage-check usage-check--all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleFiltered}
                  disabled={filtered.length === 0}
                />
                Chọn tất cả {formatNumber(filtered.length)} tài khoản đã lọc
              </label>
              <span>{formatNumber(selectedIds.length)} tài khoản đã chọn</span>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--ghost"
                  onClick={() => setSelectedIds([])}
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="admin-empty">Không có học sinh nào khớp bộ lọc.</p>
            ) : (
              <div className="usage-account-picker" role="group" aria-label="Danh sách học sinh để chọn">
                {filtered.map((user) => (
                  <label key={user.id} className="usage-account-option">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(String(user.id))}
                      onChange={() => toggleUser(user.id)}
                    />
                    <span>
                      <strong>{displayName(user)}</strong>
                      <small>
                        {user.username}
                        {user.profile?.className ? ` · ${user.profile.className}` : ""}
                        {user.profile?.school ? ` · ${user.profile.school}` : ""}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="dash-card usage-section" aria-labelledby="usage-total-title">
        <h3 id="usage-total-title" className="dash-card__title">
          2. Tổng số cuộc hội thoại theo thời gian
        </h3>
        <p className="dash-card__sub">
          Tính trên toàn bộ tài khoản khớp bộ lọc ở mục 1, không phụ thuộc vào mấy ô đã tích.
          Bấm vào một cột để xem những học sinh làm nên cột đó của ngày hôm ấy.
        </p>

        <div className="usage-sortbar">
          <div className="usage-viewswitch usage-viewswitch--lead">
            <span className="usage-viewswitch__label" id="usage-groupmode-label">
              Gộp biểu đồ
            </span>
            <div className="dash-scope" role="group" aria-labelledby="usage-groupmode-label">
              {GROUP_MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={`dash-chip${groupMode === mode.key ? " dash-chip--on" : ""}`}
                  aria-pressed={groupMode === mode.key}
                  onClick={() => setGroupMode(mode.key)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="usage-viewswitch">
            <span className="usage-viewswitch__label" id="usage-groupview-label">
              Loại cuộc hội thoại
            </span>
            <div className="dash-scope" role="group" aria-labelledby="usage-groupview-label">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`dash-chip${groupView === option.key ? " dash-chip--on" : ""}`}
                  aria-pressed={groupView === option.key}
                  onClick={() => setGroupView(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="admin-empty">Đang tải tần suất sử dụng…</p>
        ) : groupRows.length === 0 ? (
          <p className="admin-empty">Không có tài khoản nào khớp bộ lọc ở mục 1.</p>
        ) : (
          <>
            {groupSeries.length > 1 && <Legend series={groupSeries} />}

            <div className="usage-groups">
              {groupRows.map((group) => {
                const dayOpen = picked?.groupId === group.id ? picked.date : "";

                return (
                  <article
                    key={group.id}
                    className="usage-group"
                    aria-label={`Biểu đồ tổng — ${group.title}${group.meta ? ` · ${group.meta}` : ""}`}
                  >
                    <header className="usage-group__head">
                      <div>
                        <strong>{group.title}</strong>
                        {group.meta && <span>{group.meta}</span>}
                      </div>
                      <span>
                        {formatNumber(group.users.length)} tài khoản ·{" "}
                        {formatNumber(group.totals.sessions)} cuộc
                      </span>
                    </header>

                    <DayColumnChart
                      days={group.days}
                      series={groupSeries}
                      grouped={groupSeries.length > 1}
                      showValues
                      selectedDate={dayOpen}
                      onSelect={(day) => pickDay(group.id, day)}
                      emptyText={`${group.title} không có ${groupViewLabel} trong khoảng này.`}
                    />

                    {dayOpen && (
                      <div className="usage-daypick">
                        <div className="usage-daypick__head">
                          <strong>
                            {formatDay(dayOpen, true)} · {formatNumber(contributors.length)} học sinh
                          </strong>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--ghost"
                            onClick={() => setPicked(null)}
                          >
                            Đóng
                          </button>
                        </div>

                        {contributors.length === 0 ? (
                          <p className="admin-empty">Không có học sinh nào trong ngày này.</p>
                        ) : (
                          <div className="usage-daypick__list">
                            {contributors.map(({ user, sessions: daySessions, totals }) => (
                              <button
                                key={user.id}
                                type="button"
                                className="usage-pickrow"
                                onClick={() => focusStudent(user)}
                              >
                                <span>
                                  <strong>{displayName(user)}</strong>
                                  <small>
                                    {user.username}
                                    {user.profile?.className ? ` · ${user.profile.className}` : ""}
                                    {user.profile?.school ? ` · ${user.profile.school}` : ""}
                                  </small>
                                </span>
                                <span>
                                  {formatNumber(daySessions.length)} cuộc
                                  {totals.flagged > 0 ? ` · 🚩 ${formatNumber(totals.flagged)}` : ""}
                                  {totals.high > 0 ? ` · ⚠️ ${formatNumber(totals.high)}` : ""}
                                  {" ›"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="dash-card usage-section" aria-labelledby="usage-detail-title">
        <h3 id="usage-detail-title" className="dash-card__title">
          3. Tần suất và nội dung hội thoại của từng tài khoản
        </h3>
        <p className="dash-card__sub">
          Mỗi hàng là một tài khoản: biểu đồ theo ngày bên trái, danh sách hội thoại của đúng
          tài khoản đó bên phải. Nội dung một phiên chỉ tải sau khi bấm mở; các phiên cũ có thể
          chỉ còn bản tóm tắt vì transcript chưa được lưu ở phiên bản trước.
        </p>

        {selectedUsers.length > 0 && (
          <div className="usage-sortbar">
            <label className="usage-field">
              <span>Sắp xếp theo</span>
              <select
                className="usage-input"
                aria-label="Sắp xếp tài khoản theo"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--ghost"
              aria-label={`Đang sắp xếp ${sortDirection === "desc" ? "giảm dần" : "tăng dần"}; bấm để đổi chiều`}
              onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
            >
              {sortDirection === "desc" ? "Giảm dần ↓" : "Tăng dần ↑"}
            </button>

            <div className="usage-viewswitch">
              <span className="usage-viewswitch__label" id="usage-view-label">
                Hiện trên biểu đồ
              </span>
              <div className="dash-scope" role="group" aria-labelledby="usage-view-label">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`dash-chip${view === option.key ? " dash-chip--on" : ""}`}
                    aria-pressed={view === option.key}
                    onClick={() => setView(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedUsers.length === 0 ? (
          <p className="admin-empty">Chưa chọn tài khoản nào ở mục 1.</p>
        ) : loading ? (
          <p className="admin-empty">Đang tải tần suất sử dụng…</p>
        ) : (
          <>
            {visibleSeries.length > 1 && <Legend series={visibleSeries} />}

            <div className="usage-rows">
              {selectedRows.map(({ user, sessions: userSessions, totals }) => {
                const name = displayName(user);

                return (
                  <article
                    key={user.id}
                    id={`usage-row-${user.id}`}
                    tabIndex={-1}
                    className={`usage-row${focus.id === String(user.id) ? " usage-row--focus" : ""}`}
                    aria-label={`Tài khoản ${name}`}
                  >
                    <header className="usage-row-head">
                      <div>
                        <strong>{name}</strong>
                        <span>{user.username}</span>
                        <small className="usage-student-meta">
                          <span>SĐT: {user.phone || "Chưa có"}</span>
                          <span>Email: {user.email || "Chưa có"}</span>
                          <span>Lớp: {user.profile?.className || "Chưa có"}</span>
                          <span>Trường: {user.profile?.school || "Chưa có"}</span>
                        </small>
                      </div>
                      <div className="usage-row-stats">
                        <span>{formatNumber(totals.sessions)} cuộc trong khoảng</span>
                        {totals.flagged > 0 && (
                          <span className="usage-row-stat--flag">
                            🚩 {formatNumber(totals.flagged)} bị gắn cờ
                          </span>
                        )}
                        {totals.high > 0 && (
                          <span className="usage-row-stat--high">
                            ⚠️ {formatNumber(totals.high)} khẩn cấp
                          </span>
                        )}
                      </div>
                    </header>

                    <div className="usage-row-body">
                      <div
                        className="usage-row-chart"
                        role="group"
                        aria-label={`Tần suất của ${name}`}
                      >
                        <DayColumnChart
                          days={chartRows(userSessions, dates)}
                          series={visibleSeries}
                          grouped={visibleSeries.length > 1}
                          emptyText={`${name} không có ${viewLabel} trong khoảng này.`}
                        />
                      </div>

                      <div
                        className="usage-row-talks"
                        role="group"
                        aria-label={`Hội thoại của ${name}`}
                      >
                        {userSessions.length === 0 ? (
                          <p className="admin-empty">Không có hội thoại trong khoảng này.</p>
                        ) : (
                          <div className="usage-session-list">
                            {userSessions.map((session) => {
                              const sessionOpen = openSessionId === session.id;
                              const detail = details[session.id];

                              return (
                                <div key={session.id} className="usage-session-row">
                                  <button
                                    type="button"
                                    className="usage-session-button"
                                    aria-expanded={sessionOpen}
                                    onClick={() => toggleSession(session)}
                                  >
                                    <span>{formatTime(session.startedAt)}</span>
                                    <span>
                                      {formatNumber(session.messageCount)} tin
                                      {session.flagged ? " · 🚩 Gắn cờ" : ""}
                                      {session.riskLevel === "high" ? " · Khẩn cấp" : ""}
                                    </span>
                                  </button>

                                  {sessionOpen && (
                                    <div className="usage-transcript">
                                      <div className="usage-session-context">
                                        {session.checkinNote && (
                                          <p>📝 Phiếu cảm xúc: {session.checkinNote}</p>
                                        )}
                                        {session.summary && (
                                          <p><strong>Tóm tắt:</strong> {session.summary}</p>
                                        )}
                                        {session.concerns?.length > 0 && (
                                          <ul>
                                            {session.concerns.map((concern, index) => (
                                              <li key={index}>⚠️ {concern}</li>
                                            ))}
                                          </ul>
                                        )}
                                        {session.alerts?.length > 0 && (
                                          <p>✅ Đã gửi {formatNumber(session.alerts.length)} email cảnh báo.</p>
                                        )}
                                      </div>
                                      {detailLoading === session.id ? (
                                        <p className="admin-empty">Đang tải nội dung…</p>
                                      ) : detail?.messages?.length > 0 ? (
                                        detail.messages.map((message, index) => (
                                          <div
                                            key={`${message.role}-${index}`}
                                            className={`usage-message usage-message--${message.role}`}
                                          >
                                            <strong>{message.role === "user" ? "Học sinh" : "Larry"}</strong>
                                            <p>{message.content}</p>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="admin-empty">
                                          Phiên này chưa có transcript được lưu.
                                          {session.summary && ` Tóm tắt: ${session.summary}`}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </section>
  );
}
