// Đọc luồng SSE của hệ multi-agent và biến nó thành state cho giao diện.
//
// Dùng fetch + ReadableStream chứ không dùng EventSource: cần POST kèm body và
// header Authorization, hai thứ EventSource không làm được.

import { useCallback, useRef, useState } from "react";
import { CHAT_STREAM_URL } from "../config/api";
import { getAgent, groupLabel, SUPERVISOR_ID } from "../constants/agents";
import { SYSTEM_DOWN_MESSAGE } from "../constants/systemMessages";

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

// Tách chuỗi SSE thành từng sự kiện. Một sự kiện kết thúc bằng dòng trắng.
function parseEventBlock(block) {
  let event = "message";
  const dataLines = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return null;

  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

export function useAgentStream() {
  const [messages, setMessages] = useState([]);
  // Bong bóng đang được viết dở: { agent, text }
  const [streaming, setStreaming] = useState(null);
  // Các bước của lượt hiện tại, để dựng bảng "Đang xử lý"
  const [steps, setSteps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState("");
  // Tri thức agent vừa lấy từ kho để trả lời lượt này:
  // { agent, displayName, icon, color, items: [...], at }
  const [knowledge, setKnowledge] = useState(null);

  const abortRef = useRef(null);
  // Lượt này đã có sự kiện "knowledge" chưa. Lượt supervisor chỉ hỏi khai thác thì
  // không agent nào chạy, nên không có gì được truy hồi — phải nói đúng như vậy
  // thay vì để bảng bên trái giữ nguyên tài liệu của lượt trước.
  const gotKnowledgeRef = useRef(false);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: nextId(), ...msg }]);
  }, []);

  // Đánh dấu bước đang chạy là xong, rồi thêm bước mới
  const pushStep = useCallback((step) => {
    setSteps((prev) => [
      ...prev.map((s) => (s.status === "running" ? { ...s, status: "done" } : s)),
      { key: `s${prev.length}`, status: "done", ...step }
    ]);
  }, []);

  const setStepRunning = useCallback((step) => {
    setSteps((prev) => {
      // Cùng một agent có thể được báo "đang chạy" hai lần: một lần lúc
      // supervisor gọi tới, một lần lúc token đầu tiên của agent đó về.
      // Không chặn thì bảng hiện hai dòng giống hệt nhau.
      const last = prev[prev.length - 1];
      if (last?.status === "running" && last.agent === step.agent) return prev;

      return [
        ...prev.map((s) => (s.status === "running" ? { ...s, status: "done" } : s)),
        { key: `s${prev.length}`, status: "running", ...step }
      ];
    });
  }, []);

  const handleEvent = useCallback(
    ({ event, data }) => {
      if (event === "token") {
        setStreaming((prev) =>
          prev && prev.agent === data.agent
            ? { ...prev, text: prev.text + data.delta }
            : { agent: data.agent, text: data.delta }
        );
        return;
      }

      if (event === "message") {
        // Bong bóng hoàn chỉnh thay cho phần đang viết dở
        setStreaming(null);
        appendMessage({ sender: "ai", ...data });
        return;
      }

      // Agent đã lấy xong tri thức và SẮP viết câu trả lời — bảng tri thức sáng
      // lên trước, để em thấy chỗ dựa trước khi đọc lời khuyên.
      if (event === "knowledge") {
        gotKnowledgeRef.current = true;
        setKnowledge(data);
        return;
      }

      if (event === "trace") {
        switch (data.type) {
          case "supervisor.thinking":
            setStepRunning({
              agent: SUPERVISOR_ID,
              label: "Phân tích cảm xúc và hành vi"
            });
            break;

          case "supervisor.assessment": {
            const groups = (data.groups || []).map(groupLabel).join(" · ");
            pushStep({
              agent: SUPERVISOR_ID,
              label: `Xác định: ${groups || "chưa rõ"}`,
              detail: data.needMoreInfo && !data.urgent ? "chưa đủ thông tin" : "",
              urgent: Boolean(data.urgent),
              ms: data.ms
            });
            break;
          }

          case "supervisor.probe":
            setStepRunning({ agent: SUPERVISOR_ID, label: "Hỏi thêm để hiểu rõ hơn" });
            break;

          // Supervisor KHÔNG tự nói câu thông báo nữa — nó bàn giao tình trạng cho
          // trợ lý chuyên trách, và trợ lý đó mở lời bằng phần này. Bảng vẫn hiện
          // một dòng để thấy rõ đây là một bước có thật, không phải bị bỏ qua.
          case "supervisor.handoff": {
            const groups = (data.added?.length ? data.added : data.groups || []).map(groupLabel);
            pushStep({
              agent: SUPERVISOR_ID,
              label: `Bàn giao tình trạng${groups.length ? `: ${groups.join(" · ")}` : ""}`,
              detail: data.removed?.length
                ? `đã đỡ hơn: ${data.removed.map(groupLabel).join(", ")}`
                : ""
            });
            break;
          }

          case "route": {
            const labels = data.agentLabels || [];
            if (labels.length === 0) break;
            pushStep({
              agent: SUPERVISOR_ID,
              label: `Gọi trợ lý: ${labels.map((a) => `${a.icon} ${a.displayName}`).join(", ")}`,
              isRoute: true
            });
            // Mỗi lượt chỉ một trợ lý — bắt đầu làm việc ngay sau khi được gọi
            setStepRunning({ agent: labels[0].id, label: `${labels[0].displayName} đang trả lời` });
            break;
          }

          // Tình trạng không đổi → vẫn đúng trợ lý lượt trước. Vẫn hiện một dòng
          // để thấy rõ đây là lựa chọn có chủ đích chứ không phải bước bị bỏ qua.
          case "route.keep": {
            const labels = data.agentLabels || [];
            if (labels.length === 0) break;
            pushStep({
              agent: SUPERVISOR_ID,
              label: `Giữ nguyên trợ lý: ${labels
                .map((a) => `${a.icon} ${a.displayName}`)
                .join(", ")}`,
              detail: "tình trạng chưa thay đổi",
              isRoute: true
            });
            setStepRunning({ agent: labels[0].id, label: `${labels[0].displayName} đang trả lời` });
            break;
          }

          // Trợ lý xong phần của mình → hết lượt (mỗi lượt chỉ một trợ lý nói).
          case "agent.done":
            setSteps((prev) =>
              prev.map((s) =>
                s.status === "running" ? { ...s, status: "done", ms: data.ms } : s
              )
            );
            break;

          default:
            break;
        }
        return;
      }

      if (event === "error") {
        setWarning(data.warning || "");
        return;
      }

      if (event === "done") {
        setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      }
    },
    [appendMessage, pushStep, setStepRunning]
  );

  // Token đầu tiên của một agent mới = agent đó bắt đầu nói
  const lastTokenAgent = useRef(null);
  const handleEventWithTyping = useCallback(
    (evt) => {
      if (evt.event === "token" && evt.data.agent !== lastTokenAgent.current) {
        lastTokenAgent.current = evt.data.agent;
        const info = getAgent(evt.data.agent);
        if (evt.data.agent !== SUPERVISOR_ID) {
          setStepRunning({ agent: evt.data.agent, label: `${info.displayName} đang trả lời` });
        }
      }
      handleEvent(evt);
    },
    [handleEvent, setStepRunning]
  );

  /**
   * Chạy một lượt. text rỗng = lượt mở lời, Larry chào trước.
   */
  const runTurn = useCallback(
    async ({ sessionId, text = "", emotion = "", checkin = null, echoUser = true }) => {
      if (busy) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (echoUser && text) {
        appendMessage({ sender: "user", text });
      }

      setBusy(true);
      setWarning("");
      setSteps([]);
      setStreaming(null);
      lastTokenAgent.current = null;
      gotKnowledgeRef.current = false;
      // Xoá tri thức của lượt TRƯỚC ngay khi lượt mới bắt đầu. Bảng bên trái đọc
      // đúng chỗ này để biết mình đang "chờ tra" hay "đã có kết quả của lượt này".
      setKnowledge(null);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(CHAT_STREAM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ sessionId, message: text, emotion, checkin }),
          signal: controller.signal
        });

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Đọc tới đâu vẽ tới đó — đây chính là thứ làm giao diện thấy được
        // từng agent đang làm việc thay vì đợi cả lượt xong mới hiện.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const parsed = parseEventBlock(block);
            if (parsed) handleEventWithTyping(parsed);
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        // Không tự bịa câu trả lời thay Larry — báo đúng là hệ thống đang lỗi
        setStreaming(null);
        appendMessage({
          sender: "ai",
          agent: SUPERVISOR_ID,
          text: SYSTEM_DOWN_MESSAGE
        });
        setWarning(err.message);
      } finally {
        setBusy(false);
        setStreaming(null);
        setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));

        // Không agent nào chạy ở lượt này → kho tri thức không được đụng tới.
        // Ghi nhận rõ ràng bằng một kết quả RỖNG: giữ lại tài liệu của lượt trước
        // là để em tưởng câu vừa rồi cũng dựa vào chúng.
        if (!gotKnowledgeRef.current) {
          setKnowledge({ agent: null, items: [], at: Date.now() });
        }
      }
    },
    [busy, appendMessage, handleEventWithTyping]
  );

  return { messages, streaming, steps, busy, warning, knowledge, runTurn };
}
