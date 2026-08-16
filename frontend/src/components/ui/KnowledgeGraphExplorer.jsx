import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KNOWLEDGE_GRAPH_URL } from "../../config/api";
import {
  EDGE_COLOR,
  EDGE_COLOR_ACTIVE,
  FAMILY_LIST,
  familyOfType,
  radiusOfDegree
} from "../../constants/knowledgeGraph";
import { createLayout } from "../../utils/forceLayout";
import "../../styles/KnowledgeGraph.css";

// Đồ thị kho tri thức — thứ Larry tra cứu trước khi trả lời.
//
// Mục đích của nó trên trang giới thiệu: cho thấy câu trả lời của Larry có chỗ
// dựa. Không phải model tự nghĩ ra, mà đi từ một dấu hiệu em kể → khái niệm phía
// sau → việc nên làm, dọc theo những cạnh do người viết tài liệu nối tay.
//
// Vẽ bằng SVG chứ không dùng thư viện đồ thị: ~133 node thì bố cục lực tự viết
// chạy hết 22ms (xem utils/forceLayout.js), và đổi lại là toàn quyền với nhãn
// tiếng Việt, hình dạng theo nhóm, và chế độ xem dạng bảng cho người đọc bằng
// trình đọc màn hình.

const VIEW_W = 900;
const VIEW_H = 620;

// Nhãn hiện sẵn cho node từ ngần này cạnh trở lên. Hiện hết 133 nhãn thì chữ
// chồng lên nhau thành một đám mờ; còn lại thì hiện khi bấm hoặc rê chuột.
const LABEL_DEGREE = 8;

function truncate(text, max = 34) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Mỗi nhóm một hình: nhận ra nhóm không bao giờ chỉ dựa vào màu (xem lý do
// trong constants/knowledgeGraph.js).
function NodeMark({ shape, r, fill, stroke, strokeWidth }) {
  const common = { fill, stroke, strokeWidth };

  if (shape === "square") {
    const s = r * 1.7;
    return <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={r * 0.35} {...common} />;
  }
  if (shape === "diamond") {
    const s = r * 1.25;
    return <path d={`M0,${-s} L${s},0 L0,${s} L${-s},0 Z`} {...common} />;
  }
  if (shape === "triangle") {
    const s = r * 1.3;
    return <path d={`M0,${-s} L${s * 0.92},${s * 0.72} L${-s * 0.92},${s * 0.72} Z`} {...common} />;
  }
  return <circle r={r} {...common} />;
}

export default function KnowledgeGraphExplorer() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null); // { kind: "node" | "edge", id }
  const [hovered, setHovered] = useState(null);
  const [familyFilter, setFamilyFilter] = useState("");
  const [query, setQuery] = useState("");
  const [tableView, setTableView] = useState(false);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  const svgRef = useRef(null);
  const layoutRef = useRef(null);
  const frameRef = useRef(0);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const [, forceRender] = useState(0);

  // --- Nạp dữ liệu ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(KNOWLEDGE_GRAPH_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Chưa tải được kho tri thức. Backend có đang chạy không?");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- Lọc ------------------------------------------------------------------

  const visible = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };

    const q = query.trim().toLowerCase();
    const nodes = data.nodes.filter((n) => {
      if (familyFilter && familyOfType(n.type).id !== familyFilter) return false;
      if (!q) return true;
      return (
        n.label.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        (n.triggers || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    const ids = new Set(nodes.map((n) => n.id));
    // Giữ luôn chỉ số gốc trong data.edges. Tra lại bằng indexOf lúc vẽ nghĩa là
    // quét cả mảng cho TỪNG cạnh, ở TỪNG khung hình — 195 × 195 phép so sánh
    // mỗi khung, đủ để hoạt hình giật trên máy yếu.
    const edges = data.edges
      .map((e, index) => ({ ...e, index }))
      .filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges };
  }, [data, familyFilter, query]);

  // --- Bố cục, chạy hoạt hình cho tới lúc nguội ------------------------------

  // Dựng bố cục ngay trong lượt render, KHÔNG để trong effect: effect chạy sau
  // khi đã vẽ xong, nên khung hình đầu tiên sau mỗi lần đổi bộ lọc sẽ đi tìm toạ
  // độ của node mới trong bố cục cũ, không thấy, và cả đồ thị chớp mất một nhịp.
  const layout = useMemo(
    () =>
      createLayout({
        nodes: visible.nodes,
        edges: visible.edges,
        width: VIEW_W,
        height: VIEW_H
      }),
    [visible]
  );
  layoutRef.current = layout;

  // Toạ độ được sửa TẠI CHỖ mỗi bước mô phỏng, nên bảng tra này dựng một lần cho
  // mỗi bố cục là đủ — các object điểm bên trong vẫn luôn là bản mới nhất.
  const positions = useMemo(() => {
    const map = new Map();
    for (const p of layout.points) map.set(p.id, p);
    return map;
  }, [layout]);

  useEffect(() => {
    if (layout.points.length === 0) return undefined;

    let running = true;
    const step = () => {
      if (!running) return;
      // Hai bước mỗi khung hình: hệ nguội nhanh gấp đôi mà mắt vẫn thấy mượt
      layout.tick();
      layout.tick();
      forceRender((n) => n + 1);
      if (!layout.settled) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [layout]);

  const nodeById = useMemo(() => {
    const map = new Map();
    for (const n of data?.nodes || []) map.set(n.id, n);
    return map;
  }, [data]);

  // Node kề node đang chọn — dùng để làm nổi phần liên quan và mờ phần còn lại
  const highlight = useMemo(() => {
    const focusId =
      hovered?.kind === "node" ? hovered.id : selected?.kind === "node" ? selected.id : null;
    if (!focusId || !data) return null;

    const neighbours = new Set([focusId]);
    const edges = new Set();
    data.edges.forEach((e, i) => {
      if (e.from === focusId) {
        neighbours.add(e.to);
        edges.add(i);
      } else if (e.to === focusId) {
        neighbours.add(e.from);
        edges.add(i);
      }
    });
    return { focusId, neighbours, edges };
  }, [hovered, selected, data]);

  const selectedNode = selected?.kind === "node" ? nodeById.get(selected.id) : null;
  const selectedEdge = selected?.kind === "edge" ? data?.edges[selected.id] : null;

  // Các cạnh nối tới node đang chọn, để liệt kê trong thẻ chi tiết
  const connections = useMemo(() => {
    if (!selectedNode || !data) return [];
    return data.edges
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.from === selectedNode.id || e.to === selectedNode.id)
      .map(({ e, i }) => {
        const outgoing = e.from === selectedNode.id;
        const other = nodeById.get(outgoing ? e.to : e.from);
        return { index: i, outgoing, other, label: e.label, symmetric: e.symmetric };
      })
      .filter((c) => c.other);
  }, [selectedNode, data, nodeById]);

  // --- Kéo, thu phóng --------------------------------------------------------

  // Đổi toạ độ con trỏ sang hệ toạ độ bên trong SVG. Không làm bước này thì node
  // chạy lệch khỏi con trỏ ngay khi trang bị thu nhỏ hoặc đang phóng to.
  const toLocal = useCallback(
    (event) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = ((event.clientX - rect.left) / rect.width) * VIEW_W;
      const sy = ((event.clientY - rect.top) / rect.height) * VIEW_H;
      return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
    },
    [view]
  );

  const onNodePointerDown = (event, id) => {
    event.stopPropagation();
    const point = positions.get(id);
    if (!point) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id, moved: false };
    point.fixed = true;
  };

  const onPointerMove = (event) => {
    if (dragRef.current) {
      const point = positions.get(dragRef.current.id);
      if (point) {
        const local = toLocal(event);
        point.x = local.x;
        point.y = local.y;
        dragRef.current.moved = true;
        layoutRef.current?.reheat(0.35);
        forceRender((n) => n + 1);
      }
      return;
    }

    if (panRef.current) {
      const dx = event.clientX - panRef.current.cx;
      const dy = event.clientY - panRef.current.cy;
      setView((v) => ({ ...v, x: panRef.current.x + dx, y: panRef.current.y + dy }));
    }
  };

  const endDrag = () => {
    if (dragRef.current) {
      const point = positions.get(dragRef.current.id);
      // Thả ra thì node nhập lại vào hệ lực. Giữ nguyên `fixed` sẽ dần biến đồ
      // thị thành một mớ đinh ghim bất động.
      if (point) point.fixed = false;
      dragRef.current = null;
    }
    panRef.current = null;
  };

  const onBackgroundPointerDown = (event) => {
    panRef.current = { cx: event.clientX, cy: event.clientY, x: view.x, y: view.y };
  };

  const onWheel = (event) => {
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const k = Math.min(3, Math.max(0.4, v.k * factor));
      return { ...v, k };
    });
  };

  const resetView = () => setView({ x: 0, y: 0, k: 1 });

  // --- Vẽ --------------------------------------------------------------------

  if (error) {
    return <p className="kgx-error">{error}</p>;
  }

  if (!data) {
    return <p className="kgx-loading">Đang tải kho tri thức...</p>;
  }

  const dimmed = (id) => highlight && !highlight.neighbours.has(id);

  // Nhãn nào được hiện — tính lại mỗi khung hình vì node còn đang di chuyển.
  //
  // Không có bước này thì hơn chục nhãn của các node nhiều liên hệ dồn hết vào
  // giữa đồ thị và đè lên nhau thành một đám chữ không đọc được (thấy ngay khi
  // chụp màn hình trang thật). Cách xử lý: xét lần lượt theo thứ tự quan trọng,
  // nhãn nào đè lên một nhãn đã đặt thì bỏ qua — nhường chỗ cho nhãn quan
  // trọng hơn thay vì vẽ chồng cả hai.
  const labelled = new Set();
  {
    const boxes = [];
    const rank = (n) => {
      if (selected?.kind === "node" && selected.id === n.id) return 3;
      if (hovered?.kind === "node" && hovered.id === n.id) return 3;
      if (highlight?.neighbours.has(n.id)) return 2;
      return n.degree >= LABEL_DEGREE ? 1 : 0;
    };

    const candidates = visible.nodes
      .map((n) => ({ n, r: rank(n) }))
      .filter((c) => c.r > 0)
      .sort((a, b) => b.r - a.r || b.n.degree - a.n.degree);

    for (const { n } of candidates) {
      const p = positions.get(n.id);
      if (!p) continue;

      // Bề rộng chữ ước lượng theo số ký tự — đủ chính xác cho việc tránh đè,
      // và rẻ hơn nhiều so với đo thật bằng getComputedTextLength() mỗi khung hình.
      const half = (truncate(n.label).length * 5.4 + 8) / 2;
      const y = p.y - radiusOfDegree(n.degree) - 6;
      const box = { x1: p.x - half, y1: y - 12, x2: p.x + half, y2: y + 3 };

      const clash = boxes.some(
        (b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)
      );
      if (clash) continue;

      boxes.push(box);
      labelled.add(n.id);
    }
  }

  return (
    <div className="kgx">
      <div className="kgx-toolbar">
        <input
          className="kgx-search"
          type="search"
          placeholder="Tìm trong kho tri thức..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm trong kho tri thức"
        />

        <div className="kgx-filters" role="group" aria-label="Lọc theo nhóm">
          <button
            type="button"
            className={`kgx-chip ${familyFilter === "" ? "kgx-chip--on" : ""}`}
            onClick={() => setFamilyFilter("")}
          >
            Tất cả
          </button>
          {FAMILY_LIST.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`kgx-chip ${familyFilter === f.id ? "kgx-chip--on" : ""}`}
              onClick={() => setFamilyFilter(familyFilter === f.id ? "" : f.id)}
              style={{ "--chip-color": f.color }}
            >
              <span className="kgx-chip__dot" aria-hidden="true" />
              {f.label}
            </button>
          ))}
        </div>

        <div className="kgx-toolbar__right">
          <button type="button" className="kgx-btn" onClick={resetView}>
            Về giữa
          </button>
          <button
            type="button"
            className={`kgx-btn ${tableView ? "kgx-btn--on" : ""}`}
            onClick={() => setTableView(!tableView)}
            aria-pressed={tableView}
          >
            {tableView ? "Xem đồ thị" : "Xem dạng bảng"}
          </button>
        </div>
      </div>

      <p className="kgx-count">
        Đang hiện <strong>{visible.nodes.length}</strong> mẩu tri thức và{" "}
        <strong>{visible.edges.length}</strong> mối liên hệ
        {(query || familyFilter) && ` (trên tổng số ${data.nodes.length})`}.
      </p>

      {tableView ? (
        // Chế độ bảng: dành cho trình đọc màn hình, cho lúc in ra, và cho người
        // khó phân biệt màu. Cùng dữ liệu, không phải bản rút gọn.
        <div className="kgx-table-wrap">
          <table className="kgx-table">
            <thead>
              <tr>
                <th>Mẩu tri thức</th>
                <th>Nhóm</th>
                <th>Loại</th>
                <th>Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {visible.nodes.map((n) => {
                const family = familyOfType(n.type);
                return (
                  <tr key={n.id}>
                    <td>
                      <button
                        type="button"
                        className="kgx-link"
                        onClick={() => {
                          setSelected({ kind: "node", id: n.id });
                          setTableView(false);
                        }}
                      >
                        {n.label}
                      </button>
                    </td>
                    <td>
                      <span className="kgx-fam" style={{ "--fam-color": family.color }}>
                        {family.label}
                      </span>
                    </td>
                    <td className="kgx-muted">{data.nodeTypeLabels[n.type] || n.type}</td>
                    <td className="kgx-muted">{truncate(n.summary, 120)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kgx-stage">
          <svg
            ref={svgRef}
            className="kgx-svg"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label={`Đồ thị kho tri thức: ${visible.nodes.length} mẩu tri thức nối với nhau bằng ${visible.edges.length} mối liên hệ. Bấm "Xem dạng bảng" để đọc bằng chữ.`}
            onPointerDown={onBackgroundPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onWheel={onWheel}
            onClick={(e) => {
              if (e.target === svgRef.current) setSelected(null);
            }}
          >
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {/* Cạnh vẽ trước để luôn nằm dưới node */}
              <g>
                {visible.edges.map((edge) => {
                  const a = positions.get(edge.from);
                  const b = positions.get(edge.to);
                  if (!a || !b) return null;

                  const globalIndex = edge.index;
                  const isSelected = selected?.kind === "edge" && selected.id === globalIndex;
                  const isActive = isSelected || highlight?.edges.has(globalIndex);
                  const isDim = highlight && !isActive;

                  return (
                    <line
                      key={`${edge.from}-${edge.rel}-${edge.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={isActive ? EDGE_COLOR_ACTIVE : EDGE_COLOR}
                      strokeWidth={isSelected ? 3 : isActive ? 2 : 1.2}
                      strokeOpacity={isDim ? 0.15 : 1}
                      className="kgx-edge"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: "edge", id: globalIndex });
                      }}
                    />
                  );
                })}
              </g>

              <g>
                {visible.nodes.map((node) => {
                  const p = positions.get(node.id);
                  if (!p) return null;

                  const family = familyOfType(node.type);
                  const r = radiusOfDegree(node.degree);
                  const isSelected = selected?.kind === "node" && selected.id === node.id;
                  const isDim = dimmed(node.id);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${p.x},${p.y})`}
                      className="kgx-node"
                      opacity={isDim ? 0.2 : 1}
                      onPointerDown={(e) => onNodePointerDown(e, node.id)}
                      onPointerEnter={() => setHovered({ kind: "node", id: node.id })}
                      onPointerLeave={() => setHovered(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Kéo node đi thì không tính là một cú bấm chọn
                        if (!dragRef.current?.moved) setSelected({ kind: "node", id: node.id });
                      }}
                    >
                      <NodeMark
                        shape={family.shape}
                        r={r}
                        fill={family.color}
                        // Vòng viền trắng tách chấm khỏi cạnh chạy phía dưới, và
                        // giúp màu nhạt nổi lên trên nền trắng
                        stroke={isSelected ? "#1a2233" : "#ffffff"}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Nhãn vẽ THÀNH MỘT LỚP RIÊNG, sau toàn bộ các chấm.
                  Để nhãn nằm chung nhóm với chấm của nó thì chấm nào vẽ sau sẽ
                  đè lên chữ của chấm vẽ trước — trên đồ thị dày như thế này,
                  gần như nhãn nào cũng bị một chấm khác cắm ngang. */}
              <g className="kgx-labels">
                {visible.nodes.map((node) => {
                  if (!labelled.has(node.id)) return null;
                  const p = positions.get(node.id);
                  if (!p) return null;

                  return (
                    <text
                      key={node.id}
                      className="kgx-node__label"
                      x={p.x}
                      y={p.y - radiusOfDegree(node.degree) - 6}
                      textAnchor="middle"
                      opacity={dimmed(node.id) ? 0.25 : 1}
                      // Viền trắng quanh chữ để nhãn đọc được cả khi nằm đè lên
                      // một đường nối
                      stroke="#ffffff"
                      strokeWidth={3.5}
                      paintOrder="stroke"
                    >
                      {truncate(node.label)}
                    </text>
                  );
                })}
              </g>
            </g>
          </svg>

          <p className="kgx-hint">
            Bấm vào một chấm để xem mẩu tri thức · bấm vào đường nối để xem mối liên hệ · kéo
            để di chuyển · lăn chuột để phóng to
          </p>
        </div>
      )}

      {/* Chú giải: bốn nhóm, mỗi nhóm một màu VÀ một hình dạng */}
      <div className="kgx-legend">
        {FAMILY_LIST.map((f) => (
          <div key={f.id} className="kgx-legend__item">
            <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true">
              <NodeMark shape={f.shape} r={8} fill={f.color} stroke="#ffffff" strokeWidth={2} />
            </svg>
            <div>
              <strong>{f.label}</strong>
              <span className="kgx-legend__q">{f.question}</span>
              <span className="kgx-legend__types">
                {f.types.map((t) => data.nodeTypeLabels[t] || t).join(" · ")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Thẻ chi tiết của thứ đang được chọn */}
      {selectedNode && (
        <article className="kgx-detail">
          <header className="kgx-detail__head">
            <div>
              <span
                className="kgx-fam"
                style={{ "--fam-color": familyOfType(selectedNode.type).color }}
              >
                {familyOfType(selectedNode.type).label}
              </span>
              <span className="kgx-detail__type">
                {data.nodeTypeLabels[selectedNode.type] || selectedNode.type}
              </span>
            </div>
            <button type="button" className="kgx-close" onClick={() => setSelected(null)}>
              ✕
            </button>
          </header>

          <h4 className="kgx-detail__title">{selectedNode.label}</h4>
          <p className="kgx-detail__summary">{selectedNode.summary}</p>

          {selectedNode.guidance && (
            <p className="kgx-detail__block">
              <strong>Hướng dẫn:</strong> {selectedNode.guidance}
            </p>
          )}
          {selectedNode.detail && (
            <p className="kgx-detail__block">
              <strong>Chi tiết:</strong> {selectedNode.detail}
            </p>
          )}
          {selectedNode.avoid && (
            <p className="kgx-detail__block kgx-detail__block--avoid">
              <strong>Tránh:</strong> {selectedNode.avoid}
            </p>
          )}

          {selectedNode.triggers?.length > 0 && (
            <div className="kgx-detail__block">
              <strong>Larry lấy mẩu này ra khi nghe thấy:</strong>
              <div className="kgx-triggers">
                {selectedNode.triggers.map((t) => (
                  <span key={t} className="kgx-trigger">
                    “{t}”
                  </span>
                ))}
              </div>
            </div>
          )}

          {connections.length > 0 && (
            <div className="kgx-detail__block">
              <strong>Nối tới {connections.length} mẩu khác:</strong>
              {/* Quan hệ có CHIỀU, và chiều đó đổi hẳn nghĩa của câu: "yếu tố
                  gia đình → chuyển tiếp tới → tổng đài 111" khác hoàn toàn với
                  chiều ngược lại. Nên cạnh đi vào được viết với mẩu kia đứng
                  TRƯỚC, đúng như nó nằm trong dữ liệu. */}
              <ul className="kgx-conn">
                {connections.map((c) => {
                  const other = (
                    <button
                      type="button"
                      className="kgx-link"
                      onClick={() => setSelected({ kind: "node", id: c.other.id })}
                    >
                      {c.other.label}
                    </button>
                  );
                  const rel = (
                    <span className="kgx-conn__rel">
                      {c.symmetric ? "↔" : "→"} {c.label} {c.symmetric ? "↔" : "→"}
                    </span>
                  );

                  return (
                    <li key={c.index}>
                      {c.outgoing || c.symmetric ? (
                        <>
                          <span className="kgx-conn__self">mẩu này</span> {rel} {other}
                        </>
                      ) : (
                        <>
                          {other} {rel} <span className="kgx-conn__self">mẩu này</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {selectedNode.source && (
            <p className="kgx-detail__source">
              Nguồn: {data.sources.find((s) => selectedNode.source.startsWith(s.id))?.title ||
                selectedNode.source}
            </p>
          )}
        </article>
      )}

      {selectedEdge && (
        <article className="kgx-detail">
          <header className="kgx-detail__head">
            <span className="kgx-fam kgx-fam--edge">Mối liên hệ</span>
            <button type="button" className="kgx-close" onClick={() => setSelected(null)}>
              ✕
            </button>
          </header>

          <p className="kgx-edge-path">
            <button
              type="button"
              className="kgx-link"
              onClick={() => setSelected({ kind: "node", id: selectedEdge.from })}
            >
              {nodeById.get(selectedEdge.from)?.label || selectedEdge.from}
            </button>
            <span className="kgx-edge-rel">
              {selectedEdge.symmetric ? "↔" : "→"} {selectedEdge.label}
            </span>
            <button
              type="button"
              className="kgx-link"
              onClick={() => setSelected({ kind: "node", id: selectedEdge.to })}
            >
              {nodeById.get(selectedEdge.to)?.label || selectedEdge.to}
            </button>
          </p>

          {selectedEdge.via && (
            <p className="kgx-detail__block">
              <strong>Rút ra từ:</strong> {selectedEdge.via}
            </p>
          )}

          <p className="kgx-detail__source">
            Đây là loại quan hệ <code>{selectedEdge.rel}</code> — chính những mối nối như thế
            này cho phép Larry đi từ một dấu hiệu em kể sang việc nên làm, thứ mà tìm theo từ
            khoá đơn thuần không bao giờ ra.
          </p>
        </article>
      )}
    </div>
  );
}
