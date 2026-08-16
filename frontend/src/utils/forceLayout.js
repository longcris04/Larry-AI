// Bố cục đồ thị bằng mô phỏng lực — tự viết, không thêm thư viện.
//
// Kho tri thức chỉ có ~133 node và ~195 cạnh. Ở cỡ đó, vòng lặp so mọi cặp
// (133² ≈ 17 nghìn phép tính mỗi bước) chạy hết chưa tới một phần nghìn giây,
// nên không cần tới cây Barnes-Hut hay một thư viện đồ thị nặng vài trăm KB kéo
// theo cả d3. Đổi lại, mọi thứ hiển thị đều nằm trong tầm kiểm soát: nhãn tiếng
// Việt, màu theo loại node, và một tệp có thể chạy thẳng trong Node để kiểm thử.
//
// Ba lực, đúng như mọi bộ dựng đồ thị lực khác:
//   ĐẨY     mọi cặp node đẩy nhau  → các chấm không chồng lên nhau
//   LÒ XO   hai đầu một cạnh hút nhau → thứ có liên hệ thì nằm gần nhau
//   HÚT TÂM kéo nhẹ về giữa         → cụm rời rạc không trôi ra vô cực

// Lực đẩy giữa hai node bất kỳ, chia cho bình phương khoảng cách
const REPULSION = 3000;

// Chiều dài "nghỉ" của một cạnh — hai node nối nhau muốn cách nhau chừng này
const LINK_DISTANCE = 68;
const LINK_STRENGTH = 0.06;

// Lực kéo về tâm. Yếu thôi: mạnh quá thì mọi thứ dồn thành một cục.
const GRAVITY = 0.015;

// Vận tốc còn lại sau mỗi bước. Thiếu ma sát này thì hệ dao động mãi không dừng.
const DAMPING = 0.82;

// Khoảng cách tối thiểu khi tính lực đẩy. Hai node trùng khít nhau sẽ cho
// khoảng cách 0 → chia cho 0 → toạ độ thành NaN, và cả đồ thị biến mất.
const MIN_DISTANCE = 12;

// alpha giảm dần để hệ nguội đi rồi đứng yên
const ALPHA_DECAY = 0.985;
const ALPHA_MIN = 0.02;

/**
 * Dựng một phiên mô phỏng.
 *
 * Vị trí ban đầu đặt trên một vòng tròn theo thứ tự node — CỐ Ý không dùng số
 * ngẫu nhiên: cùng một kho tri thức thì lần nào mở trang cũng ra đúng một hình,
 * nhờ vậy người xem quay lại còn nhận ra chỗ cũ, và lỗi bố cục thì tái hiện được.
 *
 * @param {{id:string, degree?:number}[]} nodes
 * @param {{from:string, to:string}[]} edges
 */
export function createLayout({ nodes, edges, width = 900, height = 620 }) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;

  const points = nodes.map((node, i) => {
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    return {
      id: node.id,
      // Node nối nhiều cạnh bắt đầu gần tâm hơn: chúng thường là trung tâm của
      // một cụm, và bắt đầu đúng chỗ thì hệ nguội nhanh hơn hẳn.
      x: centerX + Math.cos(angle) * radius * (node.degree > 6 ? 0.55 : 1),
      y: centerY + Math.sin(angle) * radius * (node.degree > 6 ? 0.55 : 1),
      vx: 0,
      vy: 0
    };
  });

  const indexById = new Map(points.map((p, i) => [p.id, i]));

  // Cạnh trỏ tới node đã bị lọc bỏ thì bỏ qua — lúc người xem lọc theo agent,
  // danh sách cạnh vẫn còn nguyên nhưng một đầu có thể không còn trên màn hình.
  const links = [];
  for (const edge of edges) {
    const s = indexById.get(edge.from);
    const t = indexById.get(edge.to);
    if (s === undefined || t === undefined || s === t) continue;
    links.push({ s, t });
  }

  let alpha = 1;

  function tick() {
    const n = points.length;

    // 1. ĐẨY — mọi cặp. Chỉ duyệt nửa trên của ma trận rồi áp lực ngược chiều
    //    cho node còn lại, nên số phép tính giảm một nửa.
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      for (let j = i + 1; j < n; j += 1) {
        const b = points[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;

        // Trùng khít nhau: đẩy lệch đi một chút theo hướng cố định thay vì chia
        // cho 0. Dùng chỉ số node để hướng lệch vẫn tất định.
        if (distSq < MIN_DISTANCE * MIN_DISTANCE) {
          dx = (i % 2 === 0 ? 1 : -1) * MIN_DISTANCE;
          dy = (j % 2 === 0 ? 1 : -1) * MIN_DISTANCE;
          distSq = dx * dx + dy * dy;
        }

        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // 2. LÒ XO dọc theo cạnh
    for (const link of links) {
      const a = points[link.s];
      const b = points[link.t];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || MIN_DISTANCE;

      const force = (dist - LINK_DISTANCE) * LINK_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // 3. HÚT TÂM + tích phân
    for (const p of points) {
      p.vx += (centerX - p.x) * GRAVITY;
      p.vy += (centerY - p.y) * GRAVITY;

      p.vx *= DAMPING;
      p.vy *= DAMPING;

      // Node đang bị kéo bằng chuột thì giữ nguyên chỗ, để nó theo tay chứ
      // không bị lực đẩy hất đi
      if (p.fixed) {
        p.vx = 0;
        p.vy = 0;
        continue;
      }

      p.x += p.vx * alpha;
      p.y += p.vy * alpha;
    }

    alpha *= ALPHA_DECAY;
    return alpha;
  }

  return {
    points,
    links,
    tick,
    get alpha() {
      return alpha;
    },
    /** Hâm nóng lại khi người xem kéo một node hoặc đổi bộ lọc */
    reheat(value = 0.6) {
      alpha = value;
    },
    get settled() {
      return alpha < ALPHA_MIN;
    }
  };
}

/** Chạy tới lúc nguội hẳn, dùng cho kiểm thử và cho lần dựng đầu không cần hoạt hình. */
export function settleLayout(config, maxTicks = 400) {
  const layout = createLayout(config);
  for (let i = 0; i < maxTicks && !layout.settled; i += 1) layout.tick();
  return layout;
}

export const LAYOUT_CONSTANTS = { LINK_DISTANCE, ALPHA_MIN };
