import { useEffect, useState } from "react";
import { getAgent } from "../../constants/agents";

// Bảng "Đang xử lý" — cho thấy agent nào đang suy nghĩ, gọi sang agent nào,
// agent nào đang trả lời.
//
// Đây là phần PHỤ của giao diện: đang chạy thì mở, chạy xong thì tự thu lại
// thành một dòng bấm được. Nhân vật chính vẫn là cuộc trò chuyện.
export default function AgentTrace({ steps, busy }) {
  const [open, setOpen] = useState(true);

  // Lượt mới bắt đầu thì mở lại, xong thì thu gọn
  useEffect(() => {
    if (busy) setOpen(true);
    else if (steps.length > 0) {
      const timer = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [busy, steps.length]);

  if (steps.length === 0) return null;

  return (
    <div className={`agent-trace ${busy ? "agent-trace--busy" : ""}`}>
      <button
        type="button"
        className="agent-trace__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="agent-trace__title">
          {busy ? "Larry đang xử lý…" : `Đã xong ${steps.length} bước`}
        </span>
        <span className="agent-trace__toggle" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <ol className="agent-trace__list">
          {steps.map((step) => {
            const info = getAgent(step.agent);
            return (
              <li
                key={step.key}
                className={`agent-trace__step agent-trace__step--${step.status} ${
                  step.isRoute ? "agent-trace__step--route" : ""
                }`}
                style={{ "--agent-color": info.color }}
              >
                <span className="agent-trace__icon" aria-hidden="true">
                  {step.isRoute ? "➜" : info.icon}
                </span>

                <span className="agent-trace__label">
                  {step.label}
                  {step.detail && (
                    <em className="agent-trace__detail"> — {step.detail}</em>
                  )}
                  {step.urgent && (
                    <span className="agent-trace__urgent" title="Cần chú ý ngay">
                      ưu tiên
                    </span>
                  )}
                </span>

                <span className="agent-trace__status">
                  {step.status === "running" ? (
                    <span className="agent-trace__dots" aria-label="đang chạy">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <>
                      {typeof step.ms === "number" && step.ms > 0 && (
                        <span className="agent-trace__ms">{(step.ms / 1000).toFixed(1)}s</span>
                      )}
                      <span aria-label="xong">✓</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
