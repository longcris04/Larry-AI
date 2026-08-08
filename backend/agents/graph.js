// Dựng graph LangGraph và giữ một bản compile duy nhất cho cả tiến trình.
//
// Hình dạng graph:
//
//   START → supervisor ─┬─ (hỏi khai thác)  → END
//                       └─ agent duy nhất   → END
//
// Mỗi lượt CHỈ MỘT agent được nói (xem pickAgent trong routing.js), nên `queue`
// trong state có tối đa một phần tử: agent chạy xong tự bỏ mình ra, hàng đợi rỗng
// là hết lượt. Vẫn định tuyến qua queue chứ không nối cứng agent → END, nhờ vậy
// thêm agent mới về sau chỉ cần thêm vào registry, không phải vẽ lại cạnh nào.

const { StateGraph, START, END, MemorySaver } = require("@langchain/langgraph");

const { LarryState } = require("./state");
const { AGENTS } = require("./registry");
const { supervisorNode } = require("./supervisor");
const { makeAgentNode } = require("./nodes/agentNode");

const AGENT_IDS = AGENTS.map((a) => a.id);

// Đích tiếp theo = agent đầu hàng đợi, hết hàng đợi thì kết thúc lượt
function nextInQueue(state) {
  const next = (state.queue || [])[0];
  return next && AGENT_IDS.includes(next) ? next : END;
}

function buildGraph() {
  const builder = new StateGraph(LarryState).addNode("supervisor", supervisorNode);

  for (const id of AGENT_IDS) {
    builder.addNode(id, makeAgentNode(id));
  }

  builder.addEdge(START, "supervisor");
  builder.addConditionalEdges("supervisor", nextInQueue, [...AGENT_IDS, END]);

  // Sau agent lại hỏi cùng một câu: còn ai trong hàng đợi không? (hiện luôn là không)
  for (const id of AGENT_IDS) {
    builder.addConditionalEdges(id, nextInQueue, [...AGENT_IDS, END]);
  }

  return builder;
}

// MemorySaver giữ state theo thread_id (= sessionId) trong bộ nhớ tiến trình.
// Đủ cho demo; restart backend là mất. Nâng cấp: @langchain/langgraph-checkpoint-sqlite.
let compiled = null;

function getGraph() {
  if (!compiled) {
    compiled = buildGraph().compile({ checkpointer: new MemorySaver() });
  }
  return compiled;
}

module.exports = { getGraph, buildGraph, nextInQueue, AGENT_IDS };
