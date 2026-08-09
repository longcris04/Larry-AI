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
    const { messages, knowledge, knowledgeCards, coveredGroups, dual } = buildAgentMessages(
      agentId,
      state
    );

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
            // CHỈ ghi nhóm lượt này thực sự có nói tới, không phải toàn bộ
            // activeGroups. Ghi cả activeGroups là lỗi đã đo được: ca em vừa là
            // nạn nhân vừa đánh lại bạn thì chỉ agent nạn nhân nói, nhưng `actor`
            // vẫn bị đánh dấu "đã báo cho em rồi" — từ đó diffGroups không còn thấy
            // gì mới và phần em đánh bạn không bao giờ được nhắc tới nữa.
            announcedGroups: [
              ...new Set([
                ...(state.announcedGroups || []).filter((g) =>
                  (state.activeGroups || []).includes(g)
                ),
                ...coveredGroups
              ])
            ],
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
          // Lượt vai kép: một agent nói nhưng gánh cả hai vế. Ghi vào vết chạy để
          // lúc rà lại còn biết vì sao câu trả lời có cả phần bảo vệ lẫn phần
          // nhìn lại hành vi.
          coveredGroups,
          dual,
          ms: Date.now() - startedAt
        }
      ]
    };
  };
}

module.exports = { makeAgentNode };
