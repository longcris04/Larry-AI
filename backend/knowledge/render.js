// Biến kết quả truy hồi thành khối văn bản chèn vào system prompt của agent.
//
// Hai ràng buộc chi phối cách viết ở đây:
//   - Model đang dùng là loại nhỏ, đọc lướt phần giữa của prompt dài. Nên khối
//     này phải NGẮN và có thứ tự ưu tiên rõ: điều cấm lên trước, nền lý thuyết
//     xuống cuối.
//   - Đây là tài liệu THAM CHIẾU, không phải câu để đọc lại cho học sinh. Không
//     nói rõ điều đó thì agent sẽ chép nguyên văn cả mẫu câu lẫn tên tài liệu.

const { NODE_TYPES, NODE_TYPE_LABELS, PRIORITY } = require("./schema");
const { sourceById } = require("./index");

// Thứ tự xuất hiện trong prompt. Trên cùng là thứ mà làm sai gây hại ngay.
const SECTIONS = [
  { key: "taboo", title: "TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM", types: [NODE_TYPES.Taboo] },
  { key: "level", title: "MỨC ĐỘ NGUY CƠ VÀ VIỆC PHẢI LÀM Ở MỨC ĐÓ", types: [NODE_TYPES.RiskLevel] },
  { key: "principle", title: "NGUYÊN TẮC GIAO TIẾP", types: [NODE_TYPES.Principle] },
  {
    key: "action",
    title: "QUY TRÌNH VÀ KỸ NĂNG DÙNG ĐƯỢC LÚC NÀY",
    types: [NODE_TYPES.Protocol, NODE_TYPES.Step, NODE_TYPES.Skill, NODE_TYPES.Method]
  },
  { key: "script", title: "MẪU ĐỐI THOẠI THAM KHẢO (diễn đạt lại, đừng chép nguyên văn)", types: [NODE_TYPES.Script] },
  {
    key: "theory",
    title: "NỀN LÝ THUYẾT LIÊN QUAN",
    types: [NODE_TYPES.Concept, NODE_TYPES.Function, NODE_TYPES.ViolenceType, NODE_TYPES.Sign, NODE_TYPES.RiskFactor, NODE_TYPES.Stat]
  },
  { key: "case", title: "TÌNH HUỐNG TƯƠNG TỰ ĐÃ GHI NHẬN", types: [NODE_TYPES.Case] },
  // Tiêu đề mang sẵn điều kiện: model nhỏ đọc tiêu đề mục kỹ hơn đọc phần hướng dẫn
  // ở cuối, mà mục này là mục dễ bị đọc ra thành câu kết máy móc nhất.
  {
    key: "hotline",
    title: "ĐỊA CHỈ HỖ TRỢ (CHỈ nhắc khi tình huống đã tới ngưỡng khẩn cấp)",
    types: [NODE_TYPES.Hotline]
  }
];

const SECTION_OF = new Map();
for (const section of SECTIONS) {
  for (const type of section.types) SECTION_OF.set(type, section.key);
}

// Ngân sách ký tự cho cả khối. Vượt trần thì cắt từ node điểm thấp nhất trở lên —
// node đã lọt vào đây đều liên quan, nhưng thứ tự điểm là thứ tự đáng tin.
const CHAR_BUDGET = Math.max(600, Number(process.env.KNOWLEDGE_CHAR_BUDGET) || 2600);

// `detail` chỉ dành cho vài node đầu bảng: nó dài gấp mấy lần summary và thường
// là phần việc của người lớn, không phải lời agent nói với em.
const DETAIL_TOP_K = Math.max(0, Number(process.env.KNOWLEDGE_DETAIL_TOP_K) || 2);

function renderItem(item, { withDetail }) {
  const { node } = item;
  const lines = [`• ${node.label}: ${node.summary}`];

  if (node.avoid) lines.push(`  KHÔNG: ${node.avoid}`);
  if (node.guidance) lines.push(`  Cách dùng: ${node.guidance}`);
  if (withDetail && node.detail) lines.push(`  Chi tiết: ${node.detail}`);

  return lines.join("\n");
}

// Cắt theo ngân sách TRƯỚC khi gom nhóm: gom trước rồi cắt sẽ làm mất nguyên
// một mục ở cuối, còn cắt trước thì chỉ mất đúng những node điểm thấp nhất.
//
// Gặp node quá dài thì BỎ QUA nó rồi đi tiếp, chứ không dừng hẳn: một node
// detail dài nằm giữa bảng không được phép hất hết các node ngắn phía sau ra
// ngoài. Node đầu tiên luôn được giữ dù có vượt trần.
function fitToBudget(items, { budget, detailTopK }) {
  const kept = [];
  let used = 0;

  items.forEach((item, index) => {
    const withDetail = index < detailTopK;
    const text = renderItem(item, { withDetail });
    if (used + text.length > budget && kept.length > 0) return;
    kept.push({ item, text, withDetail });
    used += text.length + 1;
  });

  return kept;
}

function composeBlock(kept, { heading = "", withFooter = true } = {}) {
  if (kept.length === 0) return "";

  const grouped = new Map();
  for (const entry of kept) {
    const key = SECTION_OF.get(entry.item.node.type) || "theory";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry.text);
  }

  const body = SECTIONS.filter((s) => grouped.has(s.key))
    .map((s) => `${s.title}:\n${grouped.get(s.key).join("\n")}`)
    .join("\n\n");

  // Ca vai kép cần HAI khối tri thức trong cùng một prompt (một cho vế em bị hại,
  // một cho vế em đã làm bạn tổn thương). Khối thứ hai chỉ cần tiêu đề riêng để
  // agent biết nó thuộc vế nào; phần "cách dùng" ở cuối thì nói một lần là đủ,
  // lặp lại chỉ tốn chỗ trong một prompt vốn đã dài.
  if (heading) {
    return `${heading}\n\n${body}`;
  }

  return `KHUNG LÝ THUYẾT CHUYÊN MÔN CHO ĐÚNG TÌNH HUỐNG NÀY
  (trích từ tài liệu chuyên môn của nhà trường, đã lọc theo lời em vừa kể)

${body}

  CÁCH DÙNG KHỐI TRÊN: đây là tài liệu tham chiếu cho BẠN, không phải câu để đọc
  cho em nghe. Không nhắc tới tài liệu, không đọc tên mục, không đọc nguyên văn.
  Diễn đạt lại mọi thứ bằng giọng của Larry cho vừa tuổi em.

  Đây là chất liệu để bạn PHÂN TÍCH tình huống của em rồi mới khuyên (xem khối
  "CÁCH ĐƯA LỜI KHUYÊN"):
  - Phần khái niệm và định nghĩa → dùng để GỌI TÊN và GIẢI THÍCH NGẮN chuyện em
    đang gặp.
  - Phần dạng/loại và mức độ → dùng để nói cho em biết trường hợp của em thuộc
    dạng nào, ở mức nào, và vì sao.
  - Phần quy trình, kỹ năng, việc phải làm ở mức đó → dùng làm CÁC BƯỚC cụ thể
    dạy em. Chọn 2-4 bước hợp nhất với đúng mức của em, nói theo thứ tự; không đổ
    hết mọi bước có trong khối ra một lượt.
  - Phần địa chỉ hỗ trợ (tổng đài, đường dây nóng) CHỈ nhắc khi tình huống đã tới
    ngưỡng khẩn cấp nêu ở khối "CÁCH ĐƯA LỜI KHUYÊN". Có số trong khối này KHÔNG
    có nghĩa là lượt này phải đọc số ra.`;
}

/**
 * Chọn phần tri thức thật sự đi vào prompt lượt này.
 *
 * Trả về CẢ khối văn bản LẪN danh sách mục được giữ, vì bảng tri thức trên giao
 * diện phải hiện đúng những mục agent đã đọc — không hơn. Hiện thừa một mục đã
 * bị ngân sách cắt bỏ là nói với học sinh rằng Larry dựa vào một thứ nó chưa hề
 * nhìn thấy, đúng cái mà bảng này sinh ra để chống lại.
 *
 * @returns {{block: string, kept: Array}} kept = [{ item, text, withDetail }]
 */
function selectForPrompt(items = [], opts = {}) {
  if (items.length === 0) return { block: "", kept: [] };

  const kept = fitToBudget(items, {
    budget: opts.charBudget || CHAR_BUDGET,
    detailTopK: opts.detailTopK ?? DETAIL_TOP_K
  });

  return {
    block: composeBlock(kept, { heading: opts.heading, withFooter: opts.withFooter }),
    kept
  };
}

/**
 * @param {Array} items  kết quả từ retrieve(), đã sắp giảm dần theo điểm
 * @param {object} opts
 * @returns {string} khối prompt, hoặc "" nếu không truy hồi được gì
 */
function renderKnowledgeBlock(items = [], opts = {}) {
  return selectForPrompt(items, opts).block;
}

// Bản gọn cho log và cho vết chạy lưu trong state — không đưa vào prompt
function summarizeItems(items = []) {
  return items.map((item) => ({
    id: item.node.id,
    type: item.node.type,
    label: item.node.label,
    score: Number(item.score.toFixed(2)),
    hops: item.hops
  }));
}

// "self-harm#PhầnII.Bước3, actor" → { part: "Phần II. Bước 3" }
//
// Bỏ các mẩu không phải chương mục: vài node ghi kèm id tài liệu khác (nguồn phụ)
// hoặc tên file mã nguồn — thứ không có nghĩa gì với học sinh đang đọc màn hình.
function prettyPart(rawPart = "") {
  return rawPart
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !p.includes("/") && !p.endsWith(".js") && !sourceById(p))
    .map((p) =>
      p
        .replace(/(Chương|Phần|Bước|Mục)(?=\S)/g, "$1 ")
        .replace(/\.(?=[A-ZĐ])/g, ". ")
        .trim()
    )
    .join(" · ");
}

// Tài liệu gốc của một node, dạng đọc được. Đây là thứ chứng minh câu trả lời có
// chỗ dựa: học sinh thấy đúng tên tài liệu và đúng chương mục đã được mở ra.
function describeSource(node) {
  const [docId = "", rawPart = ""] = String(node.source || "").split("#");
  const doc = sourceById(docId);

  return {
    doc: doc?.title || "Tài liệu chuyên môn của nhà trường",
    file: doc?.file ? doc.file.split("/").pop() : "",
    part: prettyPart(rawPart)
  };
}

/**
 * Bản ĐẦY ĐỦ cho giao diện: đúng những mẩu tri thức đã đi vào prompt của agent,
 * kèm nguồn tài liệu và lý do được chọn.
 *
 * Khác `summarizeItems` ở chỗ có cả nội dung. Học sinh nhìn được nội dung thật
 * mới tin được rằng Larry đang dựa vào tài liệu chứ không tự nghĩ ra.
 *
 * @param {Array} kept  phần `kept` của selectForPrompt() — chỉ các mục đã lọt
 *                      vào prompt, kèm cờ `withDetail` đúng như prompt đã nhận
 */
function presentItems(kept = []) {
  return kept.map(({ item, withDetail }) => {
    const { node } = item;

    return {
      id: node.id,
      type: node.type,
      typeLabel: NODE_TYPE_LABELS[node.type] || node.type,
      label: node.label,
      summary: node.summary,
      guidance: node.guidance || "",
      avoid: node.avoid || "",
      detail: withDetail ? node.detail || "" : "",
      source: describeSource(node),
      why: item.why || [],
      hops: item.hops,
      pinned: node.priority >= PRIORITY.PINNED,
      score: Number(item.score.toFixed(2))
    };
  });
}

module.exports = {
  renderKnowledgeBlock,
  selectForPrompt,
  summarizeItems,
  presentItems,
  SECTIONS,
  CHAR_BUDGET
};
