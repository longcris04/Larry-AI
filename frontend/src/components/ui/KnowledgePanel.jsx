import { useState } from "react";
import { EMOTION_CONFIG } from "../../constants/emotions";
import { getAgent } from "../../constants/agents";
import "../../styles/KnowledgePanel.css";

// Bảng "Larry dựa vào đâu" — thay chỗ khung webcam sau khi camera đã nhận diện
// xong cảm xúc.
//
// Việc của nó: mỗi lượt agent trả lời, hiện ĐÚNG những mẩu tài liệu mà agent vừa
// lấy từ kho tri thức để viết câu trả lời đó — nội dung thật, tên tài liệu thật,
// chương mục thật, và lý do mẩu đó được lấy ra. Học sinh (và thầy cô ngồi cạnh)
// nhìn thấy câu trả lời có chỗ dựa, chứ không phải model tự nghĩ ra.
//
// Danh sách này do backend gửi kèm sự kiện SSE "knowledge", phát ra ngay trước
// khi agent bắt đầu viết — nên bảng sáng lên TRƯỚC câu trả lời.

// Vì sao một mẩu được lấy ra, nói bằng lời cho gọn ở đầu thẻ.
function matchLabel(item) {
  if (item.pinned) return "luôn áp dụng";
  if (item.hops === 0) return "khớp lời bạn kể";
  return item.hops === 1 ? "liên hệ 1 bước" : `liên hệ ${item.hops} bước`;
}

function KnowledgeCard({ item }) {
  const [open, setOpen] = useState(false);

  const hasMore = Boolean(item.avoid || item.guidance || item.detail || item.why?.length);

  return (
    <li className={`kg-card ${open ? "kg-card--open" : ""}`}>
      <button
        type="button"
        className="kg-card__main"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasMore}
      >
        <span className="kg-card__chips">
          <span className="kg-card__type">{item.typeLabel}</span>
          <span className="kg-card__match">{matchLabel(item)}</span>
        </span>
        <span className="kg-card__label">{item.label}</span>
        {hasMore && (
          <span className="kg-card__chevron" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
        )}
      </button>

      <p className={`kg-card__summary ${open ? "" : "kg-card__summary--clamp"}`}>
        {item.summary}
      </p>

      {open && (
        <div className="kg-card__more">
          {item.avoid && (
            <p className="kg-card__note kg-card__note--avoid">
              <strong>Điều phải tránh:</strong> {item.avoid}
            </p>
          )}
          {item.guidance && (
            <p className="kg-card__note">
              <strong>Larry được dặn:</strong> {item.guidance}
            </p>
          )}
          {item.detail && <p className="kg-card__note">{item.detail}</p>}
          {item.why?.length > 0 && (
            <p className="kg-card__why">
              <strong>Vì sao Larry mở mẩu này:</strong> {item.why.join(" · ")}
            </p>
          )}
        </div>
      )}

      <p className="kg-card__source" title={item.source?.file || ""}>
        📄 {item.source?.doc}
        {item.source?.part && <span className="kg-card__part"> · {item.source.part}</span>}
      </p>
    </li>
  );
}

export default function KnowledgePanel({ knowledge, busy, emotion }) {
  const items = knowledge?.items || [];
  const agent = knowledge?.agent ? getAgent(knowledge.agent) : null;
  const emotionInfo = emotion ? EMOTION_CONFIG[emotion] : null;

  // Đang chạy mà chưa có kết quả của lượt NÀY (hook đã xoá kết quả lượt trước):
  // supervisor còn đang đánh giá, chưa agent nào tra kho.
  //
  // Kết quả về là hiện ngay, không đợi lượt chạy xong — backend phát khối tri thức
  // trước khi agent viết chữ đầu tiên, nên bảng này sáng lên trước câu trả lời.
  const searching = busy && !knowledge;

  return (
    <section className="knowledge-panel">
      <header className="knowledge-panel__head">
        <h2 className="knowledge-panel__title">📚 Larry dựa vào đâu để trả lời?</h2>
        <p className="knowledge-panel__sub">
          Larry không tự nghĩ ra lời khuyên. Đây là đúng những mẩu tài liệu Larry
          vừa mở trong kho tri thức của nhà trường để viết câu trả lời cho bạn.
        </p>

        {emotionInfo && (
          <p className="knowledge-panel__emotion">
            <span aria-hidden="true">{emotionInfo.icon}</span> Larry đã ghi nhận cảm
            xúc của bạn — camera tắt rồi nhé.
          </p>
        )}
      </header>

      {searching && (
        <div className="knowledge-panel__searching">
          <span className="kg-spinner" aria-hidden="true" />
          <span>Larry đang tra kho tri thức…</span>
        </div>
      )}

      {!searching && items.length > 0 && (
        <p className="knowledge-panel__count" style={{ "--agent-color": agent?.color }}>
          {agent && (
            <span className="knowledge-panel__agent">
              {agent.icon} {agent.displayName}
            </span>
          )}
          đã dùng <strong>{items.length}</strong> mẩu tài liệu cho câu trả lời này
        </p>
      )}

      {!searching && (
        <ol className="knowledge-list" key={knowledge?.at}>
          {items.map((item) => (
            <KnowledgeCard key={item.id} item={item} />
          ))}
        </ol>
      )}

      {!searching && items.length === 0 && (
        <p className="knowledge-panel__empty">
          {/* Không suy đoán vì sao rỗng: có thể Larry đang hỏi thêm, cũng có thể
              đây là chuyện thường ngày không cần tới khung lý thuyết nào. */}
          {knowledge
            ? "Lượt này Larry không mở tài liệu nào trong kho tri thức."
            : "Khi Larry trả lời, những mẩu tài liệu Larry dựa vào sẽ hiện ở đây."}
        </p>
      )}

      {!searching && items.length > 0 && (
        <footer className="knowledge-panel__foot">
          Bấm vào một mẩu để xem Larry được dặn dùng nó thế nào, và vì sao nó được lấy ra.
        </footer>
      )}
    </section>
  );
}
