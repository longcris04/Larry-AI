// Truy hồi: từ lời học sinh vừa kể + kết quả đánh giá của supervisor → chọn ra
// một nhúm node đáng đưa vào prompt của agent đang nói.
//
// Ba tầng, chạy lần lượt:
//   1. HẠT GIỐNG  — khớp cụm từ trong lời em kể, khớp tín hiệu nguy hiểm
//   2. LAN TRUYỀN — đi theo cạnh 1-2 bước, điểm giảm dần theo loại cạnh
//   3. GHIM       — node priority PINNED luôn có mặt, kể cả không khớp gì
//
// Tầng 2 là lý do phải dùng graph chứ không phải một danh sách phẳng: em nói
// "em thấy trống rỗng" chỉ khớp được node chức năng "chuyển hoá nỗi đau"; chính
// cạnh REPLACES_FUNCTION mới kéo ra được kỹ thuật nắm đá lạnh — thứ không hề
// chứa chữ nào giống lời em vừa nói.

const { PRIORITY, EDGE_LABELS, DANGER_LABELS_SHORT, normalizeVi } = require("./schema");
const { nodesForAgent, nodeById, neighbors } = require("./index");

// Hệ số suy giảm khi đi qua một cạnh. Tách fwd/rev vì phần lớn quan hệ chỉ có
// nghĩa một chiều: đi từ "mức nguy cơ cao" sang "tổng đài 111" là đúng, đi ngược
// lại thì một lần nhắc tổng đài sẽ kéo về mọi tình trạng nguy hiểm trong graph.
const DECAY = {
  // Khớp trúng vế BỊ CẤM thì phải lôi được điều cấm ra — đây là cạnh quan trọng nhất
  CONTRAINDICATED_FOR: { fwd: 0.5, rev: 0.95 },
  // Khớp trúng dấu hiệu thì phải lôi được kịch bản đối đáp với dấu hiệu đó
  RESPONDS_TO: { fwd: 0.5, rev: 0.9 },
  // Khớp trúng chức năng tâm lý thì phải lôi được kỹ thuật thay thế đúng chức năng
  REPLACES_FUNCTION: { fwd: 0.5, rev: 0.9 },
  HAS_STEP: { fwd: 0.85, rev: 0.7 },
  SERVES_FUNCTION: { fwd: 0.85, rev: 0.45 },
  INDICATES: { fwd: 0.8, rev: 0.5 },
  ESCALATES_TO: { fwd: 0.75, rev: 0.35 },
  APPLIES_AT: { fwd: 0.7, rev: 0.6 },
  REFER_TO: { fwd: 0.7, rev: 0.1 },
  INCREASES_RISK_OF: { fwd: 0.6, rev: 0.45 },
  RELATED_TO: { fwd: 0.6, rev: 0.6 },
  CONTRASTS_WITH: { fwd: 0.6, rev: 0.6 },
  EXEMPLIFIES: { fwd: 0.45, rev: 0.6 }
};

const DEFAULTS = {
  hops: 2, // số bước lan truyền tối đa
  maxNodes: 12, // trần số node đưa vào prompt
  minScore: 1.2, // dưới ngưỡng này coi như nhiễu
  seedLimit: 8 // số hạt giống mang đi lan truyền
};

// Điểm cho một cụm trigger khớp được. Cụm dài khớp được thì đáng tin hơn hẳn cụm
// một chữ: "muốn biến mất" trúng đích, còn "sợ" thì gần như câu nào cũng có.
function triggerScore(trigger) {
  return 3 + Math.min(trigger.words, 5) * 0.6;
}

/**
 * Gom mọi thứ đã biết về lượt này thành một khối văn bản để dò cụm từ.
 *
 * Lấy cả lời em vừa nói LẪN các mục emotions/behaviors mà supervisor rút ra:
 * supervisor thường diễn đạt lại bằng thuật ngữ ("thu mình", "tự trách bản thân")
 * gần với ngôn ngữ của tài liệu hơn là lời em tự kể.
 */
function buildQueryText({ text = "", assessment = null, extraText = "" } = {}) {
  const parts = [text, extraText];
  if (assessment) {
    parts.push((assessment.emotions || []).join(" "));
    parts.push((assessment.behaviors || []).join(" "));
    parts.push((assessment.missing || []).join(" "));
  }
  // Bọc khoảng trắng hai đầu để cụm ở đầu và cuối câu vẫn khớp được ranh giới từ
  return ` ${normalizeVi(parts.filter(Boolean).join(" \n "))} `;
}

// Lời em vừa nói ở lượt này. Không quét cả hội thoại: chủ đề đã trôi qua từ mười
// lượt trước vẫn khớp trigger, và nó sẽ đẩy chủ đề hiện tại ra khỏi ngân sách.
function latestStudentText(messages = [], turns = 2) {
  return messages
    .filter((m) => m.role === "user")
    .slice(-turns)
    .map((m) => m.content || "")
    .join("\n");
}

function scoreSeeds(candidates, { queryText, dangerSignals = [] }) {
  const danger = new Set(dangerSignals);
  const scored = [];

  for (const node of candidates) {
    let score = 0;
    const why = [];

    for (const trigger of node._triggers) {
      if (queryText.includes(trigger.padded)) {
        score += triggerScore(trigger);
        why.push(`từ khoá "${trigger.raw}"`);
      }
    }

    // Tín hiệu nguy hiểm do supervisor xác định đáng tin hơn khớp chữ nhiều —
    // nó là kết luận của cả một lượt đánh giá chứ không phải một cụm từ trùng nhau.
    const hitDangers = node.dangerSignals.filter((d) => danger.has(d));
    if (hitDangers.length > 0) {
      score += 6 * hitDangers.length;
      why.push(`tín hiệu ${hitDangers.map((d) => DANGER_LABELS_SHORT[d] || d).join(", ")}`);
    }

    // Tín hiệu phụ, cố tình để yếu: chỉ đủ sức nâng một node đã khớp sẵn thứ khác
    if (score > 0) {
      const labelHits = node._labelTokens.filter((t) => queryText.includes(` ${t} `)).length;
      score += Math.min(labelHits, 4) * 0.4;
      score += node.priority * 0.5;
    }

    if (score > 0) scored.push({ node, score, why, hops: 0 });
  }

  return scored.sort((a, b) => b.score - a.score);
}

// Lan truyền điểm từ hạt giống ra các node lân cận. Một node đến được bằng nhiều
// đường thì giữ điểm CAO NHẤT, không cộng dồn — cộng dồn sẽ đẩy các node trung
// tâm của graph (tổng đài 111, khái niệm gốc) lên đầu ở mọi truy vấn.
function expand(seeds, { hops, allowed }) {
  const best = new Map();

  for (const seed of seeds) {
    best.set(seed.node.id, { ...seed });
  }

  let frontier = seeds.map((s) => ({ id: s.node.id, score: s.score, hops: 0 }));

  for (let hop = 1; hop <= hops; hop++) {
    const next = [];

    for (const current of frontier) {
      for (const edge of neighbors(current.id)) {
        if (!allowed.has(edge.id)) continue; // ngoài phạm vi chuyên môn của agent

        const decay = DECAY[edge.rel]?.[edge.dir] ?? 0.3;
        const score = current.score * decay;
        const existing = best.get(edge.id);
        if (existing && existing.score >= score) continue;

        const node = nodeById(edge.id);
        // Viết bằng lời, và viết đúng chiều: chuỗi này vừa in ra công cụ dòng
        // lệnh, vừa hiện thẳng lên bảng tri thức của học sinh ở mục "vì sao
        // Larry mở mẩu này". Cạnh đi xuôi thì node trước là chủ ngữ, đi ngược
        // thì chính mục này mới là chủ ngữ.
        const rel = EDGE_LABELS[edge.rel] || edge.rel;
        const fromLabel = nodeById(current.id).label;

        const entry = {
          node,
          score,
          hops: hop,
          why: [
            edge.dir === "fwd"
              ? `"${fromLabel}" ${rel} mục này`
              : `mục này ${rel} "${fromLabel}"`
          ]
        };
        best.set(edge.id, entry);
        next.push({ id: edge.id, score, hops: hop });
      }
    }

    if (next.length === 0) break;
    frontier = next;
  }

  return [...best.values()];
}

/**
 * Truy hồi tri thức cho một lượt trả lời.
 *
 * @param {string} agentId          id agent đang nói, ví dụ "agent_victim"
 * @param {object} opts.assessment  assessment của supervisor ở lượt này
 * @param {Array}  opts.messages    state.messages, dùng để lấy lời em vừa nói
 * @param {string} opts.text        thay cho messages khi gọi trực tiếp (CLI, test)
 * @param {number} opts.maxNodes    trần số node trả về
 * @returns {{items: Array, queryText: string, seedCount: number}}
 *          items = [{ node, score, hops, why }] đã sắp giảm dần
 */
function retrieve(agentId, opts = {}) {
  const {
    assessment = null,
    messages = [],
    text = "",
    hops = DEFAULTS.hops,
    maxNodes = DEFAULTS.maxNodes,
    minScore = DEFAULTS.minScore,
    seedLimit = DEFAULTS.seedLimit
  } = opts;

  const candidates = nodesForAgent(agentId);
  if (candidates.length === 0) {
    return { items: [], queryText: "", seedCount: 0 };
  }

  const queryText = buildQueryText({
    text: text || latestStudentText(messages),
    assessment
  });

  const dangerSignals = assessment?.dangerSignals || [];
  const allowed = new Set(candidates.map((n) => n.id));

  const seeds = scoreSeeds(candidates, { queryText, dangerSignals }).slice(0, seedLimit);
  const expanded = expand(seeds, { hops, allowed });

  // Node GHIM luôn có mặt, kể cả lượt em chỉ nói "vâng ạ". Đây là chỗ đặt các luật
  // an toàn: một agent quên mất điều cấm nguy hiểm hơn một agent thiếu kiến thức.
  const pinned = candidates.filter((n) => n.priority >= PRIORITY.PINNED);
  const byId = new Map(expanded.map((item) => [item.node.id, item]));

  for (const node of pinned) {
    const existing = byId.get(node.id);
    // +100 để node ghim luôn nằm trên, nhưng vẫn giữ điểm khớp thật ở phần lẻ:
    // node vừa được ghim vừa khớp trúng lời em kể thì đứng trên node chỉ được ghim.
    const score = 100 + (existing?.score || 0);
    byId.set(node.id, {
      node,
      score,
      hops: existing?.hops ?? 0,
      why: [...(existing?.why || []), "luôn áp dụng cho agent này"]
    });
  }

  const items = [...byId.values()]
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxNodes);

  return { items, queryText, seedCount: seeds.length };
}

module.exports = { retrieve, buildQueryText, latestStudentText, DECAY, DEFAULTS };
