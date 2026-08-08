#!/usr/bin/env node
// Công cụ dòng lệnh để kiểm tra và thử graph mà không cần chạy cả backend.
//
//   node knowledge/cli.js check
//   node knowledge/cli.js stats
//   node knowledge/cli.js query agent_victim "em bị các bạn trong lớp cô lập"
//   node knowledge/cli.js query agent_self_harm "em thấy trống rỗng" --danger self_injury
//   node knowledge/cli.js node concept.nssi
//
// `check` là thứ nên chạy sau mỗi lần sửa file trong graph/ — nó bắt được cạnh
// treo, id trùng và node gán cho agent không tồn tại, những lỗi mà lúc chat chỉ
// biểu hiện thành "agent tự nhiên kém đi" chứ không báo gì.

const { getGraph, nodesForAgent, nodeById, neighbors } = require("./index");
const { retrieve } = require("./retrieve");
const { renderKnowledgeBlock, summarizeItems } = require("./render");
const { NODE_TYPE_LIST } = require("./schema");

// Registry là nguồn sự thật về danh sách agent; graph phải khớp với nó
const { AGENTS, SUPERVISOR_ID } = require("../agents/registry");
const VALID_AGENTS = new Set([...AGENTS.map((a) => a.id), SUPERVISOR_ID, "*"]);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function cmdCheck() {
  let graph;
  try {
    graph = getGraph();
  } catch (err) {
    fail(err.message);
  }

  const problems = [];

  for (const node of graph.nodes.values()) {
    for (const agentId of node.agents) {
      if (!VALID_AGENTS.has(agentId)) {
        problems.push(`node "${node.id}" gán cho agent không có trong registry: "${agentId}"`);
      }
    }
    if (node.agents.length === 0) {
      problems.push(`node "${node.id}" không gán cho agent nào — sẽ không bao giờ được truy hồi`);
    }
    if (node.priority >= 3 && node.agents.includes("*") && node.type !== "Hotline") {
      problems.push(`node "${node.id}" vừa GHIM vừa gán cho mọi agent — sẽ chiếm chỗ trong prompt của cả 4 agent`);
    }
  }

  // RÒ RỈ ĐỊNH DANH NỘI BỘ — bốn trường dưới đây đi THẲNG vào prompt của agent,
  // nên id node và tên file mã nguồn lọt vào đó là model có thể đọc lại cho học
  // sinh nghe. Viết chéo tham chiếu bằng lời, đừng viết bằng id.
  const PROMPT_FIELDS = ["summary", "guidance", "avoid", "detail"];
  const CODE_PATTERN = /\b[A-Za-z_]+\.js\b|\b[A-Z][A-Z_]{3,}_[A-Z_]+\b/;

  for (const node of graph.nodes.values()) {
    for (const field of PROMPT_FIELDS) {
      const value = node[field];
      if (!value) continue;

      for (const otherId of graph.nodes.keys()) {
        if (value.includes(otherId)) {
          problems.push(`node "${node.id}" nhắc id "${otherId}" trong trường ${field} — trường này vào thẳng prompt`);
        }
      }
      const code = value.match(CODE_PATTERN);
      if (code) {
        problems.push(`node "${node.id}" nhắc tên mã nguồn "${code[0]}" trong trường ${field} — trường này vào thẳng prompt`);
      }
    }
  }

  // NODE CHẾT — node không đường nào vào được prompt.
  //
  // Không đủ nếu chỉ kiểm tra "có cạnh nào không": một node có thể nối vào một
  // cụm mà cả cụm đều không có trigger, lúc đó cả cụm cùng chết. Nên phải lan
  // truyền THẬT từ tập node khớp được, đúng số bước mà retrieve dùng.
  const HOPS = require("./retrieve").DEFAULTS.hops;
  const alive = new Set();
  let frontier = [];

  for (const node of graph.nodes.values()) {
    if (node._triggers.length > 0 || node.dangerSignals.length > 0 || node.priority >= 3) {
      alive.add(node.id);
      frontier.push(node.id);
    }
  }

  for (let hop = 0; hop < HOPS; hop++) {
    const next = [];
    for (const id of frontier) {
      for (const edge of neighbors(id)) {
        if (alive.has(edge.id)) continue;
        alive.add(edge.id);
        next.push(edge.id);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  for (const node of graph.nodes.values()) {
    if (!alive.has(node.id)) {
      problems.push(
        `node "${node.id}" không có trigger, không được ghim, và cách mọi node khớp được quá ${HOPS} bước — không lượt nào truy hồi được nó`
      );
    }
  }

  console.log(`\nĐã nạp ${graph.stats.fileCount} file, ${graph.stats.nodeCount} node, ${graph.stats.edgeCount} cạnh.`);

  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} vấn đề:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log("✓ Graph hợp lệ.\n");
}

function cmdStats() {
  const graph = getGraph();

  console.log(`\nTổng: ${graph.stats.nodeCount} node, ${graph.stats.edgeCount} cạnh\n`);

  console.log("Theo loại node:");
  const byType = new Map(NODE_TYPE_LIST.map((t) => [t, 0]));
  for (const node of graph.nodes.values()) byType.set(node.type, (byType.get(node.type) || 0) + 1);
  for (const [type, count] of [...byType].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${type}`);
  }

  console.log("\nTheo agent (đã tính cả node dùng chung):");
  for (const agent of AGENTS) {
    const nodes = nodesForAgent(agent.id);
    const pinned = nodes.filter((n) => n.priority >= 3).length;
    console.log(`  ${String(nodes.length).padStart(4)}  ${agent.id.padEnd(18)} (${pinned} ghim)  ${agent.icon} ${agent.displayName}`);
  }

  console.log("\nTheo loại cạnh:");
  const byRel = new Map();
  for (const edge of graph.edges) byRel.set(edge.rel, (byRel.get(edge.rel) || 0) + 1);
  for (const [rel, count] of [...byRel].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${rel}`);
  }
  console.log("");
}

function cmdQuery(args) {
  const agentId = args[0];
  if (!agentId || !VALID_AGENTS.has(agentId)) {
    fail(`Cần id agent hợp lệ. Có: ${[...VALID_AGENTS].filter((a) => a !== "*").join(", ")}`);
  }

  const dangerIndex = args.indexOf("--danger");
  const dangerSignals = dangerIndex === -1 ? [] : args.slice(dangerIndex + 1);
  const text = (dangerIndex === -1 ? args.slice(1) : args.slice(1, dangerIndex)).join(" ");

  if (!text) fail('Cần câu của học sinh, ví dụ: query agent_victim "em bị bạn đánh"');

  const result = retrieve(agentId, {
    text,
    assessment: dangerSignals.length ? { dangerSignals } : null
  });

  console.log(`\nCâu vào: "${text}"`);
  if (dangerSignals.length) console.log(`Tín hiệu nguy hiểm: ${dangerSignals.join(", ")}`);
  console.log(`Chuẩn hoá: "${result.queryText}"`);
  console.log(`\n${result.seedCount} hạt giống → ${result.items.length} node được chọn:\n`);

  for (const item of result.items) {
    const tag = item.hops === 0 ? "hạt giống" : `${item.hops} bước`;
    console.log(`  ${String(item.score.toFixed(1)).padStart(6)}  [${tag}] ${item.node.type} · ${item.node.label}`);
    console.log(`          ${item.why.join("; ")}`);
  }

  console.log("\n─── KHỐI ĐƯA VÀO PROMPT ───────────────────────────────\n");
  const block = renderKnowledgeBlock(result.items);
  console.log(block || "(rỗng)");
  console.log(`\n─── ${block.length} ký tự ─────────────────────────────────\n`);
}

function cmdNode(args) {
  const node = nodeById(args[0]);
  if (!node) fail(`Không có node "${args[0]}"`);

  console.log(`\n${node.type} · ${node.label}`);
  console.log(`id: ${node.id}   ưu tiên: ${node.priority}   file: ${node._file}`);
  console.log(`agent: ${node.agents.join(", ")}`);
  if (node.dangerSignals.length) console.log(`tín hiệu: ${node.dangerSignals.join(", ")}`);
  console.log(`\n${node.summary}`);
  if (node.avoid) console.log(`\nKHÔNG: ${node.avoid}`);
  if (node.guidance) console.log(`\nCách dùng: ${node.guidance}`);
  if (node.detail) console.log(`\nChi tiết: ${node.detail}`);
  console.log(`\nTrigger (${node._triggers.length}): ${node._triggers.map((t) => t.raw).join(" | ") || "(không có)"}`);

  console.log(`\nCạnh (${neighbors(node.id).length}):`);
  for (const edge of neighbors(node.id)) {
    const arrow = edge.dir === "fwd" ? "→" : "←";
    console.log(`  ${arrow} ${edge.rel.padEnd(22)} ${nodeById(edge.id).label}`);
  }
  console.log(`\nNguồn: ${node.source}\n`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "check":
    cmdCheck();
    break;
  case "stats":
    cmdStats();
    break;
  case "query":
    cmdQuery(rest);
    break;
  case "node":
    cmdNode(rest);
    break;
  default:
    console.log(`
Cách dùng:
  node knowledge/cli.js check                        kiểm tra tính toàn vẹn của graph
  node knowledge/cli.js stats                        thống kê node/cạnh theo loại và theo agent
  node knowledge/cli.js query <agentId> "<câu>"      thử truy hồi, in ra khối prompt
  node knowledge/cli.js node <nodeId>                xem chi tiết một node và các cạnh của nó

Cờ cho query:
  --danger <tín hiệu...>   giả lập dangerSignals mà supervisor trả về
`);
}
