import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";
import { ROLES } from "../../constants/roles";
import { dayKeyOf, formatNumber, formatTime, shiftDay, todayKey } from "../../utils/days";
import { buildFacets, filterByFacets, noFilters } from "../../utils/facets";
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

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openUserId, setOpenUserId] = useState("");
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
    setOpenUserId("");
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

  const toggleAccount = (id) => {
    const key = String(id);
    setOpenUserId((current) => (current === key ? "" : key));
    setOpenSessionId("");
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
        hội thoại trong khoảng này; nội dung từng phiên chỉ tải sau khi bấm mở.
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

      <section className="dash-card usage-section" aria-labelledby="usage-chart-title">
        <h3 id="usage-chart-title" className="dash-card__title">2. Biểu đồ tần suất sử dụng</h3>
        <p className="dash-card__sub">
          Trục X là ngày; trục Y là số cuộc hội thoại. Mỗi hàng là một tài khoản đã chọn.
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
          </div>
        )}

        {selectedUsers.length === 0 ? (
          <p className="admin-empty">Chưa chọn tài khoản nào ở mục 1.</p>
        ) : loading ? (
          <p className="admin-empty">Đang tải tần suất sử dụng…</p>
        ) : (
          <>
            <Legend series={SERIES} />
            <div className="usage-chart-list">
              {selectedRows.map(({ user, sessions: userSessions }) => {
                return (
                  <article
                    key={user.id}
                    className="usage-chart-row"
                    aria-label={`Tần suất của ${displayName(user)}`}
                  >
                    <div className="usage-row-head">
                      <div>
                        <strong>{displayName(user)}</strong>
                        <span>{user.username}</span>
                      </div>
                      <span>{formatNumber(userSessions.length)} cuộc trong khoảng</span>
                    </div>
                    <DayColumnChart
                      days={chartRows(userSessions, dates)}
                      series={SERIES}
                      grouped
                      emptyText={`${displayName(user)} không có hội thoại trong khoảng này.`}
                    />
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="dash-card usage-section" aria-labelledby="usage-content-title">
        <h3 id="usage-content-title" className="dash-card__title">3. Nội dung hội thoại</h3>
        <p className="dash-card__sub">
          Mỗi hàng là một tài khoản. Mở tài khoản rồi chọn đúng phiên cần đọc; các phiên cũ có
          thể chỉ còn bản tóm tắt vì transcript chưa được lưu ở phiên bản trước.
        </p>

        {selectedUsers.length === 0 ? (
          <p className="admin-empty">Chưa chọn tài khoản nào ở mục 1.</p>
        ) : (
          <div className="usage-conversations">
            {selectedRows.map(({ user, sessions: userSessions }) => {
              const key = String(user.id);
              const accountOpen = openUserId === key;

              return (
                <article key={user.id} className="usage-conversation-account">
                  <button
                    type="button"
                    className="usage-disclosure"
                    aria-expanded={accountOpen}
                    onClick={() => toggleAccount(user.id)}
                  >
                    <span>
                      <strong>{displayName(user)}</strong>
                      <small>{user.username}</small>
                      <small className="usage-student-meta">
                        <span>SĐT: {user.phone || "Chưa có"}</span>
                        <span>Email: {user.email || "Chưa có"}</span>
                        <span>Lớp: {user.profile?.className || "Chưa có"}</span>
                        <span>Trường: {user.profile?.school || "Chưa có"}</span>
                      </small>
                    </span>
                    <span>{formatNumber(userSessions.length)} cuộc {accountOpen ? "▴" : "▾"}</span>
                  </button>

                  {accountOpen && (
                    <div className="usage-session-list">
                      {userSessions.length === 0 ? (
                        <p className="admin-empty">Không có hội thoại trong khoảng này.</p>
                      ) : (
                        userSessions.map((session) => {
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
                        })
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
