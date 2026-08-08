// Nhà máy sinh node cho 4 agent chuyên trách.
//
// Bốn agent chỉ khác nhau ở SYSTEM PROMPT (xem prompts/roles/), còn cơ chế chạy
// thì giống hệt nhau, nên dùng chung một hàm thay vì chép 4 lần.

const { makeLLM } = require("../llm");
const { modelForAgent, agentById } = require("../registry");
const { buildAgentMessages } = require("../prompts/agentPrompt");
const { cleanReply } = require("../supervisor");

function makeAgentNode(agentId) {
  const agent = agentById(agentId);
  if (!agent) throw new Error(`Không có agent "${agentId}" trong registry.`);

  return async function agentNode(state, config) {
    const startedAt = Date.now();

    const llm = makeLLM({
      model: modelForAgent(agentId),
      temperature: 0.6,
      // Nhãn này là thứ giúp lọc token stream về đúng agent nào đang nói
      tags: [agentId]
    });

    // knowledge = các node knowledge graph đã được nạp vào prompt lượt này,
    // đi vào trace để lúc rà lại một câu trả lời còn biết agent đã dựa vào đâu.
    const { messages, knowledge, knowledgeCards } = buildAgentMessages(agentId, state);

    // Phát NGAY, trước khi gọi model: streamMode "updates" chỉ trả về sau khi node
    // chạy xong, nên nếu chỉ để tri thức trong `trace` thì bảng bên trái mãi tới
    // lúc câu trả lời viết xong mới sáng lên — học sinh sẽ đọc xong lời khuyên rồi
    // mới thấy chỗ dựa của nó. Đường "custom" của LangGraph phát được giữa chừng.
    config?.writer?.({
      type: "knowledge.used",
      agent: agentId,
      displayName: agent.displayName,
      icon: agent.icon,
      color: agent.color,
      items: knowledgeCards,
      at: Date.now()
    });

    const res = await llm.invoke(messages);
    const text = cleanReply(res.content);

    return {
      messages: [{ role: "assistant", content: text, agent: agentId }],
      // Tự bỏ mình khỏi hàng đợi → hàng đợi rỗng → lượt kết thúc
      queue: (state.queue || []).filter((id) => id !== agentId),
      // Phần bàn giao đã được nói ra trong chính câu trả lời trên → đóng lại, và
      // ghi nhận em đã được cho biết. Ghi Ở ĐÂY chứ không ở supervisor: đây mới là
      // chỗ câu đó thật sự đến được với em.
      pendingAnnouncement: null,
      ...(state.pendingAnnouncement
        ? {
            announcedGroups: state.activeGroups || [],
            // Tín hiệu nguy hiểm chỉ cộng dồn, không bao giờ gỡ — cùng tinh thần
            // sàn an toàn
            announcedDangers: [
              ...new Set([
                ...(state.announcedDangers || []),
                ...(state.assessment?.dangerSignals || [])
              ])
            ]
          }
        : {}),
      trace: [
        {
          type: "agent.done",
          agent: agentId,
          displayName: agent.displayName,
          knowledge,
          ms: Date.now() - startedAt
        }
      ]
    };
  };
}

module.exports = { makeAgentNode };
