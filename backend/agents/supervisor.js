// Node Supervisor — chạy ở ĐẦU MỌI LƯỢT.
//
// Ba việc trong một node:
//   A. Đánh giá & phân nhóm (structured output)
//   B. Quyết định: hỏi khai thác thêm, hay chuyển cho agent chuyên trách
//   C. Nạp hàng đợi agent, kèm phần BÀN GIAO nếu tình trạng vừa thay đổi
//
// SUPERVISOR CHỈ NÓI KHI CHƯA PHÂN LUỒNG ĐƯỢC. Phân luồng xong là nó im lặng
// hoàn toàn: lượt đó chỉ agent chuyên trách nói với em. Trước đây supervisor
// thông báo một đoạn rồi agent nói tiếp một đoạn, thành ra em nhận hai bong bóng
// nói gần như cùng một nội dung, và cảm giác như bị chuyển máy giữa cuộc gọi.
//
// ĐÁNH GIÁ ở mọi lượt, nhưng PHÂN LUỒNG LẠI chỉ khi tình trạng thực sự đổi.
// Hai việc này tách hẳn nhau:
//   - Đánh giá không được bỏ lượt nào: đó là lớp phát hiện em vừa lộ ý định tự
//     sát, vừa bị dụ dỗ, vừa chuyển từ bị bắt nạt sang đi bắt nạt lại.
//   - Đổi agent thì phải có lý do thật (xem shouldReroute trong routing.js).
//     Em kể tiếp về đúng chuyện cũ mà bị chuyển sang một "người" khác giữa chừng
//     là trải nghiệm tệ nhất của một cuộc tư vấn.

const { z } = require("zod");

const { makeLLM } = require("./llm");
const { SUPERVISOR_ID, modelForAgent } = require("./registry");
const { buildAssessMessages, buildProbeMessages } = require("./prompts/supervisor");
const {
  resolveGroups,
  diffGroups,
  shouldReroute,
  pickAgent,
  normalizeGroups,
  MAX_PROBE_TURNS
} = require("./routing");

const AssessmentSchema = z.object({
  emotions: z.array(z.string()).max(6).describe("Cảm xúc của học sinh, tiếng Việt, mỗi mục 1-2 từ"),
  behaviors: z
    .array(z.string())
    .max(6)
    .describe("Hành vi/biểu hiện cụ thể, tiếng Việt, mỗi mục một mệnh đề ngắn"),
  groups: z
    .array(z.enum(["self_harm", "victim", "actor", "general"]))
    .min(1)
    .describe("Nhóm phụ trách. Được chọn nhiều nhóm. 'general' loại trừ các nhóm khác."),
  needMoreInfo: z.boolean().describe("true nếu chưa đủ thông tin để chuyển sang tư vấn"),
  missing: z.array(z.string()).max(4).describe("Những điều còn thiếu, tiếng Việt"),
  dangerSignals: z
    .array(
      z.enum([
        "grooming",
        "sexual_abuse",
        "domestic_violence",
        "school_violence",
        "suicidal",
        "self_injury"
      ])
    )
    .max(4)
    .describe("Tín hiệu nguy hiểm xuất hiện trong lời em kể; rỗng nếu không có"),
  urgent: z.boolean().describe("true nếu có tín hiệu nguy hiểm cần xử lý ngay"),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(400).describe("1-2 câu tiếng Việt, chỉ dành cho giáo viên đọc")
});

// Đánh giá cần ổn định, không cần sáng tạo
const assessLLM = () =>
  makeLLM({
    model: modelForAgent(SUPERVISOR_ID),
    temperature: 0.1,
    tags: [SUPERVISOR_ID, "assess"]
  }).withStructuredOutput(AssessmentSchema, { name: "assessment" });

// Nói với học sinh thì cần ấm áp
const speakLLM = (tag) =>
  makeLLM({
    model: modelForAgent(SUPERVISOR_ID),
    temperature: 0.6,
    tags: [SUPERVISOR_ID, tag]
  });

// Model đôi khi vẫn thêm tiền tố dù đã dặn kỹ
function cleanReply(content) {
  const text = typeof content === "string" ? content : String(content ?? "");
  return text
    .trim()
    .replace(/^(Larry|Cô giáo Larry)\s*[:：]\s*/i, "")
    .trim();
}

// Khi hội thoại rỗng và không có phiếu thì chẳng có gì để phân tích — bỏ qua
// một lần gọi model, vì đây đúng là lượt học sinh chờ lâu nhất (vừa mở app).
function emptyAssessment() {
  return {
    emotions: [],
    behaviors: [],
    groups: ["general"],
    needMoreInfo: true,
    missing: ["học sinh chưa kể gì"],
    dangerSignals: [],
    urgent: false,
    confidence: 0,
    rationale: "Chưa có dữ liệu — mới mở đầu cuộc trò chuyện."
  };
}

async function assess(state) {
  const hasNothing = state.messages.length === 0 && !state.checkin;
  if (hasNothing) return emptyAssessment();

  const result = await assessLLM().invoke(buildAssessMessages(state));
  const dangerSignals = result.dangerSignals || [];

  return {
    ...result,
    groups: normalizeGroups(result.groups),
    dangerSignals,
    // Việc GỘP tín hiệu thành cờ khẩn cấp làm ở ĐÂY, không giao cho model:
    // model liệt kê đúng dấu hiệu nhưng vẫn để urgent=false là lỗi đã gặp thật.
    urgent: result.urgent === true || dangerSignals.length > 0
  };
}

async function supervisorNode(state) {
  const startedAt = Date.now();

  // Sự kiện "supervisor.thinking" KHÔNG phát ở đây. streamMode "updates" chỉ
  // trả kết quả SAU KHI node chạy xong, nên phát ở đây thì giao diện nhận được
  // lúc supervisor đã nghĩ xong — vô nghĩa. runner.js phát nó ngay đầu lượt.
  const trace = [];

  const assessment = await assess(state);

  // Sàn an toàn và bộ chống rung được áp Ở ĐÂY, không phải trong prompt — model
  // không được phép gỡ nhóm tự hại chỉ vì học sinh vừa nói mình vui, và cũng
  // không được gỡ nhóm nào chỉ vì một lượt em nói sang chuyện khác.
  const {
    groups: activeGroups,
    kept,
    pending,
    missStreak
  } = resolveGroups(state.activeGroups, assessment.groups, state.groupMissStreak);

  trace.push({
    type: "supervisor.assessment",
    agent: SUPERVISOR_ID,
    emotions: assessment.emotions,
    behaviors: assessment.behaviors,
    groups: activeGroups,
    proposedGroups: assessment.groups,
    keptBySafetyFloor: kept,
    keptPendingConfirm: pending,
    needMoreInfo: assessment.needMoreInfo,
    dangerSignals: assessment.dangerSignals,
    urgent: assessment.urgent,
    confidence: assessment.confidence,
    rationale: assessment.rationale,
    ms: Date.now() - startedAt
  });

  if (assessment.dangerSignals.length) {
    console.warn(
      `🚨 Tín hiệu nguy hiểm [${assessment.dangerSignals.join(", ")}] — phiên ${state.sessionId}.`
    );
  }

  if (kept.length) {
    console.warn(
      `🔒 Sàn an toàn giữ lại nhóm [${kept.join(", ")}] cho phiên ${state.sessionId} ` +
        "dù model đề xuất gỡ."
    );
  }

  if (pending.length) {
    console.log(
      `⏳ Giữ tạm nhóm [${pending.join(", ")}] cho phiên ${state.sessionId} — ` +
        "chờ thêm lượt xác nhận trước khi gỡ."
    );
  }

  // --- B. Hỏi thêm hay định tuyến? -------------------------------------------
  //
  // urgent THẮNG TẤT CẢ. Học sinh vừa nói "em không muốn sống nữa" mà còn bị hỏi
  // "chuyện này kéo dài bao lâu rồi?" là hỏng nghiêm trọng.
  const probeExhausted = state.probeCount >= MAX_PROBE_TURNS;

  // Cổng "đủ thông tin" chỉ có ý nghĩa khi câu trả lời của nó CÓ THỂ ĐỔI agent.
  // Trường hợp thường ngày đã rõ ràng thì bắt em kể thêm chỉ làm cuộc trò chuyện
  // giống một cuộc phỏng vấn — cứ giao cho cô giáo chủ nhiệm, agent đó hỏi han
  // tự nhiên hơn nhiều, và supervisor vẫn phân nhóm lại ở mọi lượt.
  const hasStudentSpoken = state.messages.some((m) => m.role === "user");
  const settledGeneral =
    hasStudentSpoken &&
    activeGroups.length === 1 &&
    activeGroups[0] === "general" &&
    assessment.confidence >= 0.7;

  const shouldProbe =
    !assessment.urgent && assessment.needMoreInfo && !probeExhausted && !settledGeneral;

  if (shouldProbe) {
    const res = await speakLLM("probe").invoke(buildProbeMessages(state, assessment));
    const text = cleanReply(res.content);

    return {
      assessment,
      activeGroups,
      groupMissStreak: missStreak,
      probeCount: state.probeCount + 1,
      queue: [],
      messages: [{ role: "assistant", content: text, agent: SUPERVISOR_ID }],
      trace: [
        ...trace,
        { type: "supervisor.probe", agent: SUPERVISOR_ID, probeCount: state.probeCount + 1 }
      ]
    };
  }

  // --- C. Phân luồng lại (nếu tình trạng thực sự đổi) ------------------------
  //
  // Tín hiệu nguy hiểm MỚI cũng tính là thay đổi, kể cả khi nhóm không đổi —
  // em vừa hé lộ chuyện bị dụ dỗ nhưng vẫn nằm trong nhóm "general" chẳng hạn.
  // Chỉ tính tín hiệu MỚI, nếu không thì lượt nào cũng phân luồng lại một chuyện.
  const newDangers = assessment.dangerSignals.filter(
    (d) => !(state.announcedDangers || []).includes(d)
  );

  const currentAgents = state.activeAgents || [];
  const { reroute, reason } = shouldReroute({
    previousGroups: state.activeGroups,
    groups: activeGroups,
    currentAgents,
    newDangers
  });

  // Không có gì đổi → giữ nguyên agent cũ, không thông báo lại.
  // Em nói tiếp với đúng người đã nghe em từ đầu.
  if (!reroute) {
    trace.push({
      type: "route.keep",
      agent: SUPERVISOR_ID,
      agents: currentAgents,
      groups: activeGroups
    });

    return {
      assessment,
      activeGroups,
      groupMissStreak: missStreak,
      queue: [...currentAgents],
      pendingAnnouncement: null,
      messages: [],
      trace
    };
  }

  // Thông báo so với thứ em ĐÃ ĐƯỢC NGHE, không phải so với nhóm đang chạy:
  // hai cái lệch nhau sau những lượt supervisor chỉ hỏi khai thác.
  const { added, removed, changed } = diffGroups(state.announcedGroups, activeGroups);

  // Tình trạng vừa đổi → em cần được cho biết. Nhưng người NÓI câu đó là agent
  // chuyên trách, không phải supervisor: supervisor chỉ gói phần cần nói lại và
  // bàn giao. Nhờ vậy mỗi lượt em vẫn chỉ nghe đúng một giọng.
  const pendingAnnouncement =
    changed || newDangers.length > 0
      ? { groups: activeGroups, added, removed, dangerSignals: newDangers }
      : null;

  if (pendingAnnouncement) {
    trace.push({
      type: "supervisor.handoff",
      agent: SUPERVISOR_ID,
      groups: activeGroups,
      added,
      removed
    });
  }

  // ĐÚNG MỘT agent cho lượt này — nhóm ưu tiên cao nhất thắng (xem pickAgent).
  const queue = [pickAgent(activeGroups)];
  trace.push({ type: "route", agent: SUPERVISOR_ID, agents: queue, groups: activeGroups, reason });

  return {
    assessment,
    activeGroups,
    groupMissStreak: missStreak,
    pendingAnnouncement,
    queue,
    // Agent này sẽ được dùng lại ở các lượt sau cho tới lần phân luồng kế tiếp
    activeAgents: queue,
    // announcedGroups/announcedDangers do agent node ghi sau khi đã thật sự nói
    messages: [],
    trace
  };
}

module.exports = { supervisorNode, AssessmentSchema, cleanReply };
