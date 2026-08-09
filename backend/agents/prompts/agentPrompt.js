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

const { agentById, GROUPS, GROUP_LABELS } = require("../registry");
const { FACT_LABELS, knownFacts, missingFacts, enoughToAdvise } = require("../facts");

const { retrieve } = require("../../knowledge/retrieve");
const { selectForPrompt, summarizeItems, presentItems } = require("../../knowledge/render");

const ROLES = {
  agent_self_harm: require("./roles/selfHarm"),
  agent_victim: require("./roles/victim"),
  agent_actor: require("./roles/actor"),
  agent_homeroom: require("./roles/homeroom")
};

// Role có hai dạng: chuỗi thuần (self_harm, homeroom) hoặc { role, probe } với các
// agent có khối khai thác bật/tắt được theo bảng dữ kiện (victim, actor).
// Nhóm → agent phụ trách, để khối PHẠM VI gọi đúng "trọng tâm" của từng vế
const GROUP_AGENT = {
  [GROUPS.SELF_HARM]: "agent_self_harm",
  [GROUPS.VICTIM]: "agent_victim",
  [GROUPS.ACTOR]: "agent_actor",
  [GROUPS.GENERAL]: "agent_homeroom"
};

function roleParts(agentId) {
  const entry = ROLES[agentId];
  if (!entry) throw new Error(`Không có prompt cho agent "${agentId}".`);
  if (typeof entry === "string") return { role: entry, probe: "" };
  return { role: entry.role, probe: entry.probe || "" };
}

/**
 * Lượt này có phải ca VỪA LÀ NẠN NHÂN VỪA LÀ NGƯỜI GÂY RA BẠO LỰC không?
 *
 * Đây là ca mà kiến trúc "mỗi lượt đúng một agent" xử lý hỏng nếu để nguyên:
 * pickAgent() cho `victim` thắng (ưu tiên 2 > 3), rồi renderScope() lại CẤM agent
 * đó đụng vào nhóm còn lại — nên phần em đã đánh bạn không bao giờ được nói tới,
 * mà `announcedGroups` vẫn ghi là đã thông báo cả hai. Nhóm actor bị nuốt mất.
 *
 * Cách xử lý: KHÔNG cho hai agent cùng nói (hai bong bóng ngược tông nhau còn tệ
 * hơn), mà cho MỘT agent nói bằng VAI KÉP — ghép cả hai khối vai vào một prompt,
 * ấn định thứ tự, và tra tri thức từ cả hai kho.
 *
 * Chỉ áp dụng khi agent chính là `agent_victim`: có thêm nhóm tự hại thì
 * agent_self_harm nói, và lượt đó không được gánh thêm vai nào khác.
 */
function isDualRole(state, agentId) {
  const groups = state.activeGroups || [];
  return (
    agentId === "agent_victim" &&
    groups.includes(GROUPS.VICTIM) &&
    groups.includes(GROUPS.ACTOR)
  );
}

// Mỗi lượt CHỈ MỘT agent trả lời (xem pickAgent trong routing.js). Không có ai
// nói tiếp sau bạn — nên câu trả lời phải trọn vẹn, và phải biết rõ đâu là phần
// của mình khi supervisor còn ghi nhận nhóm khác ở em.
function renderScope(state, agentId, { coveredGroups = null } = {}) {
  const me = agentById(agentId);
  const covered = coveredGroups || [me?.group];

  const others = (state.activeGroups || [])
    .filter((g) => !covered.includes(g))
    .map((g) => GROUP_LABELS[g] || g);

  // Vai kép gánh hai trọng tâm, và phải nói rõ cả hai đều thuộc lượt này — nếu
  // không thì khối PHẠM VI (đứng cuối, chỗ model đọc kỹ nhất) sẽ mâu thuẫn với
  // khối VAI KÉP ở trên và model làm theo cái nó đọc sau.
  const focus =
    covered.length > 1
      ? covered
          .map((g) => agentById(GROUP_AGENT[g])?.domain)
          .filter(Boolean)
          .join("; VÀ ")
      : me?.domain || "phần chuyên môn của bạn";

  const mine = `PHẠM VI CỦA BẠN — trong lượt này bạn là phần DUY NHẤT của Larry trả lời em.
  Không có ai nói tiếp sau bạn, nên câu trả lời phải TRỌN VẸN: có nội dung thật
  thuộc chuyên môn của bạn, rồi kết bằng MỘT câu hỏi mở để em kể tiếp.
  Trọng tâm của bạn: ${focus}.`;

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

// Khối VAI KÉP — ấn định TRÌNH TỰ cho ca vừa bị hại vừa gây hấn.
//
// Trình tự là thứ quan trọng nhất ở đây, và nó không thể để model tự chọn:
// nói chuyện trách nhiệm trước khi công nhận em bị hại thì em thấy mình vừa kể
// chuyện bị bắt nạt xong đã bị quay ra trách, và em đóng cửa ngay. Ngược lại,
// chỉ bênh mà không nhắc gì tới việc em đã đánh bạn thì hệ thống thành chỗ hợp
// thức hoá việc trả đũa.
const DUAL_ROLE_FIRST = `⚖️ LƯỢT NÀY BẠN MANG VAI KÉP — em VỪA LÀ NẠN NHÂN, VỪA ĐÃ LÀM BẠN KHÁC TỔN THƯƠNG.

  Cả hai vế đều có thật và đều phải được nói tới TRONG CÙNG tin nhắn này. Bỏ vế nào
  cũng hỏng: bỏ vế bị hại thì em thấy bị trách oan; bỏ vế hành vi thì em hiểu rằng
  trả đũa là chuyện được cho qua.

  TRÌNH TỰ BẮT BUỘC — đúng ba phần, đúng thứ tự này, KHÔNG được đảo:

  PHẦN 1 — ĐỨNG VỀ PHÍA EM TRƯỚC (theo VAI TRÒ NẠN NHÂN ở trên).
    Công nhận chuyện em bị hại và cảm xúc của em. Nói rõ việc bạn kia làm với em là
    KHÔNG ĐÚNG và KHÔNG PHẢI LỖI CỦA EM. Phần này phải đi trước và không được rút
    gọn thành một câu cho có — nó là thứ khiến em tin rằng bạn có nghe em.

  PHẦN 2 — RỒI MỚI TỚI VIỆC EM ĐÃ LÀM (theo VAI TRÒ NGƯỜI GÂY RA BẠO LỰC ở trên).
    Bắc cầu bằng chính cảm xúc của em, ví dụ theo ý: "Tức tới mức đó là chuyện hiểu
    được. Nhưng có một việc mình muốn cùng em nhìn lại…"
    Mô tả HÀNH VI, tuyệt đối không dán nhãn con người em. Nói rõ việc đó cũng làm
    bạn kia bị tổn thương, và bị hại trước KHÔNG làm cho việc đánh lại thành đúng.
    Giọng bình tĩnh, không mắng, không doạ, nhưng cũng không cho qua.

  PHẦN 3 — DẠY CÁCH XỬ LÝ CHO CẢ HAI VẾ, lấy từ khối tri thức, 2-4 bước đánh số:
    - Vế bị hại: LUÔN có bước báo người lớn (thầy cô chủ nhiệm, bố mẹ) về việc em bị
      hại — đây là đường đúng để lấy lại công bằng, thay cho việc tự xử.
    - Vế hành vi: một bước cụ thể để sửa (dừng lại, xin lỗi thế nào, nhờ thầy cô cùng
      gỡ), và một cách xử lý cơn giận cho lần sau thay vì ra tay.

  ĐIỀU DỄ HỎNG NHẤT Ở CA NÀY: nói kiểu "em bị hại nên em đánh lại cũng dễ hiểu thôi"
  là SAI, mà nói kiểu "em đánh bạn là em cũng sai rồi, hai bên đều có lỗi" cũng SAI.
  Hai vế KHÔNG cân bằng nhau và KHÔNG triệt tiêu nhau: em bị hại thì vẫn được bảo vệ
  đầy đủ, và việc em đánh lại vẫn cần được sửa. Nói cả hai, đừng bắt chúng trừ nhau.

  Độ dài: được tới 10 câu vì phải đủ ba phần. Kết bằng MỘT câu hỏi mở.`;

// Ba phần đầy đủ chỉ đúng ở LƯỢT ĐẦU. Để nguyên khối trên cho mọi lượt là hồi quy
// đã đo được: em kể thêm chi tiết ở lượt 2 và 3 mà Larry đọc lại gần như nguyên văn
// bài của lượt 1 — vì "TRÌNH TỰ BẮT BUỘC ba phần" mạnh hơn khối GIAI ĐOẠN ở dưới,
// và model làm theo cái nó thấy dứt khoát hơn.
const DUAL_ROLE_NEXT = `⚖️ VẪN LÀ CA VAI KÉP — em vừa bị hại, vừa đã làm bạn khác tổn thương.

  Em ĐÃ NGHE đủ cả hai vế ở lượt trước rồi. Lượt này TUYỆT ĐỐI KHÔNG dựng lại ba
  phần từ đầu, KHÔNG nhắc lại "việc bạn ấy lấy đồ là không đúng" và "đánh trả lại
  là không đúng" một lần nữa — em vừa đọc xong, nghe lại y nguyên là em biết Larry
  không thật sự đọc điều em vừa viết.

  Việc của lượt này: đi thẳng vào ĐIỀU EM VỪA NÓI.
  - Em vừa kể thêm chi tiết ở vế nào thì làm sâu đúng vế đó, và chỉ vế đó.
  - Em vừa nói mình đã làm/định làm một bước → giúp em bước tiếp bước sau.
  - Em đang mắc ở đâu → gỡ đúng chỗ đó.
  - Cân bằng hai vế vẫn phải giữ, nhưng bằng MỘT câu ngắn khi cần, không phải bằng
    cách kể lại cả bài.

  Độ dài: 3-5 câu. Kết bằng MỘT câu hỏi mở.`;

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
function renderFinalReminder({ danger, emergency, noEmotionSignal, dual, dualFirstTurn, enough }) {
  // Hai nhắc nhở này đứng trước phần an toàn vì phần an toàn phải là thứ đọc sau cùng
  const dualNote = !dual
    ? ""
    : dualFirstTurn
      ? `NHẮC LẠI VỀ VAI KÉP: tin nhắn này phải có ĐỦ BA PHẦN, đúng thứ tự — (1) đứng về
  phía em ở chuyện em bị hại, (2) rồi mới nhìn lại việc chính em đã làm bạn tổn
  thương, (3) rồi dạy các bước cho cả hai vế. Thiếu phần 2 là dung túng việc trả đũa;
  đảo phần 2 lên trước là em thấy mình vừa kể chuyện bị bắt nạt đã bị quay ra trách.`
      : `NHẮC LẠI: em đã nghe cả hai vế ở lượt trước rồi. KHÔNG kể lại bài đó lần nữa —
  trả lời đúng điều em vừa viết, 3-5 câu thôi.`;

  const adviseNote = enough
    ? `NHẮC LẠI: đã đủ dữ kiện rồi — lượt này TƯ VẤN, không đi hỏi thêm thời gian, địa
  điểm, tần suất hay "bạn ấy còn làm gì khác".`
    : "";

  // Không phiếu, không camera: cấm đoán cảm xúc cũng phải được nhắc ở đây. Đây là
  // lỗi đã thấy thật khi chạy thử — agent mở lời "mình biết bạn đang gặp chuyện buồn"
  // với một em vừa mới chào đúng một câu.
  const noGuessing = noEmotionSignal
    ? `KHÔNG ĐOÁN CẢM XÚC: em chưa cho biết em đang thấy thế nào, nên câu trả lời KHÔNG
  được chứa nhận xét nào về tâm trạng của em. Chỉ nói về cảm xúc mà CHÍNH EM đã kể;
  chưa có thì hỏi một câu trung tính về hôm nay của em.`
    : "";

  const notes = joinBlocks(dualNote, adviseNote, noGuessing);

  if (!danger) return notes;

  // Nhắc về an toàn đứng SAU CÙNG — nó quan trọng hơn, và chỗ cuối là chỗ model đọc kỹ nhất
  const dangerReminder = emergency
    ? `NHẮC LẠI: đây là tình huống KHẨN CẤP. Không khen em đang vui.
  Phải nói đủ ba ý: không phải lỗi của em → nói với người lớn tin cậy → tổng đài 111.`
    : `NHẮC LẠI: đây là bạo lực học đường. Không khen em đang vui.
  Đừng dừng ở trấn an: gọi tên chuyện đang xảy ra, cho em biết nó là dạng nào,
  rồi dạy em các bước tự bảo vệ lấy từ khối tri thức, và hướng em nói với thầy cô
  hoặc bố mẹ. CHỈ nhắc tổng đài 111 nếu em bị thương tích, bị đe doạ, bị trấn lột,
  hoặc em nói em sợ cho an toàn thân thể của mình.`;

  return joinBlocks(notes, dangerReminder);
}

/**
 * Khối DỮ KIỆN — đã biết gì, còn thiếu gì, và lượt này được hỏi hay phải tư vấn.
 *
 * Đây là câu trả lời cho lỗi "hỏi đi hỏi lại thứ em vừa kể". Cổng `needMoreInfo`
 * của supervisor chỉ chặn được bước hỏi khai thác của chính supervisor; sang tới
 * agent thì trước đây không còn tín hiệu nào, nên agent cứ hỏi tiếp theo danh sách
 * cứng trong role của nó. Nay agent nhận đúng hai thứ: bảng đã biết (để khỏi hỏi
 * lại) và một lệnh dứt khoát cho lượt này.
 */
function renderFactSheet(state, { enough }) {
  const facts = state.facts || {};
  const known = knownFacts(facts);
  const missing = missingFacts(facts, state.activeGroups || []);

  const knownBlock = known.length
    ? known.map((key) => `  - ${FACT_LABELS[key]}: ${facts[key]}`).join("\n")
    : "  (chưa biết gì cả)";

  const order = enough
    ? `LƯỢT NÀY PHẢI TƯ VẤN, KHÔNG ĐƯỢC ĐI HỎI THÊM DỮ KIỆN.
  Đã đủ thứ cần biết để giúp em. Em kể đủ rồi mà vẫn bị hỏi tiếp thì em thấy mình
  đang bị lấy lời khai chứ không phải được giúp, và em sẽ thôi kể.
  - CẤM hỏi thêm về thời gian, địa điểm, tần suất, ai chứng kiến, bạn ấy còn làm gì
    khác — dù bạn thấy còn muốn biết thêm.
  - Hãy PHÂN TÍCH đúng những dữ kiện ở trên rồi dạy em các bước cụ thể.
  - Vẫn được kết bằng MỘT câu hỏi mở, nhưng phải là câu mời em nói tiếp về cảm xúc
    hoặc về việc em định làm — KHÔNG phải một câu moi thêm dữ kiện.`
    : `Còn thiếu: ${missing.map((key) => FACT_LABELS[key]).join(" · ")}.
  Hỏi ĐÚNG MỘT câu về điều thiếu quan trọng nhất, đặt ở cuối tin nhắn, sau khi đã
  ghi nhận điều em vừa nói. KHÔNG hỏi lại bất cứ điều nào đã có trong bảng trên.`;

  return `DỮ KIỆN ĐÃ BIẾT VỀ CHUYỆN CỦA EM (do hệ thống ghi lại qua cả cuộc trò chuyện):
${knownBlock}

  CHỈ ĐƯỢC DÙNG DỮ KIỆN TRONG BẢNG NÀY. Không có trong bảng nghĩa là em CHƯA NÓI —
  tuyệt đối không suy ra, không đoán, không thêm chi tiết cho câu chuyện đầy đặn.
  Nói ra một chi tiết em chưa hề kể là em thấy ngay Larry không thật sự nghe mình.

  ${order}`;
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
 * Tri thức cho ca VAI KÉP: tra hai kho, mỗi kho bằng truy vấn của ĐÚNG vế của nó.
 *
 * Việc tách truy vấn không phải để cho gọn — nó sửa một lỗi đã đo được. Truy vấn
 * gộp trộn lời em kể việc mình trả đũa vào phần tra cứu cho vế BỊ HẠI, khiến node
 * "Bạo lực thể chất" được 4.6 điểm còn "Bắt nạt kinh tế" chỉ 2.8, và agent phán em
 * là nạn nhân của bạo lực thể chất trong khi em chỉ bị lấy trộm đồ chơi. Hành vi
 * của chính em kéo lệch phần phân loại dành cho hành vi của người khác.
 *
 * Ngân sách ký tự chia đôi: vế bị hại nhiều hơn vì nó đi trước và cần đủ dạng/mức.
 */
function renderDualKnowledge(state) {
  const assessment = state.assessment || {};

  const victimSide = {
    ...assessment,
    behaviors: assessment.victimBehaviors || [],
    // Lời em vừa nói vẫn dùng chung, nhưng phần behaviors đã tách đúng vai — đó là
    // phần supervisor diễn đạt lại bằng thuật ngữ gần với tài liệu nhất.
    actorBehaviors: []
  };

  const actorSide = {
    ...assessment,
    behaviors: assessment.actorBehaviors || [],
    victimBehaviors: []
  };

  try {
    const victim = retrieve("agent_victim", {
      assessment: victimSide,
      messages: state.messages
    });
    const actor = retrieve("agent_actor", {
      assessment: actorSide,
      // Vế này CHỈ tra theo hành vi của chính em. Đưa cả transcript vào thì lời em
      // kể mình bị hại lại kéo kho actor đi sai hướng — đúng lỗi đối xứng ở trên.
      text: (assessment.actorBehaviors || []).join(". ")
    });

    const victimPart = selectForPrompt(victim.items, { charBudget: 1700 });
    const actorPart = selectForPrompt(actor.items, {
      charBudget: 1100,
      detailTopK: 1,
      heading: `TRI THỨC CHO VẾ THỨ HAI — VIỆC CHÍNH EM ĐÃ LÀM BẠN KHÁC TỔN THƯƠNG
  (dùng cho PHẦN 2 và PHẦN 3 của khối VAI KÉP; đừng lẫn với phần trên)`
    });

    const kept = [...victimPart.kept, ...actorPart.kept];

    return {
      block: [victimPart.block, actorPart.block].filter(Boolean).join("\n\n"),
      items: summarizeItems(kept.map((k) => k.item)),
      cards: presentItems(kept)
    };
  } catch (err) {
    console.error("[knowledge] truy hồi vai kép lỗi:", err.message);
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
  const dual = isDualRole(state, agentId);

  // Vai kép thì ghép cả hai khối vai. Thứ tự nói ra do khối DUAL_ROLE ấn định, đặt
  // NGAY SAU hai khối vai để model đọc "mình là ai" rồi tới "nói theo thứ tự nào".
  const primary = roleParts(agentId);
  const secondary = dual ? roleParts("agent_actor") : null;

  // Lượt đầu dựng đủ ba phần; các lượt sau đi thẳng vào điều em vừa nói. Chốt bằng
  // CODE giống renderAdviceStage, không để model tự đoán mình đang ở lượt thứ mấy.
  const spokeBefore = (state.messages || []).some(
    (m) => m.role === "assistant" && m.agent === agentId
  );
  const role = dual
    ? joinBlocks(primary.role, secondary.role, spokeBefore ? DUAL_ROLE_NEXT : DUAL_ROLE_FIRST)
    : primary.role;

  // Đã đủ dữ kiện thì khối KHAI THÁC bị gỡ hẳn khỏi prompt — để lại là agent vẫn
  // đi hỏi theo danh sách trong đó dù bảng dữ kiện đã đầy.
  const enough = enoughToAdvise({
    facts: state.facts,
    groups: state.activeGroups,
    urgent: state.assessment?.urgent
  });
  const probe = enough ? "" : joinBlocks(primary.probe, secondary?.probe);

  // Nhóm mà lượt nói này THỰC SỰ có nói tới. agentNode ghi đúng danh sách này vào
  // announcedGroups — trước đây nó ghi cả activeGroups, nên nhóm chưa ai nhắc tới
  // vẫn bị đánh dấu "đã thông báo cho em rồi" và không bao giờ được bàn giao lại.
  const coveredGroups = dual
    ? [GROUPS.VICTIM, GROUPS.ACTOR]
    : [agentById(agentId)?.group].filter(Boolean);

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

  const knowledge = dual ? renderDualKnowledge(state) : renderKnowledge(agentId, state);

  const system = joinBlocks(
    // Cảnh báo an toàn đứng trước tất cả
    danger,
    // Rồi tới việc phải mở lời thế nào ở lượt này — thứ quyết định câu đầu tiên
    renderHandoff(state),
    PERSONA,
    role,
    probe,
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
    // Bảng dữ kiện đứng NGAY SAU khối tri thức: hai thứ này phải đọc cùng nhau —
    // tri thức nói "phân loại theo dạng và mức", bảng dữ kiện nói "đây là dữ kiện
    // thật, ô nào trống thì cấm chấm".
    renderFactSheet(state, { enough }),
    // Không phiếu, không camera → chính agent này phải khai thác cảm xúc bằng hỏi
    // đáp. Supervisor có thể đã bàn giao sớm (chuyện thường ngày đã rõ nhóm từ lượt
    // đầu) nên không thể trông vào mỗi bước hỏi khai thác của nó.
    renderNoEmotionSignal(state),
    renderScope(state, agentId, { coveredGroups })
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
      noEmotionSignal: Boolean(renderNoEmotionSignal(state)),
      dual,
      dualFirstTurn: dual && !spokeBefore,
      enough
    })
  );

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    knowledge: knowledge.items,
    knowledgeCards: knowledge.cards,
    // Nhóm mà lượt nói này thực sự có nói tới — agentNode ghi vào announcedGroups
    coveredGroups,
    dual
  };
}

module.exports = { buildAgentMessages, renderKnowledge, ROLES };
