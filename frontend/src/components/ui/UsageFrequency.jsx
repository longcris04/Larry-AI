// Tab "Tần suất sử dụng" — một học sinh vào nói chuyện với Larry đều đặn tới đâu.
//
// Bảng điều khiển trả lời câu hỏi "cả trường thế nào"; chỗ này trả lời "em này
// thế nào". Hai câu hỏi khác nhau nên để hai chỗ: gộp vào một biểu đồ thì con số
// của một em bị chìm nghỉm trong tổng của cả trường.
//
// Vì sao đáng nhìn: một em vào đều rồi im hẳn ba hôm là một tín hiệu, và tín hiệu
// đó KHÔNG hiện ra ở bất cứ con số tổng nào. Biểu đồ cột theo ngày là cách nhanh
// nhất để thấy khoảng trống đó.
//
// KHÔNG gọi thêm API nào mới: dùng lại đúng đường /api/admin/users/:id/sessions
// mà nút "Hội thoại" vẫn gọi, rồi tự đếm theo ngày ở phía trình duyệt. Một học
// sinh có nhiều nhất vài chục phiên nên đếm ở đây rẻ hơn hẳn việc thêm một
// endpoint nữa phải nuôi.

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_BASE_URL } from "../../config/api";
import { ROLES } from "../../constants/roles";
import { dayKeyOf, formatDay, formatNumber, lastNDays } from "../../utils/days";
import { matchesQuery } from "../../utils/search";
import DayColumnChart from "./DayColumnChart";
import "../../styles/AdminDashboard.css";

// Bảy hoặc ba mươi ngày, đúng như hai mốc quen thuộc ở bảng điều khiển. Không có
// mốc 90 ngày: với một học sinh thì 90 cột nhét vừa bề ngang màn hình sẽ mảnh
// như sợi chỉ, và câu hỏi "em này dạo này thế nào" cũng không hỏi tới tận 3 tháng.
const RANGES = [
  { days: 7, label: "7 ngày gần nhất" },
  { days: 30, label: "30 ngày gần nhất" }
];

// Một chuỗi duy nhất → DayColumnChart vẽ thành cột thường thay vì cột chồng.
const SERIES = [{ key: "sessions", label: "Lượt trò chuyện", color: "--dash-safe" }];

export default function UsageFrequency({ users = [], onError }) {
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [days, setDays] = useState(7);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Chỉ học sinh mới có hội thoại. Quản trị viên và giáo viên chủ nhiệm không trò
  // chuyện với Larry, nên để tên họ trong danh sách chọn chỉ dẫn tới một biểu đồ
  // trống trơn mà người xem tưởng là hỏng.
  const students = useMemo(
    () => users.filter((u) => u.role === ROLES.STUDENT),
    [users]
  );

  const matched = useMemo(
    () =>
      students.filter((u) =>
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
    [students, query]
  );

  // Lọc xong mà em đang chọn không còn trong danh sách thì bỏ chọn — giữ lại thì
  // biểu đồ nói về một em không còn thấy tên ở ô chọn ngay bên trên nó.
  useEffect(() => {
    if (userId && !matched.some((u) => String(u.id) === String(userId))) {
      setUserId("");
    }
  }, [matched, userId]);

  const selected = students.find((u) => String(u.id) === String(userId)) || null;

  const load = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/${userId}/sessions`);
      setSessions(res.data.sessions || []);
    } catch (err) {
      onError?.(err.response?.data?.error || "Không tải được lịch sử hội thoại.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  // Đếm phiên theo ngày, rồi trải lên đủ N ngày gần nhất.
  //
  // Tính theo startedAt (lúc em MỞ cuộc trò chuyện) chứ không phải endedAt: một
  // phiên bắt đầu 23h50 và chốt lúc 0h10 hôm sau vẫn là "em vào nói chuyện tối
  // hôm đó", không phải một lượt của ngày mới.
  const chartDays = useMemo(() => {
    const counts = new Map();
    for (const session of sessions) {
      const key = dayKeyOf(session.startedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }

    return lastNDays(days).map((date) => ({ date, sessions: counts.get(date) || 0 }));
  }, [sessions, days]);

  const summary = useMemo(() => {
    const values = chartDays.map((d) => d.sessions);
    const total = values.reduce((sum, v) => sum + v, 0);
    const activeDays = values.filter((v) => v > 0).length;
    const peak = chartDays.reduce(
      (best, d) => (d.sessions > best.sessions ? d : best),
      { date: "", sessions: 0 }
    );

    return {
      total,
      activeDays,
      peak,
      // Trung bình chia cho SỐ NGÀY TRONG KHOẢNG, không chia cho số ngày có hoạt
      // động: câu hỏi là "em vào đều không", mà bỏ ngày im lặng ra khỏi mẫu số thì
      // em vào đúng một hôm với 3 lượt cũng ra "3 lượt/ngày".
      perDay: days > 0 ? total / days : 0
    };
  }, [chartDays, days]);

  return (
    // usage-panel KHÔNG chỉ để trang trí: nó mang bảng màu của biểu đồ
    // (xem AdminDashboard.css). Bỏ class này ra là cột vẽ ra trong suốt.
    <section className="admin-panel usage-panel">
      <h2 className="admin-panel__title">📈 Tần suất sử dụng</h2>

      <p className="admin-note">
        Chọn một tài khoản học sinh để xem em đó vào trò chuyện với Larry bao nhiêu lượt mỗi
        ngày. Trục ngang là các ngày theo thứ tự tăng dần tới hôm nay; cột càng cao là càng
        nhiều lượt trong ngày đó.
      </p>

      <div className="usage-controls">
        <label className="usage-field">
          <span>Tìm tài khoản</span>
          <input
            type="search"
            className="usage-input"
            placeholder="Tên, trường, lớp, khối, email hay số điện thoại…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className="usage-field">
          <span>
            Học sinh
            {query.trim() && ` (${formatNumber(matched.length)} kết quả)`}
          </span>
          <select
            className="usage-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">— Chọn một tài khoản —</option>
            {matched.map((u) => (
              <option key={u.id} value={u.id}>
                {u.profile?.fullName ? `${u.profile.fullName} — ${u.username}` : u.username}
                {u.profile?.className ? ` · ${u.profile.className}` : ""}
                {u.profile?.school ? ` · ${u.profile.school}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="usage-field usage-field--ranges">
          <span>Khoảng thời gian</span>
          <div className="usage-ranges">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                className={`admin-btn admin-btn--sm${
                  days === range.days ? "" : " admin-btn--ghost"
                }`}
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!selected ? (
        <p className="admin-empty">
          {students.length === 0
            ? "Chưa có tài khoản học sinh nào."
            : "Hãy chọn một tài khoản ở ô bên trên để xem biểu đồ."}
        </p>
      ) : loading ? (
        <p className="admin-empty">Đang tải lịch sử hội thoại…</p>
      ) : (
        <>
          <div className="dash-tiles usage-tiles">
            <Tile label="Tổng lượt trò chuyện" value={summary.total} hint={`trong ${days} ngày`} />
            <Tile
              label="Số ngày có vào"
              value={summary.activeDays}
              hint={`trên tổng ${days} ngày`}
            />
            <Tile
              label="Trung bình mỗi ngày"
              value={summary.perDay.toFixed(1).replace(".", ",")}
              hint="tính cả những ngày không vào"
              raw
            />
            <Tile
              label="Ngày nhiều nhất"
              value={summary.peak.sessions}
              hint={summary.peak.sessions > 0 ? formatDay(summary.peak.date, true) : "chưa có"}
            />
          </div>

          <DayColumnChart
            days={chartDays}
            series={SERIES}
            emptyText={`${
              selected.profile?.fullName || selected.username
            } chưa có lượt trò chuyện nào trong ${days} ngày gần nhất.`}
          />
        </>
      )}
    </section>
  );
}

// Ô số nhỏ phía trên biểu đồ. `raw` để dùng nguyên chuỗi đã định dạng sẵn (số
// trung bình có phần thập phân, formatNumber sẽ làm tròn mất).
function Tile({ label, value, hint, raw = false }) {
  return (
    <div className="dash-tile">
      <span className="dash-tile__label">{label}</span>
      <strong className="dash-tile__value">{raw ? value : formatNumber(value)}</strong>
      {hint && <span className="dash-tile__hint">{hint}</span>}
    </div>
  );
}
