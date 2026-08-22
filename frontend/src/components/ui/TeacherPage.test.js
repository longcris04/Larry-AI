import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";

import { useAuth } from "../../context/AuthContext";
import TeacherPage from "./TeacherPage";

jest.mock("axios");
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const today = new Date().toISOString().slice(0, 10);

const teacher = {
  id: 10,
  role: "teacher",
  status: "approved",
  username: "co-lan",
  phone: "0901000010",
  email: "lan@example.com",
  createdAt: `${today}T00:00:00Z`,
  classLabel: "6A1 · THCS A",
  profile: { fullName: "Cô Lan", school: "THCS A", className: "6A1", grade: "" }
};

const student = {
  id: 1,
  role: "user",
  username: "nguyen-an",
  phone: "0901000001",
  email: "an@example.com",
  createdAt: `${today}T00:00:00Z`,
  profile: { fullName: "Nguyễn An", school: "THCS A", className: "6A1", grade: "6" },
  sessionCount: 3,
  flaggedCount: 2,
  highRiskCount: 1
};

const stats = {
  range: { from: today, to: today, days: 1 },
  accounts: { students: 1, newStudents: 1, newTeachers: 0 },
  conversations: {
    sessions: 3,
    activeStudents: 1,
    flagged: 2,
    high: 1,
    medium: 1,
    low: 0
  },
  daily: [
    {
      date: today,
      newStudents: 1,
      newTeachers: 0,
      sessions: 3,
      flagged: 2,
      high: 1,
      medium: 1,
      low: 0
    }
  ],
  byCategory: [{ code: "bullying", count: 2 }]
};

beforeEach(() => {
  useAuth.mockReturnValue({ user: teacher, logout: jest.fn() });
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/api/teacher/students")) {
      return Promise.resolve({ data: { teacher, students: [student] } });
    }
    if (url.endsWith("/api/teacher/stats")) return Promise.resolve({ data: stats });
    if (url.endsWith("/api/teacher/sessions")) {
      return Promise.resolve({ data: { sessions: [] } });
    }
    return Promise.reject(new Error(`URL không mong đợi: ${url}`));
  });
});

test("giáo viên có tổng quan lớp, bảng tài khoản chỉ đọc và tab tần suất riêng", async () => {
  render(<TeacherPage />);

  expect(await screen.findByRole("heading", { name: "📊 Tổng quan lớp" })).toBeInTheDocument();
  expect(screen.getByText("Cô Lan")).toBeInTheDocument();
  expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Hội thoại theo ngày" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Tài khoản mới theo ngày" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Mức độ và dấu hiệu" })).toBeInTheDocument();

  const accountTable = screen.getByRole("table");
  expect(within(accountTable).getByText("0901000010")).toBeInTheDocument();
  expect(within(accountTable).getByText("an@example.com")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Sửa|Xoá|Xóa/ })).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: /Tần suất sử dụng/ }));
  expect(await screen.findByRole("heading", { name: "📈 Tần suất sử dụng" })).toBeInTheDocument();

  await waitFor(() =>
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/teacher\/sessions$/),
      expect.any(Object)
    )
  );
  expect(axios.get.mock.calls.some(([url]) => url.includes("/api/admin/"))).toBe(false);
});
