// Học sinh có muốn nghe tiếng Larry không — MỘT nguồn sự thật duy nhất.
//
// Lựa chọn này được bấm ở HAI nơi cách xa nhau: nút loa ở trang đăng nhập và nút
// loa ở đầu khung chat. Hai nơi đó không có tổ tiên chung nào trong cây React
// (một cái ở /login, một cái ở /chat), nên state của React không nối chúng lại
// được. Chỗ chung duy nhất là localStorage — và một sự kiện để nơi này bấm thì
// nơi kia vẽ lại theo.
//
//   [nút ở trang đăng nhập] ──┐                 ┌──> [nút ở khung chat]
//                             ├─> localStorage ─┤
//   [nút ở khung chat] ───────┘   + sự kiện     └──> [useSpeaker: gọi/không gọi TTS]
//
// MẶC ĐỊNH TẮT. Đây là quyết định về TIỀN chứ không phải về thẩm mỹ: mỗi câu
// Larry nói là một lần gọi model TTS có tính phí, mà phần lớn học sinh ngồi
// trong lớp hoặc dùng máy không loa thì cũng không nghe. Bật sẵn cho tất cả nghĩa
// là trả tiền cho phần đông những người không dùng tới. Em nào muốn nghe thì bấm
// một nút — và lựa chọn đó được nhớ lại cho những lần sau.

const MUTE_KEY = "larry.voice.muted";

// Đổi trong tab NÀY thì "storage" của trình duyệt không bắn (nó chỉ bắn cho các
// tab khác), nên phải tự phát một sự kiện riêng.
const CHANGE_EVENT = "larry:voice-muted";

/**
 * Đang tắt tiếng?
 *
 * Đọc theo hướng "chỉ 'false' mới là BẬT": chưa từng bấm bao giờ (giá trị null),
 * localStorage bị chặn, hay giá trị rác đều ra TẮT. Viết ngược lại
 * (=== "true") thì mọi trường hợp hỏng đều rơi về BẬT — tức là tự động tiêu tiền
 * khi có gì đó không ổn, đúng cái phải tránh.
 */
export function isVoiceMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) !== "false";
  } catch {
    // Chế độ riêng tư / trình duyệt chặn storage
    return true;
  }
}

/**
 * Đặt lại lựa chọn và báo cho mọi nơi đang nghe.
 * @param {boolean} muted
 */
export function setVoiceMuted(muted) {
  const next = Boolean(muted);

  try {
    localStorage.setItem(MUTE_KEY, String(next));
  } catch {
    /* Không lưu được thì thôi — trong phiên này vẫn tắt/bật được nhờ sự kiện dưới đây */
  }

  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {
    /* Môi trường không có window (test dựng bằng node thuần) */
  }

  return next;
}

/**
 * Nghe mọi thay đổi, kể cả từ tab khác.
 *
 * @param {(muted: boolean) => void} listener
 * @returns {() => void} hàm gỡ listener
 */
export function subscribeVoiceMuted(listener) {
  const onChange = () => listener(isVoiceMuted());

  // Tab khác đổi thì "storage" bắn; tab này đổi thì CHANGE_EVENT bắn. Nghe cả
  // hai để mở app ở hai tab không bị lệch trạng thái nút.
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export { MUTE_KEY, CHANGE_EVENT };
