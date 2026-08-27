import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";

import { todayKey } from "../../utils/days";
import UsageFrequency from "./UsageFrequency";

jest.mock("axios");

const USERS = [
  {
    id: 1,
    role: "user",
    username: "an01",
    email: "an@example.com",
    phone: "0901000001",
    profile: { fullName: "Nguyễn An", school: "THCS A", grade: "6", className: "6A1" }
  },
  {
    id: 2,
    role: "user",
    username: "binh02",
    email: "binh@example.com",
    phone: "0901000002",
    profile: { fullName: "Trần Bình", school: "THCS B", grade: "7", className: "7B1" }
  },
  {
    id: 3,
    role: "teacher",
    username: "giaovien",
    profile: { fullName: "Cô Lan", school: "THCS A", grade: "", className: "6A1" }
  },
  {
    id: 4,
    role: "user",
    username: "cuong08",
    email: "cuong@example.com",
    phone: "0901000004",
    profile: { fullName: "Lê Cường", school: "THCS C", grade: "8", className: "8C1" }
  },
  {
    id: 5,
    role: "user",
    username: "dung09",
    email: "dung@example.com",
    phone: "0901000005",
    profile: { fullName: "Phạm Dung", school: "THCS D", grade: "9", className: "9D1" }
  }
];

function metadata() {
  const today = todayKey();
  return [
    {
      id: "session-1",
      userId: 1,
      startedAt: `${today}T05:00:00Z`,
      endedAt: `${today}T05:20:00Z`,
      messageCount: 2,
      flagged: true,
      riskLevel: "high",
      summary: "Học sinh đang buồn."
    },
    { id: "session-2", userId: 2, startedAt: `${today}T06:00:00Z`, messageCount: 2, flagged: true, riskLevel: "medium" },
    { id: "session-3", userId: 2, startedAt: `${today}T07:00:00Z`, messageCount: 2, flagged: false, riskLevel: "none" },
    { id: "session-4", userId: 2, startedAt: `${today}T08:00:00Z`, messageCount: 2, flagged: false, riskLevel: "none" },
    { id: "session-5", userId: 4, startedAt: `${today}T09:00:00Z`, messageCount: 2, flagged: true, riskLevel: "high" },
    { id: "session-6", userId: 4, startedAt: `${today}T10:00:00Z`, messageCount: 2, flagged: true, riskLevel: "high" }
  ];
}

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/api/admin/sessions/session-1")) {
      return Promise.resolve({
        data: {
          session: metadata()[0],
          messages: [
            { role: "user", content: "Mình buồn vì bị bạn trêu." },
            { role: "assistant", content: "Larry đang lắng nghe bạn." }
          ]
        }
      });
    }
    if (url.endsWith("/api/admin/sessions")) {
      return Promise.resolve({ data: { sessions: metadata() } });
    }
    return Promise.reject(new Error(`URL không mong đợi: ${url}`));
  });
});

async function setup() {
  render(<UsageFrequency users={USERS} />);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
}

// Hai mục đều có chú giải và nút chọn chỉ số, nên hầu hết khẳng định phải nói rõ
// đang xem mục nào: mục 2 là biểu đồ tổng, mục 3 là từng tài khoản.
const totalSection = () => screen.getByRole("region", { name: /^2\./ });
const detailSection = () => screen.getByRole("region", { name: /^3\./ });

test("chia thành ba mục, lọc học sinh và chọn tất cả kết quả đã lọc", async () => {
  await setup();

  expect(screen.getByRole("heading", { name: "1. Chọn tài khoản" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "2. Tổng số cuộc hội thoại theo thời gian" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "3. Tần suất và nội dung hội thoại của từng tài khoản" })
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Lọc theo Trường"), {
    target: { value: "THCS A" }
  });

  expect(screen.getByRole("checkbox", { name: /Nguyễn An/ })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /Trần Bình/ })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: /Cô Lan/ })).toBeNull();

  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 1 tài khoản/ }));

  expect(screen.getByLabelText("Tần suất của Nguyễn An")).toBeInTheDocument();
  expect(screen.getByText("1 cuộc trong khoảng")).toBeInTheDocument();

  const legend = within(detailSection());
  expect(legend.getByText("Cuộc hội thoại")).toBeInTheDocument();
  expect(legend.getByText("Bị gắn cờ")).toBeInTheDocument();
  expect(legend.getByText("Khẩn cấp")).toBeInTheDocument();
});

test("sắp xếp tài khoản theo ba loại số liệu và đổi được chiều", async () => {
  await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 3 tài khoản/ }));

  const chartNames = () =>
    screen.getAllByLabelText(/^Tần suất của /).map((row) => row.getAttribute("aria-label"));

  await waitFor(() =>
    expect(chartNames()).toEqual([
      "Tần suất của Trần Bình",
      "Tần suất của Lê Cường",
      "Tần suất của Nguyễn An"
    ])
  );

  fireEvent.change(screen.getByLabelText("Sắp xếp tài khoản theo"), {
    target: { value: "flagged" }
  });
  expect(chartNames()).toEqual([
    "Tần suất của Lê Cường",
    "Tần suất của Nguyễn An",
    "Tần suất của Trần Bình"
  ]);

  fireEvent.click(screen.getByRole("button", { name: /Đang sắp xếp giảm dần/ }));
  fireEvent.change(screen.getByLabelText("Sắp xếp tài khoản theo"), {
    target: { value: "high" }
  });
  expect(chartNames()).toEqual([
    "Tần suất của Trần Bình",
    "Tần suất của Nguyễn An",
    "Tần suất của Lê Cường"
  ]);
});

test("nội dung chỉ tải sau khi mở đúng phiên", async () => {
  await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /Nguyễn An/ }));

  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Mình buồn vì bị bạn trêu.")).toBeNull();

  const row = screen.getByLabelText("Tài khoản Nguyễn An");
  expect(within(row).getByText("SĐT: 0901000001")).toBeInTheDocument();
  expect(within(row).getByText("Email: an@example.com")).toBeInTheDocument();
  expect(within(row).getByText("Lớp: 6A1")).toBeInTheDocument();
  expect(within(row).getByText("Trường: THCS A")).toBeInTheDocument();
  expect(within(row).getByLabelText("Tần suất của Nguyễn An")).toBeInTheDocument();
  expect(within(row).getByLabelText("Hội thoại của Nguyễn An")).toBeInTheDocument();

  const sessionButton = screen.getByRole("button", { name: /2 tin.*Gắn cờ.*Khẩn cấp/ });
  fireEvent.click(sessionButton);

  expect(await screen.findByText("Mình buồn vì bị bạn trêu.")).toBeInTheDocument();
  expect(screen.getByText("Larry đang lắng nghe bạn.")).toBeInTheDocument();
  expect(screen.getByText("Tóm tắt:").closest(".usage-session-context"))
    .toHaveTextContent("Tóm tắt: Học sinh đang buồn.");
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringMatching(/sessions\/session-1$/));

  const transcript = screen.getByText("Mình buồn vì bị bạn trêu.").closest(".usage-transcript");
  expect(within(transcript).getByText("Học sinh")).toBeInTheDocument();
  expect(within(transcript).getByText("Larry")).toBeInTheDocument();
});

test("scope giáo viên gọi endpoint giáo viên thay vì endpoint quản trị", async () => {
  render(<UsageFrequency users={USERS} apiScope="teacher" />);

  await waitFor(() =>
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/teacher\/sessions$/),
      expect.any(Object)
    )
  );
  expect(axios.get).not.toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/admin\/sessions$/),
    expect.anything()
  );
});

test("chỉ liệt kê học sinh có hội thoại trong khoảng, không phải cả kho tài khoản", async () => {
  await setup();

  expect(screen.getByRole("checkbox", { name: /Nguyễn An/ })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /Trần Bình/ })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /Lê Cường/ })).toBeInTheDocument();

  // Phạm Dung có trong kho tài khoản nhưng không có phiên nào trong khoảng này.
  expect(screen.queryByRole("checkbox", { name: /Phạm Dung/ })).toBeNull();
  expect(screen.getByRole("checkbox", { name: /Chọn tất cả 3 tài khoản/ })).toBeInTheDocument();

  // Ô lọc cũng chỉ dựng từ ba tài khoản còn lại — không còn trường của Phạm Dung.
  const schools = within(screen.getByLabelText("Lọc theo Trường"))
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(schools.some((label) => label.includes("THCS D"))).toBe(false);
});

test("khoảng ngày không có hội thoại thì không cho chọn tài khoản nào", async () => {
  axios.get.mockImplementation((url) =>
    url.endsWith("/api/admin/sessions")
      ? Promise.resolve({ data: { sessions: [] } })
      : Promise.reject(new Error(`URL không mong đợi: ${url}`))
  );

  await setup();

  expect(
    await screen.findByText("Không có tài khoản nào có hội thoại trong khoảng này.")
  ).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByLabelText("Lọc theo Trường")).toBeNull();
});

test("biểu đồ và hội thoại của cùng một tài khoản nằm chung một hàng", async () => {
  await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 3 tài khoản/ }));

  const row = await screen.findByLabelText("Tài khoản Trần Bình");
  expect(within(row).getByLabelText("Tần suất của Trần Bình")).toBeInTheDocument();

  // Ba phiên của Bình nằm trong ĐÚNG hàng của Bình, không phải một mục riêng.
  const talks = within(row).getByLabelText("Hội thoại của Trần Bình");
  expect(within(talks).getAllByRole("button", { name: /tin/ })).toHaveLength(3);
  expect(within(row).getByText("3 cuộc trong khoảng")).toBeInTheDocument();
  expect(within(row).getByText("🚩 1 bị gắn cờ")).toBeInTheDocument();

  // Hàng của An không hề lẫn phiên của Bình.
  const other = screen.getByLabelText("Tài khoản Nguyễn An");
  expect(
    within(within(other).getByLabelText("Hội thoại của Nguyễn An"))
      .getAllByRole("button", { name: /tin/ })
  ).toHaveLength(1);
});

test("nút chọn chỉ số đổi được giữa cả 3 và từng loại một", async () => {
  await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 3 tài khoản/ }));

  const switcher = screen.getByRole("group", { name: "Hiện trên biểu đồ" });
  const chip = (name) => within(switcher).getByRole("button", { name });
  const detail = () => within(detailSection());

  // Mặc định là cả 3 chỉ số, nên chú giải có đủ ba nhãn.
  expect(chip("Cả 3 chỉ số")).toHaveAttribute("aria-pressed", "true");
  expect(detail().getByText("Cuộc hội thoại")).toBeInTheDocument();
  expect(detail().getByText("Bị gắn cờ")).toBeInTheDocument();
  expect(detail().getByText("Khẩn cấp")).toBeInTheDocument();

  fireEvent.click(chip("Cuộc khẩn cấp"));
  expect(chip("Cuộc khẩn cấp")).toHaveAttribute("aria-pressed", "true");
  expect(chip("Cả 3 chỉ số")).toHaveAttribute("aria-pressed", "false");
  expect(detail().queryByText("Cuộc hội thoại")).toBeNull();
  expect(detail().queryByText("Bị gắn cờ")).toBeNull();

  // Mục 2 không hề bị kéo theo — hai biểu đồ có hai nút chọn riêng.
  expect(within(totalSection()).getByText("Cuộc hội thoại")).toBeInTheDocument();

  // Trần Bình không có cuộc khẩn cấp nào nên biểu đồ của em nói đúng chuyện đó,
  // trong khi Nguyễn An vẫn còn cột để vẽ.
  expect(
    detail().getByText("Trần Bình không có cuộc nào khẩn cấp trong khoảng này.")
  ).toBeInTheDocument();
  expect(
    detail().queryByText("Nguyễn An không có cuộc nào khẩn cấp trong khoảng này.")
  ).toBeNull();

  fireEvent.click(chip("Cuộc bị gắn cờ"));
  expect(
    detail().queryByText("Trần Bình không có cuộc nào bị gắn cờ trong khoảng này.")
  ).toBeNull();
});

// --- Biểu đồ tổng của mục 2 -------------------------------------------------
//
// Bộ dữ liệu riêng: ba em ở HAI trường nhưng CÙNG tên lớp "6A1" — đúng cái bẫy
// mà biểu đồ gộp theo lớp phải tránh, gộp nhầm là ra một lớp 3 người không có
// thật.
const GROUP_USERS = [
  { id: 11, role: "user", username: "dieu11", profile: { fullName: "Vũ Diệu", school: "THCS A", grade: "6", className: "6A1" } },
  { id: 12, role: "user", username: "ha12", profile: { fullName: "Đỗ Hà", school: "THCS A", grade: "6", className: "6A1" } },
  { id: 13, role: "user", username: "kien13", profile: { fullName: "Bùi Kiên", school: "THCS B", grade: "6", className: "6A1" } }
];

function groupSessions() {
  const today = todayKey();
  return [
    { id: "g-1", userId: 11, startedAt: `${today}T02:00:00Z`, messageCount: 4, flagged: false, riskLevel: "none" },
    { id: "g-2", userId: 11, startedAt: `${today}T03:00:00Z`, messageCount: 4, flagged: false, riskLevel: "none" },
    { id: "g-3", userId: 12, startedAt: `${today}T04:00:00Z`, messageCount: 4, flagged: true, riskLevel: "high" },
    { id: "g-4", userId: 13, startedAt: `${today}T05:00:00Z`, messageCount: 4, flagged: false, riskLevel: "none" }
  ];
}

async function setupGroups() {
  axios.get.mockImplementation((url) =>
    url.endsWith("/api/admin/sessions")
      ? Promise.resolve({ data: { sessions: groupSessions() } })
      : Promise.reject(new Error(`URL không mong đợi: ${url}`))
  );
  render(<UsageFrequency users={GROUP_USERS} />);
  await screen.findByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc");
}

const groupChip = (name) =>
  within(screen.getByRole("group", { name: "Gộp biểu đồ" })).getByRole("button", { name });

test("biểu đồ tổng gộp theo trường, khối, lớp và luôn ghi rõ lớp thuộc trường nào", async () => {
  await setupGroups();

  // Mặc định: một biểu đồ cho cả tập đã lọc.
  expect(
    within(screen.getByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc"))
      .getByText("3 tài khoản · 4 cuộc")
  ).toBeInTheDocument();

  fireEvent.click(groupChip("Theo lớp"));
  const classA = screen.getByLabelText("Biểu đồ tổng — Lớp 6A1 · THCS A");
  const classB = screen.getByLabelText("Biểu đồ tổng — Lớp 6A1 · THCS B");
  expect(within(classA).getByText("2 tài khoản · 3 cuộc")).toBeInTheDocument();
  expect(within(classB).getByText("1 tài khoản · 1 cuộc")).toBeInTheDocument();
  expect(screen.queryByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc")).toBeNull();

  fireEvent.click(groupChip("Theo khối"));
  expect(screen.getByLabelText("Biểu đồ tổng — Khối 6 · THCS A")).toBeInTheDocument();
  expect(screen.getByLabelText("Biểu đồ tổng — Khối 6 · THCS B")).toBeInTheDocument();

  fireEvent.click(groupChip("Theo trường"));
  expect(
    within(screen.getByLabelText("Biểu đồ tổng — THCS A")).getByText("2 tài khoản · 3 cuộc")
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Biểu đồ tổng — THCS B")).toBeInTheDocument();
});

test("bấm một cột ra đúng những em của ngày đó, bấm tên thì mở chi tiết em đó", async () => {
  await setupGroups();

  const chart = screen.getByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc");
  fireEvent.click(within(chart).getByRole("option", { name: /Cuộc hội thoại 4/ }));

  const rows = within(chart).getAllByRole("button", { name: /›$/ });
  expect(rows.map((row) => row.textContent.replace(/\s+/g, " ").trim())).toEqual([
    "Vũ Diệudieu11 · 6A1 · THCS A2 cuộc ›",
    "Bùi Kiênkien13 · 6A1 · THCS B1 cuộc ›",
    "Đỗ Hàha12 · 6A1 · THCS A1 cuộc · 🚩 1 · ⚠️ 1 ›"
  ]);

  // Chưa bấm tên thì mục 3 vẫn trống — bảng này là đường dẫn tới đó, không phải
  // thứ tự động tích hết mọi người vào.
  expect(screen.getAllByText("Chưa chọn tài khoản nào ở mục 1.")).toHaveLength(1);

  fireEvent.click(rows[0]);
  const detail = screen.getByLabelText("Tài khoản Vũ Diệu");
  expect(within(detail).getByLabelText("Tần suất của Vũ Diệu")).toBeInTheDocument();
  expect(within(detail).getAllByRole("button", { name: /tin/ })).toHaveLength(2);
  expect(screen.queryByLabelText("Tài khoản Bùi Kiên")).toBeNull();
});

test("bảng ngày chỉ đếm đúng loại cuộc hội thoại đang xem", async () => {
  await setupGroups();

  fireEvent.click(
    within(screen.getByRole("group", { name: "Loại cuộc hội thoại" }))
      .getByRole("button", { name: "Cuộc bị gắn cờ" })
  );

  const chart = screen.getByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc");
  fireEvent.click(within(chart).getByRole("option", { name: /Bị gắn cờ 1/ }));

  const rows = within(chart).getAllByRole("button", { name: /›$/ });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent("Đỗ Hà");
});

test("biểu đồ tổng in số trên đầu cả ba cột, ngày không có cuộc nào thì trống hẳn", async () => {
  await setupGroups();

  const printed = (node) =>
    [...node.querySelectorAll(".dash-col__value")].map((tag) => tag.textContent);
  const columns = (node) => [...node.querySelectorAll(".dash-col")];
  const filled = (node) =>
    columns(node).filter((col) => col.querySelectorAll(".dash-col__seg").length);

  // Hôm nay 4 cuộc · 1 gắn cờ · 1 khẩn cấp: đủ ba số, mỗi số trên đầu cột của nó.
  const chart = screen.getByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc");
  expect(printed(chart)).toEqual(["4", "1", "1"]);

  // Số dài nhất ở đây có một chữ số, nên biểu đồ xin bậc chỗ hẹp nhất — CSS dựa
  // vào tên lớp này để biết ô hẹp tới đâu thì ba con số bắt đầu đè nhau.
  expect(chart.querySelector(".dash-chart")).toHaveClass("dash-chart--values", "dash-chart--v1");

  // Sáu ngày còn lại im lặng: không ô nào và không số nào.
  expect(columns(chart)).toHaveLength(7);
  expect(filled(chart)).toHaveLength(1);

  // THCS B có 1 cuộc, không gắn cờ, không khẩn cấp. Hai chuỗi bằng 0 vẫn giữ ô
  // của mình — bỏ ô đi thì cột "cuộc hội thoại" giãn ra chiếm cả chỗ trống và
  // ngày 1/0/0 trông to ngang ngày có đủ ba loại — và vẫn in số 0.
  fireEvent.click(groupChip("Theo trường"));
  const schoolB = screen.getByLabelText("Biểu đồ tổng — THCS B");
  expect(printed(schoolB)).toEqual(["1", "0", "0"]);
  expect(filled(schoolB)[0].querySelectorAll(".dash-col__seg")).toHaveLength(3);

  // Xem một chỉ số thì chỉ còn một cột, nên chỉ một số.
  fireEvent.click(groupChip("Tất cả"));
  fireEvent.click(
    within(screen.getByRole("group", { name: "Loại cuộc hội thoại" }))
      .getByRole("button", { name: "Cuộc bị gắn cờ" })
  );
  expect(printed(screen.getByLabelText("Biểu đồ tổng — Tất cả tài khoản đã lọc")))
    .toEqual(["1"]);

  // Mục 3 xếp nhiều biểu đồ nhỏ cạnh nhau, cột hẹp hơn hẳn: giữ chỗ cho chuỗi
  // bằng 0 như trên, nhưng không in số nào.
  fireEvent.click(screen.getByRole("checkbox", { name: /Vũ Diệu/ }));
  const row = screen.getByLabelText("Tài khoản Vũ Diệu");
  expect(filled(row)[0].querySelectorAll(".dash-col__seg")).toHaveLength(3);
  expect(printed(row)).toEqual([]);
});
