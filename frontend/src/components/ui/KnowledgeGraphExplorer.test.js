import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import KnowledgeGraphExplorer from "./KnowledgeGraphExplorer";

// Đồ thị nhỏ nhưng đủ hình dạng: hai nhóm khác nhau, một cạnh một chiều, một
// cạnh hai chiều, và một node không nối với ai.
const GRAPH = {
  stats: { nodeCount: 4, edgeCount: 2, fileCount: 1, byType: {} },
  nodeTypeLabels: { Sign: "Dấu hiệu", Concept: "Khái niệm", Skill: "Kỹ năng", Hotline: "Nơi hỗ trợ" },
  edgeTypeLabels: { INDICATES: "là dấu hiệu của", RELATED_TO: "liên quan tới" },
  dangerLabels: {},
  sources: [{ id: "self-harm", title: "Cẩm nang can thiệp khẩn cấp", file: "tai-lieu.docx" }],
  nodes: [
    {
      id: "sign.buon",
      type: "Sign",
      label: "Hay buồn bã, thu mình",
      summary: "Em ít nói hẳn đi, tránh chỗ đông người.",
      guidance: "Hỏi thăm riêng, đừng hỏi trước lớp.",
      detail: "",
      avoid: "Đừng nói “có gì đâu mà buồn”.",
      agents: ["agent_self_harm"],
      priority: 2,
      dangerSignals: [],
      triggers: ["em buồn quá", "chán chả muốn nói"],
      source: "self-harm#ChuongI",
      degree: 2
    },
    {
      id: "concept.tram_cam",
      type: "Concept",
      label: "Dấu hiệu trầm cảm",
      summary: "Trạng thái buồn kéo dài, mất hứng thú.",
      guidance: "",
      detail: "",
      avoid: "",
      agents: ["agent_self_harm"],
      priority: 2,
      dangerSignals: [],
      triggers: [],
      source: "self-harm#ChuongII",
      degree: 2
    },
    {
      id: "skill.hit_tho",
      type: "Skill",
      label: "Bài tập hít thở 4-7-8",
      summary: "Cách tự trấn tĩnh khi thấy quá tải.",
      guidance: "",
      detail: "",
      avoid: "",
      agents: ["*"],
      priority: 1,
      dangerSignals: [],
      triggers: [],
      source: "",
      degree: 1
    },
    {
      id: "hotline.111",
      type: "Hotline",
      label: "Tổng đài 111",
      summary: "Tổng đài quốc gia bảo vệ trẻ em.",
      guidance: "",
      detail: "",
      avoid: "",
      agents: ["*"],
      priority: 3,
      dangerSignals: [],
      triggers: [],
      source: "",
      degree: 1
    }
  ],
  edges: [
    {
      from: "sign.buon",
      rel: "INDICATES",
      to: "concept.tram_cam",
      via: "Chương I mục 2",
      label: "là dấu hiệu của",
      symmetric: false
    },
    {
      from: "skill.hit_tho",
      rel: "RELATED_TO",
      to: "hotline.111",
      via: "",
      label: "liên quan tới",
      symmetric: true
    }
  ]
};

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => GRAPH }));
  // jsdom không có hai thứ này; component dùng chúng để chạy hoạt hình và để
  // quy đổi toạ độ con trỏ.
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  Element.prototype.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 900, height: 620, right: 900, bottom: 620, x: 0, y: 0
  });
});

test("vẽ đủ số node và cạnh của kho tri thức", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);

  await waitFor(() => expect(screen.getByText(/Đang hiện/)).toBeInTheDocument());
  expect(screen.getByText(/mẩu tri thức và/)).toHaveTextContent("4");

  expect(container.querySelectorAll(".kgx-node")).toHaveLength(4);
  expect(container.querySelectorAll(".kgx-edge")).toHaveLength(2);
});

test("bấm vào node thì hiện nội dung mẩu tri thức đó", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(4));

  fireEvent.click(container.querySelectorAll(".kgx-node")[0]);

  const detail = container.querySelector(".kgx-detail");
  expect(detail).toBeInTheDocument();
  expect(within(detail).getByText("Hay buồn bã, thu mình")).toBeInTheDocument();
  expect(within(detail).getByText(/ít nói hẳn đi/)).toBeInTheDocument();
  // Nhóm chức năng và loại node đều hiện thành CHỮ, không chỉ dựa vào màu
  expect(within(detail).getByText("Dấu hiệu & bằng chứng")).toBeInTheDocument();
  expect(within(detail).getByText("Dấu hiệu")).toBeInTheDocument();
  // Cụm từ khiến mẩu này được lấy ra
  expect(within(detail).getByText(/em buồn quá/)).toBeInTheDocument();
  // Phần "tránh" và nguồn tài liệu
  expect(within(detail).getByText(/có gì đâu mà buồn/)).toBeInTheDocument();
  expect(within(detail).getByText(/Cẩm nang can thiệp khẩn cấp/)).toBeInTheDocument();
});

test("bấm vào đường nối thì hiện mối liên hệ hai đầu", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-edge").length).toBe(2));

  fireEvent.click(container.querySelectorAll(".kgx-edge")[0]);

  const detail = container.querySelector(".kgx-detail");
  expect(within(detail).getByText("Mối liên hệ")).toBeInTheDocument();
  expect(within(detail).getByText("Hay buồn bã, thu mình")).toBeInTheDocument();
  expect(within(detail).getByText(/là dấu hiệu của/)).toBeInTheDocument();
  expect(within(detail).getByText("Dấu hiệu trầm cảm")).toBeInTheDocument();
  expect(within(detail).getByText(/Chương I mục 2/)).toBeInTheDocument();
});

test("đi tiếp được từ mẩu này sang mẩu kia qua danh sách liên hệ", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(4));

  fireEvent.click(container.querySelectorAll(".kgx-node")[0]);
  const detail = () => container.querySelector(".kgx-detail");
  expect(within(detail()).getByText("Nối tới 1 mẩu khác:")).toBeInTheDocument();

  fireEvent.click(within(detail()).getByRole("button", { name: "Dấu hiệu trầm cảm" }));
  expect(within(detail()).getByText(/buồn kéo dài/)).toBeInTheDocument();
});

test("lọc theo nhóm chức năng", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(4));

  fireEvent.click(screen.getByRole("button", { name: /Hành động/ }));

  // Chỉ còn "Bài tập hít thở" (loại Skill), và cạnh nối sang Hotline bị bỏ vì
  // một đầu không còn trên màn hình
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(1));
  expect(container.querySelectorAll(".kgx-edge")).toHaveLength(0);
});

test("tìm theo cụm từ kích hoạt, không chỉ theo tên", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(4));

  fireEvent.change(screen.getByLabelText("Tìm trong kho tri thức"), {
    target: { value: "chán chả muốn nói" }
  });

  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(1));
});

test("chế độ bảng liệt kê đủ mọi mẩu bằng chữ", async () => {
  const { container } = render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(container.querySelectorAll(".kgx-node").length).toBe(4));

  fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));

  const rows = container.querySelectorAll(".kgx-table tbody tr");
  expect(rows).toHaveLength(4);
  expect(screen.getByText("Tổng đài 111")).toBeInTheDocument();
  // Nhóm hiện thành chữ trong bảng — đây là phần bù cho màu xanh ngọc có độ
  // tương phản thấp trên nền trắng
  expect(screen.getAllByText("Ranh giới & hỗ trợ").length).toBeGreaterThan(0);
});

test("backend hỏng thì báo rõ, không vỡ trang", async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));
  render(<KnowledgeGraphExplorer />);
  await waitFor(() => expect(screen.getByText(/Chưa tải được kho tri thức/)).toBeInTheDocument());
});
