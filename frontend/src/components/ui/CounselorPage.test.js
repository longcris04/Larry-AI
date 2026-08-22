import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import CounselorPage from "./CounselorPage";

jest.mock("axios");
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./AdminDashboard", () => (props) => (
  <div data-testid="dashboard-url">{props.statsUrl}</div>
));
jest.mock("./ReadOnlyAccounts", () => ({ accounts }) => (
  <div data-testid="readonly-accounts">{accounts.map((item) => item.username).join(",")}</div>
));
jest.mock("./UsageFrequency", () => (props) => (
  <div data-testid="usage-scope">{props.apiScope}</div>
));

const counselor = {
  id: 8,
  role: "counselor",
  username: "tham-van",
  profile: { fullName: "Nguyễn Tâm", school: "THCS A" }
};

beforeEach(() => {
  useAuth.mockReturnValue({ user: counselor, logout: jest.fn() });
  axios.get.mockResolvedValue({
    data: {
      counselor,
      users: [counselor, { id: 1, role: "user", username: "hoc-sinh", profile: {} }]
    }
  });
});

test("phòng tâm lý dùng API theo trường và chỉ nhận giao diện xem", async () => {
  render(<CounselorPage />);

  await waitFor(() =>
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/counselor\/users$/))
  );
  expect(await screen.findByTestId("dashboard-url")).toHaveTextContent("/api/counselor/stats");
  expect(screen.getByTestId("readonly-accounts")).toHaveTextContent("tham-van,hoc-sinh");
  expect(screen.queryByRole("button", { name: /Sửa|Xoá|Xóa/ })).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: /Tần suất sử dụng/ }));
  expect(screen.getByTestId("usage-scope")).toHaveTextContent("counselor");
});
