// Ghép system prompt hoàn chỉnh cho một agent chuyên trách.
//
// Khung cố định, chỉ khác nhau ở khối VAI TRÒ:
//   PERSONA → VAI TRÒ RIÊNG → SAFETY_RULES → GAME_RULES → NGỮ CẢNH → PHẠM VI
//
// SAFETY_RULES áp cho MỌI agent, kể cả agent trò chuyện thường ngày. Không có ngoại lệ.

const {
  PERSONA,
  SAFETY_RULES,
  ADVICE_FLOW,
  GAME_RULES,
  hasEmergencySignal,
  renderStudent,
  renderCamera,
  renderCheckin,
  renderNoEmotionSignal,
  renderDanger,
  renderTranscript,
  joinBlocks
} = require("./shared");

const { agentById, GROUP_LABELS } = require("../registry");

const { retrieve } = require("../../knowledge/retrieve");
const { selectForPrompt, summarizeItems, presentItems } = require("../../knowledge/render");

const ROLES = {
  agent_self_harm: require("./roles/selfHarm"),
  agent_victim: require("./roles/victim"),
  agent_actor: require("./roles/actor"),
  agent_homeroom: require("./roles/homeroom")
};

// Mỗi lượt CHỈ MỘT agent trả lời (xem pickAgent trong routing.js). Không có ai
// nói tiếp sau bạn — nên câu trả lời phải trọn vẹn, và phải biết rõ đâu là phần
// của mình khi supervisor còn ghi nhận nhóm khác ở em.
function renderScope(state, agentId) {
  const me = agentById(agentId);

  const others = (state.activeGroups || [])
    .filter((g) => g !== me?.group)
    .map((g) => GROUP_LABELS[g] || g);

  const mine = `PHẠM VI CỦA BẠN — trong lượt này bạn là phần DUY NHẤT của Larry trả lời em.
  Không có ai nói tiếp sau bạn, nên câu trả lời phải TRỌN VẸN: có nội dung thật
  thuộc chuyên môn của bạn, rồi kết bằng MỘT câu hỏi mở để em kể tiếp.
  Trọng tâm của bạn: ${me?.domain || "phần chuyên môn của bạn"}.`;

  if (others.length === 0) return mine;

  // Nhiều nhóm cùng bật thì nhóm ưu tiên cao nhất được trả lời, phần còn lại đợi.
  // Vẫn phải cho agent biết chúng tồn tại: em đã được thông báo về CẢ các nhóm đó,
  // im lặng hoàn toàn về chúng khiến em tưởng mình vừa kể mà không ai nghe.
  return `${mine}

  Supervisor còn ghi nhận ở em: ${others.join(", ")}.
  Những phần đó KHÔNG thuộc lượt này của bạn. Được phép ghi nhận NGẮN GỌN một câu
  để em thấy bạn có nghe, nhưng KHÔNG đi sâu, KHÔNG hỏi thêm về chúng, KHÔNG lấy
  chúng làm nội dung chính. Nếu chuyện đó nổi lên thành điều quan trọng nhất,
  supervisor sẽ giao lại cho đúng phần Larry phụ trách nó ở lượt sau.`;
}

// Cách nói với em về từng nhóm, chuyển từ bước thông báo của supervisor sang đây
// khi supervisor thôi tự nói (§6.3). Nội dung giữ nguyên: đây là phần đã được cân
// nhắc kỹ nhất, nhất là nhóm `actor`.
const GROUP_ANNOUNCE_GUIDE = {
  self_harm: `- Cho em biết bạn nhận thấy em đang làm đau chính cơ thể mình khi buồn
    (hoặc đang có ý nghĩ muốn biến mất). Giọng thương, KHÔNG hoảng hốt, KHÔNG trách.
    Cho em biết bạn rất mừng vì em đã kể ra.`,

  victim: `- Nói rõ rằng qua những gì em kể, em ĐANG LÀ NẠN NHÂN của bạo lực học đường.
    Khẳng định ngay: đây KHÔNG PHẢI LỖI CỦA EM, và không ai đáng bị đối xử như vậy.`,

  actor: `- Đây là phần KHÓ NHẤT, phải rất cẩn thận.
    TUYỆT ĐỐI KHÔNG dán nhãn: "kẻ bắt nạt", "người gây bạo lực", "em là người xấu".
    Chỉ mô tả HÀNH VI: "mình nhận thấy có những lúc em đã làm bạn khác bị tổn thương".
    Giọng bình tĩnh, không buộc tội, không mắng, nhưng cũng KHÔNG dung túng — cho em
    biết bạn muốn cùng em nhìn lại chuyện đó, và bạn vẫn ở đây với em.`,

  general: `- Không cần trang trọng. Chỉ cần nói tự nhiên rằng bạn đã hiểu chuyện em
    đang gặp và sẽ cùng em nói tiếp về nó.`
};

// Khối BÀN GIAO — thay cho đoạn thông báo mà supervisor từng tự nói.
//
// Vì sao chuyển sang agent: hai bong bóng liên tiếp (supervisor thông báo rồi agent
// tư vấn) nói gần như cùng một nội dung mở đầu, và em có cảm giác bị chuyển máy
// giữa cuộc gọi. Nay em chỉ nghe MỘT giọng mỗi lượt, và chính người sẽ đồng hành
// với em là người nói cho em biết chuyện gì đang xảy ra.
// Em mới chào đúng một câu, chưa kể gì, lại không có phiếu và không có camera —
// nghĩa là CHƯA CÓ tình trạng nào để bàn giao. Không tách riêng ca này thì agent mở
// lời bằng "mình đã nắm được tình hình của bạn rồi" trong khi em chưa kể gì cả, và
// em nhận ra ngay là Larry nói suông. Đây chính là ca xảy ra khi em không cho phép
// dùng camera và cũng bỏ qua phiếu cảm xúc.
function nothingKnownYet(state) {
  const a = state.assessment;
  const groups = state.activeGroups || [];

  return (
    !a?.dangerSignals?.length &&
    !a?.emotions?.length &&
    !a?.behaviors?.length &&
    !state.checkin &&
    !state.cameraEmotion &&
    groups.length === 1 &&
    groups[0] === "general"
  );
}

function renderHandoff(state) {
  const pending = state.pendingAnnouncement;
  if (!pending) return "";

  if (nothingKnownYet(state)) {
    return `🔔 LƯỢT LÀM QUEN — EM CHƯA KỂ GÌ VỀ MÌNH

  Larry vừa giao em cho bạn, nhưng đến giờ em mới chỉ chào hỏi: chưa có chuyện nào
  được kể, không có phiếu cảm xúc, cũng không có cảm xúc camera.

  Vì vậy lượt này TUYỆT ĐỐI KHÔNG nói những câu kiểu "mình đã hiểu chuyện của bạn rồi",
  "mình đã nắm được tình hình của bạn", "mình sẽ cùng bạn vượt qua chuyện này" — em
  chưa kể gì để bạn hiểu cả, nói vậy là nói suông và em nhận ra ngay.

  Hãy làm đúng ba việc, gọn trong 2-3 câu:
  1. Chào lại em thật tự nhiên và vui vẻ, bằng lời của bạn — KHÔNG chép lại câu Larry
     vừa nói ở trên, em vừa đọc nó xong rồi.
  2. Một câu ngắn cho em biết bạn ở đây để nghe em kể bất cứ chuyện gì.
  3. Hỏi MỘT câu mở về hôm nay của em, để em bắt đầu kể.`;
  }

  const { added = [], removed = [], dangerSignals = [], groups = [] } = pending;
  const firstTime = (state.announcedGroups || []).length === 0;

  // Bốn nhóm không phủ hết mọi chuyện nguy hiểm: bị dụ dỗ, bị xâm hại, bị bạo hành
  // ở nhà đều rơi vào "general". Theo hướng dẫn thường của "general" thì đúng ca
  // nguy hiểm nhất lại được nói qua loa nhất.
  const guide = dangerSignals.length
    ? `- Chuyện em đang gặp là chuyện NGHIÊM TRỌNG và em cần được người lớn bảo vệ.
    Cho em biết bạn đã nghe rõ và bạn rất coi trọng điều em kể. Nói rõ ĐÂY KHÔNG PHẢI
    LỖI CỦA EM, và em đã rất dũng cảm khi kể ra. KHÔNG dùng từ chuyên môn ("xâm hại",
    "dụ dỗ", "bạo hành") — mô tả bằng lời trẻ hiểu được, bám đúng điều em vừa kể.
    TUYỆT ĐỐI KHÔNG mở lời bằng lời khen em đang vui.`
    : (firstTime ? groups : added.length ? added : groups)
        .map((g) => GROUP_ANNOUNCE_GUIDE[g])
        .filter(Boolean)
        .join("\n");

  const repeatNote = firstTime
    ? ""
    : `  Em ĐÃ từng được cho biết về: ${(state.announcedGroups || []).join(", ")}.
  Lần này CHỈ nói phần MỚI, mở bằng ý "mình còn nhận thấy thêm một điều nữa…".
  KHÔNG kể lại từ đầu, KHÔNG lặp lại các câu đã nói lần trước.`;

  const removedNote = removed.length
    ? `  Có tình trạng đã ĐỠ HƠN so với trước (${removed.join(", ")}). Ghi nhận tiến bộ
  đó một cách chân thành, nhưng KHÔNG nói kiểu "vậy là em hết bị bắt nạt rồi nhé" —
  chuyện có thể quay lại; nói rằng bạn vẫn luôn ở đây nếu em cần.`
    : "";

  return `🔔 BÀN GIAO — LƯỢT NÀY BẠN PHẢI MỞ LỜI BẰNG VIỆC CHO EM BIẾT TÌNH TRẠNG

  Larry vừa xác định được tình trạng của em và giao lại cho bạn. KHÔNG có ai nói
  trước bạn trong lượt này, nên chính bạn là người cho em biết — bằng 1-2 câu ở ĐẦU
  câu trả lời, rồi đi tiếp vào phần chuyên môn của mình.

  Cách nói:
${guide}
${repeatNote}
${removedNote}

  QUY TẮC:
  - Gộp vào cùng MỘT tin nhắn với phần tư vấn. Không viết thành đoạn thông báo riêng.
  - Không dùng từ chuyên môn tâm lý, không nhắc "nhóm", "phân loại", "hệ thống".
  - Kèm một câu cho em biết em không đơn độc và bạn sẽ ở đây cùng em.`;
}

// Bốn bước "gọi tên → giải thích → phân loại → dạy các bước" (§ADVICE_FLOW) chỉ
// đúng ở LẦN ĐẦU agent này nói với em. Lượt sau mà lặp lại thì thành bài giảng:
// em vừa hỏi một chuyện cụ thể lại bị nghe lại định nghĩa bạo lực học đường.
//
// Chốt bằng CODE chứ không để model tự suy từ transcript: model nhỏ đọc lịch sử
// dài rất hay nhận nhầm lượt, và nhầm về phía "kể lại từ đầu" nhiều hơn.
function renderAdviceStage(state, agentId) {
  const spokeBefore = (state.messages || []).some(
    (m) => m.role === "assistant" && m.agent === agentId
  );

  // Đã nói rồi NHƯNG vừa có tình trạng mới được bàn giao: phần cũ thì không kể lại,
  // phần mới thì vẫn phải giới thiệu đủ. Không tách riêng trường hợp này thì hai
  // khối đòi hai kiểu mở lời khác nhau và model làm theo cái nó đọc sau.
  if (spokeBefore && state.pendingAnnouncement) {
    return `GIAI ĐOẠN: bạn đã đồng hành với em từ các lượt trước, nhưng lượt này có
  tình trạng MỚI vừa được bàn giao (xem khối BÀN GIAO ở trên).
  Với phần MỚI: gọi tên và nói ngắn gọn cho em hiểu, rồi dạy bước ứng với nó.
  Với phần CŨ: không kể lại, không định nghĩa lại — em nghe rồi.`;
  }

  if (!spokeBefore) {
    return `GIAI ĐOẠN: đây là LẦN ĐẦU phần Larry này trả lời em trong phiên.
  Nếu khối tri thức có khái niệm khớp với chuyện em kể thì đi ĐỦ BỐN BƯỚC ở khối
  "CÁCH ĐƯA LỜI KHUYÊN": gọi tên → giải thích ngắn → phân loại dạng và mức → dạy
  các bước cụ thể. Được phép dài hơn thường lệ (tối đa 8 câu) để nói đủ bốn bước.`;
  }

  return `GIAI ĐOẠN: bạn ĐÃ trả lời em ở các lượt trước trong phiên này.
  KHÔNG gọi tên lại, KHÔNG định nghĩa lại, KHÔNG phân loại lại — em nghe rồi.
  Đi thẳng vào điều em vừa nói: gỡ đúng chỗ em đang mắc, đào sâu một bước đã dạy,
  hoặc hỏi xem em đã làm được bước nào chưa.`;
}

// Nhắc lại ở cuối phần user — vị trí model chú ý nhất. Nội dung phải khớp với
// nhánh mà renderDanger() đã chọn, nếu không hai chỗ sẽ đòi hai kiểu trả lời khác
// nhau và model làm theo cái nó đọc sau cùng.
function renderFinalReminder({ danger, emergency, noEmotionSignal }) {
  // Không phiếu, không camera: cấm đoán cảm xúc cũng phải được nhắc ở đây. Đây là
  // lỗi đã thấy thật khi chạy thử — agent mở lời "mình biết bạn đang gặp chuyện buồn"
  // với một em vừa mới chào đúng một câu.
  const noGuessing = noEmotionSignal
    ? `KHÔNG ĐOÁN CẢM XÚC: em chưa cho biết em đang thấy thế nào, nên câu trả lời KHÔNG
  được chứa nhận xét nào về tâm trạng của em. Chỉ nói về cảm xúc mà CHÍNH EM đã kể;
  chưa có thì hỏi một câu trung tính về hôm nay của em.`
    : "";

  if (!danger) return noGuessing;

  // Nhắc về an toàn đứng SAU CÙNG — nó quan trọng hơn, và chỗ cuối là chỗ model đọc kỹ nhất
  const dangerReminder = emergency
    ? `NHẮC LẠI: đây là tình huống KHẨN CẤP. Không khen em đang vui.
  Phải nói đủ ba ý: không phải lỗi của em → nói với người lớn tin cậy → tổng đài 111.`
    : `NHẮC LẠI: đây là bạo lực học đường. Không khen em đang vui.
  Đừng dừng ở trấn an: gọi tên chuyện đang xảy ra, cho em biết nó là dạng nào,
  rồi dạy em các bước tự bảo vệ lấy từ khối tri thức, và hướng em nói với thầy cô
  hoặc bố mẹ. CHỈ nhắc tổng đài 111 nếu em bị thương tích, bị đe doạ, bị trấn lột,
  hoặc em nói em sợ cho an toàn thân thể của mình.`;

  return joinBlocks(noGuessing, dangerReminder);
}

function renderAssessment(assessment, activeGroups, { pendingAnnouncement = null, skip = false } = {}) {
  // Chưa biết gì về em thì khối này chỉ còn đúng dòng "tình trạng: chuyện thường
  // ngày" kèm lời dặn đi thông báo cho em — hai thứ đều sai ở lượt làm quen.
  if (skip || !assessment) return "";

  const lines = [];
  if (assessment.emotions?.length) {
    lines.push(`- Cảm xúc nhận thấy: ${assessment.emotions.join(", ")}.`);
  }
  if (assessment.behaviors?.length) {
    lines.push(`- Hành vi/biểu hiện: ${assessment.behaviors.join("; ")}.`);
  }
  if (activeGroups?.length) {
    const labels = activeGroups.map((g) => GROUP_LABELS[g] || g);
    lines.push(`- Tình trạng đã xác định: ${labels.join(" + ")}.`);
  }

  if (lines.length === 0) return "";

  const note = pendingAnnouncement
    ? `  Học sinh CHƯA được cho biết tình trạng này — chính bạn phải nói cho em ở lượt
  này, theo khối BÀN GIAO ở đầu prompt.`
    : `  Học sinh ĐÃ được cho biết về tình trạng này rồi, nên bạn không cần thông báo lại.
  Hãy đi thẳng vào việc đồng hành và tư vấn.`;

  return `TÌNH TRẠNG ĐÃ XÁC ĐỊNH ĐƯỢC QUA TRÒ CHUYỆN:
${lines.join("\n")}

${note}`;
}

// Tri thức chuyên môn lấy từ knowledge graph, lọc theo đúng lời em vừa kể và
// đánh giá của supervisor. Xem backend/knowledge/README.md.
//
// Khối VAI TRÒ ở trên là thứ CỐ ĐỊNH cho mọi lượt của agent — nó nói agent này
// là ai và cấm những gì. Khối này thì đổi theo từng lượt: nó mang vào phần lý
// thuyết và kỹ thuật ứng với đúng chuyện em đang kể, thứ không thể nhét hết vào
// prompt tĩnh vì tài liệu gốc dài hơn cửa sổ ngữ cảnh nhiều lần.
//
// Truy hồi hỏng KHÔNG được làm hỏng cả lượt trả lời: agent thiếu tri thức bổ
// sung vẫn chạy được bằng khối vai trò, còn ném lỗi ở đây thì em không nhận
// được câu trả lời nào.
//
// Trả về ba thứ từ CÙNG một lần chọn, nên cả ba luôn khớp nhau:
//   block  khối chèn vào prompt
//   items  bản gọn ghi vào vết chạy của phiên
//   cards  bản đầy đủ (nội dung + nguồn + lý do) gửi lên bảng tri thức của giao diện
function renderKnowledge(agentId, state) {
  try {
    const result = retrieve(agentId, {
      assessment: state.assessment,
      messages: state.messages
    });

    const { block, kept } = selectForPrompt(result.items);

    return {
      block,
      items: summarizeItems(kept.map((k) => k.item)),
      cards: presentItems(kept)
    };
  } catch (err) {
    console.error(`[knowledge] truy hồi lỗi cho ${agentId}:`, err.message);
    return { block: "", items: [], cards: [] };
  }
}

/**
 * @param {string} agentId  id trong registry, ví dụ "agent_victim"
 * @param {object} state    state hiện tại của graph
 * @returns {{messages: Array, knowledge: Array, knowledgeCards: Array}}
 *          messages        truyền thẳng cho LLM
 *          knowledge       bản tóm tắt các node đã truy hồi, để ghi vào trace
 *          knowledgeCards  bản đầy đủ để hiện lên bảng tri thức của giao diện
 */
function buildAgentMessages(agentId, state) {
  const role = ROLES[agentId];
  if (!role) throw new Error(`Không có prompt cho agent "${agentId}".`);

  // Không có khối này, agent rất hay trả lời cụt lủn bằng đúng một câu hỏi —
  // nhất là khi supervisor vừa nói một đoạn thông báo dài ngay trước đó.
  const SUBSTANCE_RULE = `MỖI LƯỢT TRẢ LỜI PHẢI CÓ NỘI DUNG, KHÔNG ĐƯỢC CHỈ HỎI TRỐNG:
  - Câu trả lời chỉ gồm đúng một câu hỏi là KHÔNG ĐẠT.
  - Luôn phải có phần ghi nhận/đồng hành/tư vấn thuộc chuyên môn của bạn TRƯỚC,
    rồi mới đến câu hỏi ở cuối.
  - Phần thông báo mà Larry vừa nói ở trên KHÔNG tính là phần của bạn. Đừng vì nó
    đã nói rồi mà bỏ trống phần mình.`;

  // Cảnh báo an toàn đặt NGAY ĐẦU system prompt: model nhỏ đọc lướt phần giữa của
  // prompt dài, chỉ dẫn chôn ở cuối gần như bị bỏ qua.
  const dangerSignals = state.assessment?.dangerSignals || [];
  const danger = renderDanger(dangerSignals);
  const emergency = hasEmergencySignal(dangerSignals);

  const knowledge = renderKnowledge(agentId, state);

  const system = joinBlocks(
    // Cảnh báo an toàn đứng trước tất cả
    danger,
    // Rồi tới việc phải mở lời thế nào ở lượt này — thứ quyết định câu đầu tiên
    renderHandoff(state),
    PERSONA,
    role,
    SUBSTANCE_RULE,
    ADVICE_FLOW,
    renderAdviceStage(state, agentId),
    SAFETY_RULES,
    GAME_RULES,
    renderStudent(state.student),
    renderCheckin(state.checkin),
    renderCamera(state.cameraEmotion),
    renderAssessment(state.assessment, state.activeGroups, {
      pendingAnnouncement: state.pendingAnnouncement,
      skip: nothingKnownYet(state)
    }),
    // Đặt sát cuối, ngay trước khối PHẠM VI: model nhỏ chú ý phần đầu và phần
    // cuối của prompt dài, chôn khối này vào giữa là coi như không có.
    knowledge.block,
    // Không phiếu, không camera → chính agent này phải khai thác cảm xúc bằng hỏi
    // đáp. Supervisor có thể đã bàn giao sớm (chuyện thường ngày đã rõ nhóm từ lượt
    // đầu) nên không thể trông vào mỗi bước hỏi khai thác của nó.
    renderNoEmotionSignal(state),
    renderScope(state, agentId)
  );

  const user = joinBlocks(
    `CUỘC TRÒ CHUYỆN ĐẾN LÚC NÀY:\n${renderTranscript(state.messages, { withAgentLabels: false })}`,
    `Hãy viết tin nhắn tiếp theo của Larry theo đúng vai trò chuyên trách của bạn.
  Chỉ viết nội dung Larry nói. Không ghi "Larry:", không lặp lại lịch sử,
  không giải thích bạn đang làm gì.`,
    // Nhắc lại ở vị trí cuối cùng — chỗ model chú ý nhất
    renderFinalReminder({
      danger: Boolean(danger),
      emergency,
      noEmotionSignal: Boolean(renderNoEmotionSignal(state))
    })
  );

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    knowledge: knowledge.items,
    knowledgeCards: knowledge.cards
  };
}

module.exports = { buildAgentMessages, renderKnowledge, ROLES };
