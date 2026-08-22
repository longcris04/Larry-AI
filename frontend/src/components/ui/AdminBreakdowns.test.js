// Bài kiểm tra cho hai thẻ chia nhóm: tài khoản theo khối, và mức độ dùng Larry.
//
// Điều đáng kiểm nhất KHÔNG phải mấy con số in ra — chúng tới thẳng từ máy chủ
// (backend/stats.test.js kiểm phần tính). Đáng kiểm là chuyện ba nút "cách xem"
// thật sự đổi được nội dung, và mỗi cách xem đọc ĐÚNG khoá của nó: khoá ở đây
// khai hai lần, một lần trong backend/stats.js và một lần trong
// AdminBreakdowns.jsx, nên gõ lệch một khoá thì bảng vẽ ra toàn số 0 mà không có
// lỗi nào báo lên.

import { fireEvent, render, screen, within } from "@testing-library/react";

import AdminBreakdowns, { GradeBreakdown, UsageBreakdown } from "./AdminBreakdowns";

const BY_GRADE = {
  grades: ["6", "7", "8", "9", "other"],
  total: { 6: 40, 7: 30, 8: 20, 9: 10, other: 5, all: 105 },
  created: { 6: 4, 7: 3, 8: 2, 9: 1, other: 0, all: 10 },
  withoutSchool: 3,
  otherLabels: [{ label: "Lớp 10", count: 5 }],
  bySchool: [
    { key: "dtd", school: "Đoàn Thị Điểm", 6: 30, 7: 20, 8: 10, 9: 5, other: 0, all: 65, created: 6 },
    { key: "lqd", school: "Lê Quý Đôn", 6: 10, 7: 10, 8: 10, 9: 5, other: 5, all: 40, created: 4 }
  ],
  daily: [
    { date: "2026-08-01", 6: 4, 7: 0, 8: 0, 9: 0, other: 0, all: 4 },
    { date: "2026-08-02", 6: 0, 7: 3, 8: 2, 9: 1, other: 0, all: 6 },
    { date: "2026-08-03", 6: 0, 7: 0, 8: 0, 9: 0, other: 0, all: 0 }
  ]
};

const USAGE = {
  buckets: ["once", "light", "regular", "heavy"],
  total: { once: 12, light: 8, regular: 4, heavy: 2, users: 26, sessions: 140, students: 105, none: 79 },
  bySchool: [
    { key: "dtd", school: "Đoàn Thị Điểm", once: 10, light: 6, regular: 3, heavy: 2, users: 21, sessions: 120, students: 65, none: 44 },
    { key: "lqd", school: "Lê Quý Đôn", once: 2, light: 2, regular: 1, heavy: 0, users: 5, sessions: 20, students: 40, none: 35 }
  ],
  daily: [
    { date: "2026-08-01", once: 3, light: 1, regular: 0, heavy: 0, users: 4, sessions: 8 },
    { date: "2026-08-02", once: 2, light: 2, regular: 1, heavy: 0, users: 5, sessions: 18 },
    { date: "2026-08-03", once: 0, light: 0, regular: 0, heavy: 0, users: 0, sessions: 0 }
  ]
};

const scope = (label) => fireEvent.click(screen.getByRole("button", { name: label }));

// Dựng thẻ rồi đổi luôn sang cách xem cần kiểm. Gọi render trong từng bài chứ
// không phải trong beforeEach — quy tắc của eslint-plugin-testing-library, và
// cũng để đọc một bài là thấy ngay nó đang dựng cái gì.
const showGrade = (view) => {
  render(<GradeBreakdown byGrade={BY_GRADE} />);
  if (view) scope(view);
};

const showUsage = (view) => {
  render(<UsageBreakdown usage={USAGE} />);
  if (view) scope(view);
};

// Đọc một bảng ra thành mảng chuỗi từng dòng, để so cả bảng một lần thay vì dò
// từng ô — thiếu một cột hay lệch một cột đều lộ ra ngay.
function rowsOf(name) {
  return within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => cell.textContent));
}

// --- Thẻ khối lớp ------------------------------------------------------------

describe("Tài khoản học sinh theo khối", () => {
  test("mặc định gộp tất cả các trường, mỗi khối một thanh", () => {
    showGrade();

    expect(screen.getByText("Tổng tài khoản học sinh")).toBeInTheDocument();
    expect(screen.getByText("105")).toBeInTheDocument();

    // Bốn khối 6/7/8/9 phải có mặt đủ, kể cả khối chưa có ai
    for (const label of ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Khối khác"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Ô "khác" phải tự khai nó gồm những gì — con số 5 một mình không nói được
    // đó là 5 em lớp 10 hay 5 em bỏ trống ô khối.
    expect(screen.getByText(/Ô “Khối khác” gồm: Lớp 10 \(5\)/)).toBeInTheDocument();
  });

  test("theo từng trường: mỗi trường một dòng, đủ bốn khối", () => {
    showGrade("Theo từng trường");

    expect(rowsOf("Tài khoản học sinh theo khối theo từng trường")).toEqual([
      ["Trường", "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Khối khác", "Tổng học sinh", "Mới trong khoảng"],
      ["Đoàn Thị Điểm", "30", "20", "10", "5", "—", "65", "6"],
      ["Lê Quý Đôn", "10", "10", "10", "5", "5", "40", "4"]
    ]);

    // Em chưa khai trường không có dòng nào — phải nói ra, không được lặng lẽ
    // để tổng của bảng nhỏ hơn tổng ở trên.
    expect(screen.getByText(/3 tài khoản học sinh chưa khai trường/)).toBeInTheDocument();
  });

  test("theo từng ngày: đổi được sang bảng số, và ngày trống bị bỏ khỏi bảng", () => {
    showGrade("Theo từng ngày");
    fireEvent.click(screen.getByRole("button", { name: "Xem bảng số liệu" }));

    expect(rowsOf("Tài khoản học sinh theo khối theo từng ngày")).toEqual([
      ["Ngày", "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Khối khác", "Tổng"],
      ["01/08/2026", "4", "—", "—", "—", "—", "4"],
      ["02/08/2026", "—", "3", "2", "1", "—", "6"]
    ]);
  });
});

// --- Thẻ mức độ dùng ---------------------------------------------------------

describe("Mức độ sử dụng Larry AI", () => {
  test("mặc định gộp tất cả, bốn khung cộng lại bằng số em có dùng", () => {
    showUsage();

    expect(screen.getByText("Học sinh đã dùng Larry")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();

    for (const label of ["1 lần", "2–5 lần", "6–10 lần", "Trên 10 lần"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // "Không dùng trong khoảng thời gian này" là câu hỏi thứ năm, và nó KHÔNG phải một khung
    expect(screen.getByText("Không dùng trong khoảng thời gian này")).toBeInTheDocument();
    expect(screen.getByText("79")).toBeInTheDocument();
  });

  test("theo từng trường: trường chưa ai dùng nhiều vẫn hiện đủ cột", () => {
    showUsage("Theo từng trường");

    expect(rowsOf("Mức độ sử dụng Larry AI theo từng trường")).toEqual([
      ["Trường", "1 lần", "2–5 lần", "6–10 lần", "Trên 10 lần", "Học sinh có dùng", "Không dùng trong khoảng thời gian này", "Tổng số lượt"],
      ["Đoàn Thị Điểm", "10", "6", "3", "2", "21", "44", "120"],
      ["Lê Quý Đôn", "2", "2", "1", "—", "5", "35", "20"]
    ]);
  });

  test("theo từng ngày: mỗi ngày một dòng", () => {
    showUsage("Theo từng ngày");
    fireEvent.click(screen.getByRole("button", { name: "Xem bảng số liệu" }));

    expect(rowsOf("Mức độ sử dụng Larry AI theo từng ngày")).toEqual([
      ["Ngày", "1 lần", "2–5 lần", "6–10 lần", "Trên 10 lần", "Tổng"],
      ["01/08/2026", "3", "1", "—", "—", "4"],
      ["02/08/2026", "2", "2", "1", "—", "5"]
    ]);
  });
});

// Máy chủ chưa deploy lại thì không có hai khối này. Vẽ thẻ rỗng ra trông như số
// liệu bằng 0, trong khi thật ra là chưa có số liệu — hai chuyện khác hẳn nhau.
test("máy chủ đời cũ không trả byGrade/usage thì không vẽ gì", () => {
  const { container } = render(<AdminBreakdowns stats={{ accounts: {} }} />);
  expect(container).toBeEmptyDOMElement();
});
