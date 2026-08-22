// Hàng phân trang dưới các bảng của trang quản trị.
//
// Dùng chung cho bảng tài khoản (AdminPage.jsx) và bảng trường (AdminDashboard.jsx)
// — hai bảng cùng cắt 10 dòng một trang thì phải bấm giống hệt nhau, chứ không
// phải mỗi bảng một kiểu nút và một cách đếm trang.
//
// Vì sao có nút NHẢY ĐẦU/CUỐI và ±5 trang chứ không chỉ Trước/Sau: một trường
// cấp 2 có hàng trăm tài khoản, tức vài chục trang. Chỉ có hai mũi tên thì đi từ
// trang 1 tới cuối bảng là hai mươi cú bấm, mà bảng đang xếp giảm dần thì cuối
// bảng chính là chỗ đáng nhìn (lớp im ắng nhất, tài khoản chưa dùng bao giờ).
//
// Nút ±5 và ô "tới trang" chỉ hiện khi bảng có HƠN 5 trang. Ít hơn thế thì "lùi
// 5 trang" luôn rơi về đúng trang đầu — thành hai cái nút làm cùng một việc,
// đứng cạnh nhau — và gõ một con số rồi bấm Enter còn chậm hơn bấm thẳng vào
// trang mình cần.

import { useState } from "react";

import "../../styles/AdminPage.css";

const JUMP = 5;

/**
 * @param {number}   page     Trang đang xem, đếm từ 0
 * @param {number}   pages    Tổng số trang
 * @param {Function} onPage   Nhận số trang mới (đã kẹp trong khoảng hợp lệ)
 * @param {number}   pageSize Số dòng mỗi trang
 * @param {number}   total    Tổng số dòng sau khi lọc
 * @param {string}   unit     "tài khoản", "trường"… — dùng cho chữ đọc lên
 */
export default function TablePager({ page, pages, onPage, pageSize, total, unit = "dòng" }) {
  // Ô "tới trang" giữ chữ người dùng đang gõ, KHÔNG phải trang đang xem: gõ dở
  // "1" của "12" mà đã nhảy sang trang 1 thì không ai gõ xong được số nào có hai
  // chữ số. Trang chỉ đổi lúc bấm Enter.
  //
  // Khai trước lần return sớm bên dưới — hook phải chạy ở mọi lần render, kể cả
  // lần bảng chỉ có một trang và hàng này không vẽ ra gì.
  const [jumpTo, setJumpTo] = useState("");

  // Một trang thì không vẽ gì. Một hàng mũi tên xám không bấm được ở dưới bảng
  // ba dòng chỉ làm người ta phân vân.
  if (pages <= 1) return null;

  const go = (target) => onPage(Math.max(0, Math.min(pages - 1, target)));

  /**
   * Enter trong ô "tới trang".
   *
   * Là <form> chứ không phải onKeyDown="Enter": trình duyệt tự lo phần Enter,
   * bàn phím điện thoại hiện luôn phím "Go" thay vì phím xuống dòng, và nút mũi
   * tên bên cạnh chỉ cần type="submit" là chạy đúng cùng một đường.
   *
   * Số ngoài khoảng thì KẸP như hai nút ±5, không phải báo lỗi: gõ 999 ở bảng 9
   * trang nghĩa là "cho tôi tới cuối", chứ không phải gõ nhầm cần bị chặn lại.
   */
  const submitJump = (event) => {
    event.preventDefault();

    const target = parseInt(jumpTo, 10);
    if (!Number.isFinite(target)) return; // ô trống, hoặc gõ mỗi dấu trừ

    go(target - 1); // người đọc đếm trang từ 1, mã đếm từ 0

    // Xoá ô sau khi nhảy: giữ lại con số vừa gõ thì lát nữa bấm "Sau →" vài lần,
    // ô vẫn trưng một số không còn liên quan tới trang đang xem.
    setJumpTo("");
  };

  const atStart = page === 0;
  const atEnd = page >= pages - 1;
  const showJump = pages > JUMP;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="admin-pager" role="group" aria-label={`Phân trang bảng ${unit}`}>
      <button
        type="button"
        className="admin-btn admin-btn--sm admin-btn--ghost"
        disabled={atStart}
        onClick={() => go(0)}
        aria-label="Về trang đầu"
        title="Về trang đầu"
      >
        ⏮ Đầu
      </button>

      {showJump && (
        <button
          type="button"
          className="admin-btn admin-btn--sm admin-btn--ghost"
          disabled={atStart}
          onClick={() => go(page - JUMP)}
          aria-label={`Lùi ${JUMP} trang`}
          title={`Lùi ${JUMP} trang`}
        >
          «{JUMP}
        </button>
      )}

      <button
        type="button"
        className="admin-btn admin-btn--sm admin-btn--ghost"
        disabled={atStart}
        onClick={() => go(page - 1)}
        aria-label={`Trước — ${pageSize} ${unit} trước đó`}
      >
        ← Trước
      </button>

      {/* Vừa số trang vừa khoảng dòng: "trang 3/9" nói mình đang ở đâu trong
          bảng, "đang xem 21–30 trong 87" nói bảng còn bao nhiêu nữa. Thiếu vế
          sau thì bấm tới trang cuối mới biết bảng dài cỡ nào. */}
      <span className="admin-pager__info" aria-live="polite">
        Trang <strong>{page + 1}</strong> / {pages}
        <span className="admin-muted">
          {" "}
          · đang xem {from}–{to} trong {total}
        </span>
      </span>

      <button
        type="button"
        className="admin-btn admin-btn--sm admin-btn--ghost"
        disabled={atEnd}
        onClick={() => go(page + 1)}
        aria-label={`Sau — ${pageSize} ${unit} tiếp theo`}
      >
        Sau →
      </button>

      {showJump && (
        <button
          type="button"
          className="admin-btn admin-btn--sm admin-btn--ghost"
          disabled={atEnd}
          onClick={() => go(page + JUMP)}
          aria-label={`Tiến ${JUMP} trang`}
          title={`Tiến ${JUMP} trang`}
        >
          {JUMP}»
        </button>
      )}

      <button
        type="button"
        className="admin-btn admin-btn--sm admin-btn--ghost"
        disabled={atEnd}
        onClick={() => go(pages - 1)}
        aria-label="Tới trang cuối"
        title="Tới trang cuối"
      >
        Cuối ⏭
      </button>

      {/* Đứng CUỐI hàng, sau mọi cái nút: hàng này đang đối xứng (lùi · đang ở
          đâu · tiến), chèn một ô nhập vào giữa là cắt đôi cái đối xứng đó.

          aria-label của <form> KHÔNG chỉ để trang trí: một form chỉ được trình
          đọc màn hình gọi tên (và chỉ mang role="form") khi nó có tên riêng —
          không có thì cả cụm này chỉ là mấy ô rời rạc nằm cuối một hàng nút. */}
      {showJump && (
        <form
          className="admin-pager__jump"
          aria-label="Chuyển nhanh tới trang"
          onSubmit={submitJump}
        >
          <label>
            Tới trang
            {/* placeholder gợi ý KHOẢNG hợp lệ, không phải trang đang xem: một
                số mờ mờ trùng đúng số trang hiện tại trông y như ô đã có sẵn giá
                trị, và người dùng sẽ tưởng mình chẳng cần gõ gì. */}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={pages}
              value={jumpTo}
              onChange={(e) => setJumpTo(e.target.value)}
              placeholder={`1–${pages}`}
              aria-label={`Tới trang số — gõ số từ 1 tới ${pages} rồi bấm Enter`}
              title={`Gõ số trang (1–${pages}) rồi bấm Enter`}
            />
          </label>

          {/* Enter đã chạy rồi, nhưng không có gì trên màn hình NÓI ra điều đó —
              nút này vừa là chỗ bấm cho người dùng chuột và cảm ứng, vừa là lời
              nhắc rằng ô bên cạnh dẫn đi đâu đó. */}
          <button
            type="submit"
            className="admin-btn admin-btn--sm admin-btn--ghost"
            aria-label="Tới trang vừa gõ"
          >
            Tới →
          </button>
        </form>
      )}
    </div>
  );
}
