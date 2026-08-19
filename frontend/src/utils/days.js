// Ngày tháng và số cho các màn hình thống kê của quản trị viên.
//
// Tách ra khỏi AdminDashboard.jsx vì giờ có HAI màn hình cùng vẽ biểu đồ theo
// ngày (bảng điều khiển và tab tần suất sử dụng). Hai bản sao của cùng mấy hàm
// này là hai chỗ có thể lệch nhau — mà lệch múi giờ hay lệch cách cắt ngày thì
// hai biểu đồ cạnh nhau sẽ nói hai con số khác nhau về cùng một ngày.

// Giờ Việt Nam, khớp với TZ_OFFSET_MINUTES của backend (xem backend/stats.js).
// Hai bên phải cắt ngày giống nhau, nếu không thì nút "Hôm nay" ở đây hỏi một
// khoảng mà máy chủ hiểu thành hôm khác.
export const TZ_OFFSET_MINUTES = 420;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey() {
  return new Date(Date.now() + TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function shiftDay(key, deltaDays) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + deltaDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Mốc thời gian ISO → khoá ngày "yyyy-mm-dd" theo giờ Việt Nam.
 *
 * Giống hệt dayKey() của backend. Một phiên bắt đầu lúc 23h30 ngày 18 theo giờ
 * Việt Nam có mốc UTC rơi sang ngày 19 — cắt bằng UTC thì lượt trò chuyện đó
 * nhảy sang cột hôm sau trên biểu đồ.
 */
export function dayKeyOf(value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  return new Date(time + TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/**
 * N ngày gần nhất, tăng dần và KẾT THÚC Ở HÔM NAY.
 *
 * Trả về đủ N ngày kể cả ngày không có gì xảy ra: biểu đồ phải có cột trống ở
 * đúng chỗ đó. Bỏ ngày rỗng đi thì trục ngang co lại và mấy ngày im ắng trông
 * như chưa từng tồn tại — trong khi "ba hôm liền em không vào" chính là thông
 * tin đáng chú ý nhất.
 */
export function lastNDays(count, endKey = todayKey()) {
  return Array.from({ length: count }, (_, i) => shiftDay(endKey, i - count + 1));
}

export function formatDay(key, withYear = false) {
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN");
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

/**
 * Trần "đẹp" cho trục dọc — luôn là số CHẴN để vạch giữa cũng là số nguyên.
 * Vạch trục lẻ kiểu 12,5 làm người đọc dừng lại đúng ở chỗ đáng lẽ phải liếc qua.
 */
export function niceMax(value) {
  if (value <= 2) return 2;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => normalized <= s) || 10;
  return Math.ceil((step * magnitude) / 2) * 2;
}
