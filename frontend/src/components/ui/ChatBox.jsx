import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import AgentTrace from "./AgentTrace";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import Message from "./Message";
import ScratchButton from "./ScratchButton";
import SpeakingIndicator from "./SpeakingIndicator";
import TypingIndicator from "./TypingIndicator";
import { useAgentStream } from "../../hooks/useAgentStream";
import { useSpeaker } from "../../hooks/useSpeaker";
import { useVoiceConfig } from "../../hooks/useVoiceConfig";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { SESSION_END_URL } from "../../config/api";

// Mã phiên hội thoại, sinh một lần cho mỗi lần vào màn hình chat.
// Backend dùng nó vừa làm khoá vùng nhớ phiên (cho quản trị viên), vừa làm
// thread_id của graph — tức là toàn bộ trạng thái hệ agent gắn với mã này.
function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// `emotion` là cảm xúc camera đọc được, có thể null. `emotionReady` mới là thứ
// cho biết BƯỚC camera đã xong hay chưa: em không cho quyền camera thì bước đó
// xong với kết quả rỗng, và cuộc trò chuyện vẫn phải mở ra bình thường.
export default function ChatBox({
  emotion,
  emotionReady = true,
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

  // Đọc trong lượt chat (gõ hay nói đều dùng) và gửi kèm lúc chốt phiên — backend
  // cố ý không lưu phiếu check-in xuống file.
  const checkinRef = useRef(checkin);
  const emotionRef = useRef(emotion);
  useEffect(() => {
    checkinRef.current = checkin;
    emotionRef.current = emotion;
  }, [checkin, emotion]);

  // --- Giọng nói ------------------------------------------------------------
  // Backend khai đủ model thì micro và loa mới bật. Thiếu thì mọi thứ dưới đây
  // im lặng rút lui và khung chat gõ chữ chạy đúng như trước.
  const voiceConfig = useVoiceConfig();
  const speaker = useSpeaker({ enabled: voiceConfig.tts });
  const { feed: feedSpeech, stop: stopSpeaking } = speaker;

  // Lời nói đã thành chữ thì đi tiếp y hệt một tin nhắn gõ tay: cùng runTurn,
  // cùng sessionId, cùng cảm xúc và phiếu check-in. runTurn mặc định echoUser nên
  // câu vừa nhận dạng hiện lên thành bong bóng của em — phải THẤY Larry nghe được
  // gì thì lúc model nghe nhầm em mới biết đường nói lại.
  const handleTranscript = useCallback(
    (text) => {
      setInput("");
      runTurn({
        sessionId: sessionIdRef.current,
        text,
        emotion: emotionRef.current || "",
        checkin: checkinRef.current
      });
    },
    [runTurn]
  );

  const voice = useVoiceInput(handleTranscript);

  // Chữ chảy về tới đâu, câu nào xong thì đem đi đọc tới đó.
  //
  // Bám vào bong bóng ĐANG VIẾT DỞ chứ không đợi tin nhắn hoàn chỉnh: đợi xong cả
  // đoạn rồi mới bắt đầu sinh tiếng thì em ngồi nhìn chữ thêm ~10 giây nữa mới
  // nghe thấy gì (endpoint TTS trả nguyên cục, đo được 7–10 giây cho một lượt trả
  // lời cỡ thật). feed() tự lo phần chỉ lấy đoạn MỚI hoàn chỉnh — xem useSpeaker.
  useEffect(() => {
    if (!voiceConfig.tts || !streaming?.text) return;
    feedSpeech(streaming.text);
  }, [streaming, voiceConfig.tts, feedSpeech]);

  // Tin nhắn chốt lại: vét nốt phần đuôi chưa đủ một câu (Larry hay kết bằng emoji
  // hoặc câu hỏi ngắn). Lượt nào không stream token thì đây là lần nạp duy nhất.
  const lastSpokenRef = useRef(null);
  useEffect(() => {
    if (!voiceConfig.tts) return;

    const last = messages[messages.length - 1];
    if (!last || last.sender !== "ai" || last.id === lastSpokenRef.current) return;

    // Đánh dấu TRƯỚC khi gọi: đang tắt tiếng thì feed() lặng lẽ bỏ qua, và tin này
    // coi như đã xử lý xong — bật loa lên giữa chừng không làm Larry đọc dồn lại
    // mấy câu cũ.
    lastSpokenRef.current = last.id;
    feedSpeech(last.text, { flush: true });
  }, [messages, voiceConfig.tts, feedSpeech]);

  // Bắt đầu thu âm thì Larry im ngay: micro đang mở mà loa còn đang đọc thì đoạn
  // thu dính cả giọng Larry, và model nghe sẽ chép lại chính lời của nó.
  useEffect(() => {
    if (voice.isRecording) stopSpeaking();
  }, [voice.isRecording, stopSpeaking]);

  // Dải "đang nói" cũng làm khung chat cao thêm — thiếu nó trong danh sách phụ
  // thuộc thì dải báo hiện ra ngay dưới mép nhìn thấy được và em không thấy.
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, streaming, steps, busy, speaker.speaking]);

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
          // Không có camera thì gửi chuỗi rỗng, đúng như mọi lượt chat đã gửi
          emotion: emotionRef.current || ""
        })
        .catch(() => {
          /* Không chặn điều hướng nếu chốt phiên thất bại */
        });
    };
  }, []);

  // Chờ xong CẢ HAI bước thu thập (camera và phiếu cảm xúc) rồi Larry mới chào, để
  // lời chào đầu tiên đã có sẵn thông tin vừa thu thập. Bước nào không có kết quả
  // thì gửi rỗng — backend đã xử lý được cả hai chỗ trống, và khi không có tín hiệu
  // nào thì Larry hỏi để khai thác cảm xúc ngay trong chat.
  useEffect(() => {
    if (!emotionReady || !checkinReady || greetingSentRef.current) return;

    greetingSentRef.current = true;
    setChatStarted(true);

    // Lượt mở lời: không có tin nhắn nào của học sinh
    runTurn({
      sessionId: sessionIdRef.current,
      text: "",
      emotion: emotion || "",
      checkin
    });
  }, [emotionReady, emotion, checkinReady, checkin, runTurn]);

  const sendMessage = () => {
    if (!input.trim() || busy) return;

    const text = input.trim();
    setInput("");

    // Gửi tin mới khi Larry còn đang đọc câu cũ thì cắt lời ngay, đừng để em ngồi
    // nghe nốt một câu đã cũ trong lúc chờ câu trả lời mới.
    stopSpeaking();

    // Micro vừa lỗi rồi em quay sang gõ: gỡ dòng báo lỗi đi, nó nói về việc đã qua
    voice.clearError();

    runTurn({
      sessionId: sessionIdRef.current,
      text,
      emotion: emotion || "",
      checkin
    });
  };

  // Đang chờ nhưng chưa có chữ nào chạy về → hiện "đang suy nghĩ"
  const showTyping = busy && !streaming;

  // Trợ lý nào đang được đọc thành tiếng — lấy theo bong bóng gần nhất, vì loa
  // luôn đọc tin nhắn mới nhất (lượt mới bắt đầu là tiếng lượt cũ bị cắt).
  const speakingAgent = streaming?.agent ?? messages[messages.length - 1]?.agent;

  return (
    <div className="chat-window">
      <ChatHeader speaker={voiceConfig.tts ? speaker : null} />

      <div ref={chatRef} className="chat-messages">
        {!emotionReady && (
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

        {/* Loa đang phát tiếng của Larry. Tự tắt khi đọc xong đoạn cuối. */}
        {speaker.speaking && <SpeakingIndicator agent={speakingAgent} />}

        {/* Bảng cho thấy agent nào đang làm việc và gọi sang agent nào */}
        <AgentTrace steps={steps} busy={busy} />
      </div>

      {chatStarted && (
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          disabled={busy}
          // Chưa khai STT_MODEL ở backend thì không có nút micro nào được vẽ
          voice={voiceConfig.stt ? voice : null}
        />
      )}

      {chatStarted && <ScratchButton />}
    </div>
  );
}
