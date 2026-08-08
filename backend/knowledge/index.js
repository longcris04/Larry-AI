// Nạp toàn bộ file trong graph/, ghép thành MỘT graph và dựng chỉ mục tra cứu.
//
// Nạp một lần cho cả tiến trình rồi cache lại: graph là dữ liệu tĩnh, đọc lại ở
// mỗi lượt chat chỉ tốn I/O. Muốn nạp lại sau khi sửa file thì gọi reloadGraph().

const fs = require("fs");
const path = require("path");

const { NODE_TYPE_LIST, EDGE_TYPE_LIST, PRIORITY, normalizeVi } = require("./schema");

const GRAPH_DIR = path.join(__dirname, "graph");

// Cạnh nối tới node không tồn tại là lỗi im lặng tệ nhất của một graph viết tay:
// truy hồi vẫn chạy, chỉ là đi thiếu mất một nhánh mà không ai biết. Nên mọi lỗi
// cấu trúc đều được gom lại và ném ra ngay lúc nạp.
function readGraphFiles() {
  const files = fs
    .readdirSync(GRAPH_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(GRAPH_DIR, file), "utf8");
    try {
      return { file, data: JSON.parse(raw) };
    } catch (err) {
      throw new Error(`knowledge: file graph/${file} không phải JSON hợp lệ — ${err.message}`);
    }
  });
}

// Chuẩn bị sẵn phần dùng để so khớp, để lúc chat không phải normalize lại mỗi lượt
function prepareNode(node, file) {
  // Bọc khoảng trắng hai đầu để so khớp theo RANH GIỚI TỪ. Không có nó thì
  // trigger "sờ" (chuẩn hoá thành "so") khớp luôn vào "em sợ đi học", và agent
  // nạn nhân bị kéo sang toàn bộ nhánh quấy rối tình dục vì đúng một chữ.
  const triggers = (node.triggers || []).map((t) => {
    const norm = normalizeVi(t);
    return { raw: t, norm, padded: ` ${norm} `, words: norm.split(" ").length };
  });

  // Từ trong nhãn dùng làm tín hiệu phụ, yếu hơn trigger nhiều. Bỏ từ ngắn vì
  // "và", "của", "em" khớp với mọi câu.
  const labelTokens = [...new Set(normalizeVi(node.label).split(" ").filter((w) => w.length >= 4))];

  return {
    ...node,
    priority: node.priority ?? PRIORITY.NORMAL,
    agents: node.agents || [],
    dangerSignals: node.dangerSignals || [],
    _file: file,
    _triggers: triggers.filter((t) => t.norm.length > 0),
    _labelTokens: labelTokens
  };
}

function buildGraph() {
  const files = readGraphFiles();

  const nodes = new Map();
  const edges = [];
  const errors = [];

  // Mô tả tài liệu gốc của từng file, khoá theo id dùng trong trường `source` của
  // node ("self-harm#ChươngV.1"). Node ở shared.json trỏ sang id của file khác nên
  // bảng này phải gom từ MỌI file trước khi tra.
  const sources = new Map();

  for (const { file, data } of files) {
    if (data.source?.id) sources.set(data.source.id, { ...data.source, _file: file });

    for (const node of data.nodes || []) {
      if (!node.id) {
        errors.push(`graph/${file}: có node thiếu id`);
        continue;
      }
      if (nodes.has(node.id)) {
        errors.push(`graph/${file}: id trùng "${node.id}" (đã có ở ${nodes.get(node.id)._file})`);
        continue;
      }
      if (!NODE_TYPE_LIST.includes(node.type)) {
        errors.push(`graph/${file}: node "${node.id}" có type lạ "${node.type}"`);
        continue;
      }
      if (!node.label || !node.summary) {
        errors.push(`graph/${file}: node "${node.id}" thiếu label hoặc summary`);
        continue;
      }
      nodes.set(node.id, prepareNode(node, file));
    }

    for (const edge of data.edges || []) {
      if (!EDGE_TYPE_LIST.includes(edge.rel)) {
        errors.push(`graph/${file}: cạnh ${edge.from} → ${edge.to} có rel lạ "${edge.rel}"`);
        continue;
      }
      edges.push({ ...edge, _file: file });
    }
  }

  // Kiểm tra cạnh treo sau khi đã gom hết node của MỌI file — cạnh liên file là
  // chuyện bình thường (actor.json trỏ sang node ở shared.json).
  const adjacency = new Map();
  for (const id of nodes.keys()) adjacency.set(id, []);

  for (const edge of edges) {
    if (!nodes.has(edge.from)) {
      errors.push(`graph/${edge._file}: cạnh trỏ từ node không tồn tại "${edge.from}"`);
      continue;
    }
    if (!nodes.has(edge.to)) {
      errors.push(`graph/${edge._file}: cạnh trỏ tới node không tồn tại "${edge.to}"`);
      continue;
    }
    adjacency.get(edge.from).push({ id: edge.to, rel: edge.rel, dir: "fwd" });
    adjacency.get(edge.to).push({ id: edge.from, rel: edge.rel, dir: "rev" });
  }

  if (errors.length > 0) {
    throw new Error(`knowledge: graph có ${errors.length} lỗi cấu trúc:\n  - ${errors.join("\n  - ")}`);
  }

  // Chỉ mục theo agent: "*" nghĩa là mọi agent đều dùng được
  const byAgent = new Map();
  const universal = [];
  for (const node of nodes.values()) {
    if (node.agents.includes("*")) {
      universal.push(node);
      continue;
    }
    for (const agentId of node.agents) {
      if (!byAgent.has(agentId)) byAgent.set(agentId, []);
      byAgent.get(agentId).push(node);
    }
  }

  return {
    nodes,
    edges,
    adjacency,
    byAgent,
    universal,
    sources,
    files: files.map((f) => f.file),
    stats: {
      nodeCount: nodes.size,
      edgeCount: edges.length,
      fileCount: files.length
    }
  };
}

let cached = null;

function getGraph() {
  if (!cached) cached = buildGraph();
  return cached;
}

function reloadGraph() {
  cached = null;
  return getGraph();
}

// Node mà một agent được phép nhìn thấy. Đây là ranh giới chuyên môn: agent trò
// chuyện thường ngày không được lôi ra bộ kỹ thuật dành cho ca tự hại.
function nodesForAgent(agentId) {
  const graph = getGraph();
  return [...(graph.byAgent.get(agentId) || []), ...graph.universal];
}

function nodeById(id) {
  return getGraph().nodes.get(id) || null;
}

function neighbors(id) {
  return getGraph().adjacency.get(id) || [];
}

// Tài liệu gốc đứng sau một id nguồn, ví dụ "self-harm" → tiêu đề và tên file .docx
function sourceById(id) {
  return getGraph().sources.get(id) || null;
}

module.exports = {
  getGraph,
  reloadGraph,
  nodesForAgent,
  nodeById,
  neighbors,
  sourceById,
  GRAPH_DIR
};
