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

test("chia thành ba mục, lọc học sinh và chọn tất cả kết quả đã lọc", async () => {
  await setup();

  expect(screen.getByRole("heading", { name: "1. Chọn tài khoản" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "2. Biểu đồ tần suất sử dụng" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "3. Nội dung hội thoại" })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Lọc theo Trường"), {
    target: { value: "THCS A" }
  });

  expect(screen.getByRole("checkbox", { name: /Nguyễn An/ })).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /Trần Bình/ })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: /Cô Lan/ })).toBeNull();

  fireEvent.click(screen.getByRole("checkbox", { name: /Chọn tất cả 1 tài khoản/ }));

  expect(screen.getByLabelText("Tần suất của Nguyễn An")).toBeInTheDocument();
  expect(screen.getByText("1 cuộc trong khoảng")).toBeInTheDocument();
  expect(screen.getByText("Cuộc hội thoại")).toBeInTheDocument();
  expect(screen.getByText("Bị gắn cờ")).toBeInTheDocument();
  expect(screen.getByText("Khẩn cấp")).toBeInTheDocument();
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

test("nội dung chỉ tải sau khi mở đúng tài khoản và đúng phiên", async () => {
  await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /Nguyễn An/ }));

  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Mình buồn vì bị bạn trêu.")).toBeNull();

  const account = screen.getByRole("button", { name: /Nguyễn An.*1 cuộc/ });
  expect(within(account).getByText("SĐT: 0901000001")).toBeInTheDocument();
  expect(within(account).getByText("Email: an@example.com")).toBeInTheDocument();
  expect(within(account).getByText("Lớp: 6A1")).toBeInTheDocument();
  expect(within(account).getByText("Trường: THCS A")).toBeInTheDocument();
  fireEvent.click(account);
  expect(axios.get).toHaveBeenCalledTimes(1);

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
