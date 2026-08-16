// Bản knowledge graph dành cho TRANG GIỚI THIỆU công khai.
//
// Graph trong bộ nhớ có kèm phần phục vụ truy hồi (`_triggers` đã chuẩn hoá,
// `_labelTokens`, `_file`). Những field bắt đầu bằng "_" là chi tiết nội bộ của
// thuật toán khớp — đưa ra ngoài thì vừa vô nghĩa với người xem, vừa biến chi
// tiết cài đặt thành thứ mà giao diện lỡ phụ thuộc vào.
//
// Vì sao dữ liệu này công khai được: đây là tài liệu THAM KHẢO chuyên môn về tâm
// lý học đường, không có một dòng nào của học sinh trong đó. Hội thoại của các em
// nằm ở sessions.json và không bao giờ đi qua đây.

const { getGraph } = require("./index");
const {
  NODE_TYPE_LABELS,
  EDGE_LABELS,
  DANGER_LABELS_SHORT,
  SYMMETRIC_EDGES
} = require("./schema");

// Giữ nguyên thứ tự field cho dễ đọc lúc debug bằng curl
function toPublicNode(node, degree) {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    summary: node.summary,
    // Ba field dưới đây không phải node nào cũng có
    guidance: node.guidance || "",
    detail: node.detail || "",
    avoid: node.avoid || "",
    agents: node.agents || [],
    priority: node.priority ?? 1,
    dangerSignals: node.dangerSignals || [],
    // Cụm từ khiến mẩu này được lấy ra. Đây chính là thứ làm cho phần "vì sao
    // Larry lấy mẩu này" đọc được — giấu đi thì đồ thị chỉ còn là hình trang trí.
    triggers: node.triggers || [],
    source: node.source || "",
    // Bậc của node: giao diện lấy nó làm kích thước chấm tròn
    degree
  };
}

function toPublicGraph() {
  const graph = getGraph();

  // Đếm bậc trước, để node nào nối nhiều thì vẽ to hơn
  const degree = new Map();
  for (const id of graph.nodes.keys()) degree.set(id, 0);
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }

  const nodes = [...graph.nodes.values()].map((n) => toPublicNode(n, degree.get(n.id) || 0));

  const edges = graph.edges.map((e) => ({
    from: e.from,
    rel: e.rel,
    to: e.to,
    // `via` giải thích cạnh đó rút ra từ đâu trong tài liệu gốc
    via: e.via || "",
    label: EDGE_LABELS[e.rel] || e.rel,
    // Cạnh hai chiều được vẽ không mũi tên
    symmetric: SYMMETRIC_EDGES.has(e.rel)
  }));

  return {
    stats: {
      ...graph.stats,
      // Số node theo từng kiểu, cho phần chú giải
      byType: nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {})
    },
    nodeTypeLabels: NODE_TYPE_LABELS,
    edgeTypeLabels: EDGE_LABELS,
    dangerLabels: DANGER_LABELS_SHORT,
    // Tài liệu gốc đứng sau graph — để người xem biết đây không phải model tự nghĩ ra
    sources: [...graph.sources.values()].map((s) => ({
      id: s.id,
      title: s.title,
      file: s.file
    })),
    nodes,
    edges
  };
}

module.exports = { toPublicGraph };
