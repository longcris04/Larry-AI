// Lớp mỏng giữa Express và graph.
//
// Việc của nó: nhận một lượt của học sinh, chạy graph, và phát ra một CHUỖI SỰ
// KIỆN đã chuẩn hoá. Nhờ vậy route SSE và route JSON dùng chung đúng một luồng,
// và giao diện không phải biết gì về chi tiết bên trong LangGraph.

const { getGraph } = require("./graph");
const { agentById, SUPERVISOR_ID } = require("./registry");

// Trạng thái ban đầu chỉ được nạp một lần cho mỗi thread. Các lượt sau chỉ gửi
// tin nhắn mới — phần còn lại checkpointer đã giữ.
function buildInput({ text, sessionId, student, checkin, cameraEmotion, isFirstTurn }) {
  const input = {
    messages: text ? [{ role: "user", content: text, agent: null }] : []
  };

  if (isFirstTurn) {
    input.sessionId = sessionId;
    input.student = student || {};
  }

  // Phiếu và cảm xúc camera gửi lại mỗi lượt cũng không sao — reducer là ghi đè,
  // và camera có thể cập nhật giữa chừng.
  if (checkin !== undefined) input.checkin = checkin;
  if (cameraEmotion) input.cameraEmotion = cameraEmotion;

  return input;
}

function threadConfig(sessionId) {
  return { configurable: { thread_id: sessionId } };
}

async function hasThread(sessionId) {
  try {
    const snapshot = await getGraph().getState(threadConfig(sessionId));
    return Boolean(snapshot?.values?.sessionId);
  } catch {
    return false;
  }
}

/**
 * Chạy một lượt và phát sự kiện qua callback.
 *
 * @param {function} emit  (eventName, payload) => void
 * @returns {object} tóm tắt lượt vừa chạy, để lưu phiên và trả về cho route JSON
 */
async function runTurn(
  { sessionId, text = "", student = {}, checkin = null, cameraEmotion = "", streamTokens = true },
  emit = () => {}
) {
  const graph = getGraph();
  const config = threadConfig(sessionId);
  const isFirstTurn = !(await hasThread(sessionId));

  const input = buildInput({ text, sessionId, student, checkin, cameraEmotion, isFirstTurn });

  const replies = [];
  let groups = [];
  let routedAgents = [];
  let knowledge = null;

  // Phát ngay để giao diện có gì đó hiện lên từ giây đầu tiên. Supervisor thật
  // sự bắt đầu làm việc từ lúc này; nếu đợi node trả kết quả mới phát thì học
  // sinh nhìn màn hình trống suốt mấy giây đầu của mỗi lượt.
  emit("trace", { type: "supervisor.thinking", agent: SUPERVISOR_ID, at: Date.now() });

  // "custom" là đường để node phát sự kiện NGAY GIỮA lúc đang chạy, không phải đợi
  // chạy xong như "updates". Hiện chỉ agent node dùng, để đẩy khối tri thức vừa
  // truy hồi lên giao diện trước khi nó bắt đầu viết câu trả lời.
  const streamMode = streamTokens
    ? ["updates", "messages", "custom"]
    : ["updates", "custom"];
  const stream = await graph.stream(input, { ...config, streamMode });

  for await (const chunk of stream) {
    // streamMode dạng mảng thì mỗi chunk là [mode, payload]
    const [mode, payload] = Array.isArray(chunk) ? chunk : ["updates", chunk];

    if (mode === "custom") {
      if (payload?.type === "knowledge.used") {
        knowledge = payload;
        emit("knowledge", payload);
      }
      continue;
    }

    if (mode === "messages") {
      // [messageChunk, metadata] — token đang được sinh ra
      const [messageChunk, metadata] = payload;
      const nodeId = metadata?.langgraph_node;
      const delta = typeof messageChunk?.content === "string" ? messageChunk.content : "";

      // Bước phân nhóm không phải lời nói với học sinh, không được stream ra
      const isAssessing = (metadata?.tags || []).includes("assess");
      if (delta && nodeId && !isAssessing) {
        emit("token", { agent: nodeId, delta });
      }
      continue;
    }

    for (const [node, update] of Object.entries(payload || {})) {
      for (const t of update.trace || []) {
        if (t.type === "supervisor.assessment") {
          groups = t.groups || [];
        }
        // "route" = phân luồng lại, "route.keep" = giữ nguyên agent lượt trước.
        // Cả hai đều cho biết agent nào sắp nói, nên xử lý chung.
        if (t.type === "route" || t.type === "route.keep") {
          routedAgents = t.agents || [];
          emit("trace", {
            ...t,
            // Kèm sẵn nhãn hiển thị để frontend khỏi phải tra ngược
            agentLabels: routedAgents.map((id) => {
              const a = agentById(id);
              return { id, displayName: a?.displayName, icon: a?.icon, color: a?.color };
            })
          });
          continue;
        }
        emit("trace", t);
      }

      for (const m of update.messages || []) {
        if (m.role !== "assistant" || !m.content) continue;
        const agent = m.agent || node || SUPERVISOR_ID;
        const info = agentById(agent);
        const message = {
          agent,
          displayName: info?.displayName || "Larry",
          icon: info?.icon || "🤖",
          color: info?.color || "#7c3aed",
          text: m.content
        };
        replies.push(message);
        emit("message", message);
      }
    }
  }

  const snapshot = await graph.getState(config);
  const values = snapshot?.values || {};

  return {
    replies,
    groups: values.activeGroups || groups,
    routedAgents,
    // Tri thức agent đã dựa vào ở lượt này; null nghĩa là lượt này không agent nào
    // chạy (supervisor hỏi khai thác) nên không có gì được truy hồi.
    knowledge,
    assessment: values.assessment || null,
    // Lịch sử dạng phẳng để summarizer.js dùng lại y như trước
    history: (values.messages || []).map(({ role, content }) => ({ role, content }))
  };
}

module.exports = { runTurn, hasThread, threadConfig };
