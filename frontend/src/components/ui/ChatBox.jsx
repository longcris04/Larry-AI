import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AgentTrace from "./AgentTrace";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import Message from "./Message";
import ScratchButton from "./ScratchButton";
import TypingIndicator from "./TypingIndicator";
import { useAgentStream } from "../../hooks/useAgentStream";
import { SESSION_END_URL } from "../../config/api";

// Mã phiên hội thoại, sinh một lần cho mỗi lần vào màn hình chat.
// Backend dùng nó vừa làm khoá vùng nhớ phiên (cho quản trị viên), vừa làm
// thread_id của graph — tức là toàn bộ trạng thái hệ agent gắn với mã này.
function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatBox({
  emotion,
  checkin = null,
  checkinReady = true,
  onKnowledge
}) {
  const [input, setInput] = useState("");
  const [chatStarted, setChatStarted] = useState(false);

  const { messages, streaming, steps, busy, knowledge, runTurn } = useAgentStream();

  const chatRef = useRef();
  const greetingSentRef = useRef(false);
  const sessionIdRef = useRef(newSessionId());

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, streaming, steps, busy]);

  // Kho tri thức mà agent vừa tra được hiện ở bảng bên trái (KnowledgePanel), nằm
  // ngoài khung chat — nên đẩy ngược lên cho App giữ.
  useEffect(() => {
    onKnowledge?.({ knowledge, busy });
  }, [knowledge, busy, onKnowledge]);

  // Lịch sử chỉ còn dùng lúc chốt phiên. Trong lượt chat, backend tự giữ hội
  // thoại trong checkpointer nên frontend không phải gửi lại mỗi lần.
  const historyRef = useRef([]);
  useEffect(() => {
    historyRef.current = messages.map((m) => ({
      role: m.sender === "ai" ? "assistant" : "user",
      content: m.text
    }));
  }, [messages]);

  // Gửi kèm lúc chốt phiên, vì backend cố ý không lưu phiếu xuống file
  const checkinRef = useRef(checkin);
  const emotionRef = useRef(emotion);
  useEffect(() => {
    checkinRef.current = checkin;
    emotionRef.current = emotion;
  }, [checkin, emotion]);

  // Rời màn hình chat thì chốt lại bản tóm tắt cuối cùng của phiên
  useEffect(() => {
    const sessionId = sessionIdRef.current;

    return () => {
      const history = historyRef.current;
      // Có phiếu cảm xúc thì vẫn chốt phiên dù học sinh chưa nhắn gì — riêng
      // phiếu cũng đủ để quản trị viên nắm được tình trạng của em.
      if (history.length === 0 && !checkinRef.current) return;

      axios
        .post(SESSION_END_URL, {
          sessionId,
          history,
          checkin: checkinRef.current,
          emotion: emotionRef.current
        })
        .catch(() => {
          /* Không chặn điều hướng nếu chốt phiên thất bại */
        });
    };
  }, []);

  // Chờ học sinh trả lời xong (hoặc bỏ qua) phiếu cảm xúc rồi Larry mới chào,
  // để lời chào đầu tiên đã có sẵn thông tin vừa thu thập.
  useEffect(() => {
    if (!emotion || !checkinReady || greetingSentRef.current) return;

    greetingSentRef.current = true;
    setChatStarted(true);

    // Lượt mở lời: không có tin nhắn nào của học sinh
    runTurn({
      sessionId: sessionIdRef.current,
      text: "",
      emotion,
      checkin
    });
  }, [emotion, checkinReady, checkin, runTurn]);

  const sendMessage = () => {
    if (!input.trim() || busy || !emotion) return;

    const text = input.trim();
    setInput("");

    runTurn({
      sessionId: sessionIdRef.current,
      text,
      emotion,
      checkin
    });
  };

  // Đang chờ nhưng chưa có chữ nào chạy về → hiện "đang suy nghĩ"
  const showTyping = busy && !streaming;

  return (
    <div className="chat-window">
      <ChatHeader />

      <div ref={chatRef} className="chat-messages">
        {!emotion && (
          <p className="waiting-hint">
            👀 Larry đang chờ nhìn thấy bạn qua camera...
          </p>
        )}

        {messages.map((msg, index) => (
          <Message
            key={msg.id}
            index={index}
            sender={msg.sender}
            text={msg.text}
            agent={msg.agent}
            displayName={msg.displayName}
            icon={msg.icon}
            color={msg.color}
          />
        ))}

        {/* Bong bóng đang được viết dở, chữ chạy theo từng token */}
        {streaming && (
          <Message
            sender="ai"
            index={messages.length}
            text={streaming.text}
            agent={streaming.agent}
            streaming
          />
        )}

        {showTyping && <TypingIndicator agent={steps.find((s) => s.status === "running")?.agent} />}

        {/* Bảng cho thấy agent nào đang làm việc và gọi sang agent nào */}
        <AgentTrace steps={steps} busy={busy} />
      </div>

      {chatStarted && (
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          disabled={busy}
        />
      )}

      {chatStarted && <ScratchButton />}
    </div>
  );
}
