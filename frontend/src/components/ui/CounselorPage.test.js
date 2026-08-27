// Phòng tâm lý học đường nhận ĐÚNG giao diện của khu vực quản trị, trừ quyền
// sửa/xoá/duyệt tài khoản.
//
// Bảng tài khoản KHÔNG bị thay bằng ô giả ở đây, khác với AdminDashboard và tab
// tần suất: chính nó là thứ phải giống trang quản trị, mà "giống" thì chỉ chứng
// minh được bằng cách dựng bảng thật rồi lọc thử.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import CounselorPage from "./CounselorPage";

jest.mock("axios");
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./AdminDashboard", () => (props) => (
  <div data-testid="dashboard-url">{props.statsUrl}</div>
));
jest.mock("./UsageFrequency", () => (props) => (
  <div data-testid="usage-scope">{props.apiScope}</div>
));

const counselor = {
  id: 8,
  role: "counselor",
  username: "tham-van",
  status: "approved",
  profile: { fullName: "Nguyễn Tâm", school: "THCS A" }
};

const account = (over) => ({
  status: "approved",
  sessionCount: 0,
  flaggedCount: 0,
  highRiskCount: 0,
  lastSessionAt: "",
  profile: {},
  ...over
});

const USERS = [
  counselor,
  account({ id: 1, role: "user", username: "hoc-sinh", phone: "0900000001",
    profile: { fullName: "Trần An", school: "THCS A", className: "6A1", grade: "6" },
    sessionCount: 5, flaggedCount: 3, highRiskCount: 1 }),
  account({ id: 2, role: "user", username: "hoc-sinh-2", phone: "0900000002",
    profile: { fullName: "Lê Bình", school: "THCS A", className: "7B1", grade: "7" },
    sessionCount: 12 }),
  account({ id: 3, role: "teacher", username: "co-lan", phone: "0900000003",
    profile: { fullName: "Cô Lan", school: "THCS A", className: "6A1" } })
];

beforeEach(() => {
  useAuth.mockReturnValue({ user: counselor, logout: jest.fn() });
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/api/counselor/users")) {
      return Promise.resolve({ data: { counselor, users: USERS } });
    }
    if (url.endsWith("/api/counselor/users/1/sessions")) {
      return Promise.resolve({
        data: { user: USERS[1], sessions: [{ id: "s1", startedAt: "2026-08-20T02:00:00Z", messageCount: 4 }] }
      });
    }
    return Promise.reject(new Error(`URL không mong đợi: ${url}`));
  });
});

const shownUsers = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => within(tr).getAllByRole("cell")[0].textContent);

const facet = (label) => screen.getByLabelText(`Lọc theo ${label}`);

async function setup() {
  render(<CounselorPage />);
  await screen.findByRole("table");
}

test("phòng tâm lý dùng API theo trường và nhận đúng bảng tài khoản của quản trị viên", async () => {
  await setup();

  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/counselor\/users$/));
  expect(screen.getByTestId("dashboard-url")).toHaveTextContent("/api/counselor/stats");
  expect(shownUsers()).toEqual([
    "tham-van (bạn)Nguyễn Tâm",
    "hoc-sinhTrần An",
    "hoc-sinh-2Lê Bình",
    "co-lanCô Lan"
  ]);

  fireEvent.click(screen.getByRole("tab", { name: /Tần suất sử dụng/ }));
  expect(screen.getByTestId("usage-scope")).toHaveTextContent("counselor");
});

test("đủ bốn ô lọc ăn theo nhau, ô tìm kiếm và ba cột số xếp được — y như trang quản trị", async () => {
  await setup();

  // Bốn ô chọn, kèm số lượng từng mục
  expect(within(facet("Vai trò")).getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Tất cả vai trò (4)",
    "Học sinh (2)",
    "Giáo viên chủ nhiệm (1)",
    "Phòng tâm lý học đường (1)"
  ]);

  // Ô Lớp thu hẹp theo ô Vai trò — chính là tính chất "ăn theo nhau"
  fireEvent.change(facet("Vai trò"), { target: { value: "user" } });
  expect(shownUsers()).toEqual(["hoc-sinhTrần An", "hoc-sinh-2Lê Bình"]);
  expect(within(facet("Lớp")).getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Tất cả lớp (2)",
    "6A1 (1)",
    "7B1 (1)"
  ]);

  fireEvent.change(facet("Vai trò"), { target: { value: "" } });

  // Ô tìm kiếm bỏ dấu vẫn ra
  fireEvent.change(screen.getByLabelText("Tìm tài khoản"), { target: { value: "co lan" } });
  expect(shownUsers()).toEqual(["co-lanCô Lan"]);
  fireEvent.click(screen.getAllByRole("button", { name: "Xoá bộ lọc" })[0]);

  // Ba cột số bấm được, lần đầu là giảm dần
  fireEvent.click(screen.getByRole("button", { name: /^Sắp xếp theo Hội thoại/ }));
  expect(shownUsers()[0]).toBe("hoc-sinh-2Lê Bình");
});

test("không có nút sửa, xoá hay duyệt tài khoản", async () => {
  await setup();

  expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Duyệt|Gỡ duyệt/ })).toBeNull();
});

test("mở được lịch sử hội thoại của một học sinh qua API của trường", async () => {
  await setup();

  const rows = within(screen.getByRole("table")).getAllByRole("row");
  const student = rows.find((tr) => tr.textContent.includes("Trần An"));
  fireEvent.click(within(student).getByRole("button", { name: "Hội thoại" }));

  await waitFor(() =>
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/counselor\/users\/1\/sessions$/)
    )
  );
  expect(await screen.findByText(/Hội thoại của/)).toBeInTheDocument();

  // Phiên khẩn cấp, nhưng phòng tâm lý không có endpoint gửi email cảnh báo —
  // nút mọc ra ở đây là nút bấm vào lỗi.
  expect(screen.queryByRole("button", { name: /Cảnh báo GVCN/ })).toBeNull();
});
