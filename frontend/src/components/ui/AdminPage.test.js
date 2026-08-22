// Bài kiểm tra cho thanh lọc và ba cột số xếp được của bảng "Tài khoản người dùng".
//
// Phần SẮP XẾP — ba tính chất đáng tiền nhất, theo thứ tự:
//
//   1. Bấm lần đầu ra GIẢM DẦN — người ta mở bảng này để tìm em nhiều dấu hiệu
//      nhất, không phải để đếm ngược từ 0.
//   2. Bấm cột này thì cột kia TẮT — hai cách xếp cùng một bảng không chồng nhau
//      được, mà một tiêu đề trông như đang bật trong khi không còn tác dụng gì
//      là kiểu lỗi người dùng không bao giờ báo, chỉ thôi tin cái bảng.
//   3. Vòng thứ ba đưa bảng về THỨ TỰ MẶC ĐỊNH — không có nó thì sắp xếp là một
//      chiều, muốn xem lại danh sách như cũ phải tải lại cả trang.
//
// Phần LỌC: bốn ô chọn phải ăn theo nhau và ăn theo cả ô tìm kiếm, nếu không thì
// bấm được những tổ hợp không tồn tại rồi nhìn ra một cái bảng trống.

import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import AdminPage from "./AdminPage";

jest.mock("axios");
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 99, username: "admin1", role: "admin" }, logout: jest.fn() })
}));

// Bảng điều khiển và tab tần suất không liên quan gì tới bảng tài khoản — thay
// bằng hai ô rỗng cho bài test khỏi phải dựng cả màn hình số liệu.
jest.mock("./AdminDashboard", () => () => null);
jest.mock("./UsageFrequency", () => () => null);

// Bốn em, cố ý cho BẰNG NHAU ở vài chỗ để nhìn ra phần so bù:
//   - Bình và Cường cùng 12 phiên, nhưng Cường nhiều phiên gắn cờ hơn
//   - An và Cường cùng 3 phiên gắn cờ, nhưng An có phiên khẩn cấp
// Cố ý KHÔNG khai họ tên: ô đầu bảng in cả tên tài khoản lẫn họ tên, để trống
// thì chữ trong ô đúng bằng tên tài khoản và câu so sánh dưới đọc thẳng ra thứ tự.
const USERS = [
  { id: 1, username: "an", role: "user", status: "approved", phone: "0900000001",
    profile: { school: "Đoàn Thị Điểm", className: "6A1", grade: "6" },
    sessionCount: 5, flaggedCount: 3, highRiskCount: 2, lastSessionAt: "" },
  { id: 2, username: "binh", role: "user", status: "approved", phone: "0900000002",
    profile: { school: "Đoàn Thị Điểm", className: "7B1", grade: "7" },
    sessionCount: 12, flaggedCount: 0, highRiskCount: 0, lastSessionAt: "" },
  { id: 3, username: "cuong", role: "user", status: "approved", phone: "0900000003",
    profile: { school: "Lê Quý Đôn", className: "6A1", grade: "6" },
    sessionCount: 12, flaggedCount: 3, highRiskCount: 0, lastSessionAt: "" },
  { id: 4, username: "dung", role: "user", status: "approved", phone: "0900000004",
    profile: { school: "Lê Quý Đôn", className: "9A6", grade: "9" },
    sessionCount: 0, flaggedCount: 0, highRiskCount: 0, lastSessionAt: "" }
];

// Đủ ba vai trò, để kiểm ô chọn "Vai trò". Cô Lan chủ nhiệm 6A1 của Đoàn Thị
// Điểm; quản trị viên không khai trường lớp gì cả — đúng như ngoài đời, và đó
// cũng là dòng để kiểm mục "— Chưa khai trường —".
const MIXED = [
  ...USERS,
  { id: 5, username: "co-lan", role: "teacher", status: "approved", phone: "0900000005",
    profile: { school: "Đoàn Thị Điểm", className: "6A1", grade: "" },
    sessionCount: 0, flaggedCount: 0, highRiskCount: 0, lastSessionAt: "" },
  { id: 6, username: "quantri", role: "admin", status: "approved", phone: "0900000006",
    profile: {}, sessionCount: 0, flaggedCount: 0, highRiskCount: 0, lastSessionAt: "" }
];

const usersTable = () => within(screen.getByRole("table"));

// Cột đầu là tên tài khoản. Đọc ra để biết bảng đang xếp/lọc ra những dòng nào.
function shownUsers() {
  return usersTable()
    .getAllByRole("row")
    .slice(1) // bỏ dòng tiêu đề
    .map((tr) => within(tr).getAllByRole("cell")[0].textContent);
}

// Tiêu đề cột bấm được. Hỏi theo chữ đọc lên chứ không theo nhãn trần: nhãn "Hội
// thoại" trùng đúng với cái nút mở lịch sử hội thoại ở mỗi dòng.
const sortButton = (label) =>
  screen.getByRole("button", { name: new RegExp(`^(Sắp xếp theo|Đang xếp) ${label}`) });

const facet = (label) => screen.getByLabelText(`Lọc theo ${label}`);

const pick = (label, value) => fireEvent.change(facet(label), { target: { value } });

const search = (text) =>
  fireEvent.change(screen.getByLabelText("Tìm tài khoản"), { target: { value: text } });

const optionsOf = (label) =>
  within(facet(label))
    .getAllByRole("option")
    .map((o) => o.textContent);

function mockUsers(list) {
  axios.get.mockImplementation((url) =>
    url.endsWith("/api/admin/users")
      ? Promise.resolve({ data: { users: list } })
      : Promise.resolve({ data: { guestMode: true, ttsEnabled: true, voice: { tts: true } } })
  );
}

async function setup(list = USERS) {
  mockUsers(list);
  render(<AdminPage />);
  await screen.findByRole("table");
}

beforeEach(() => {
  mockUsers(USERS);
});

// --- Sắp xếp -----------------------------------------------------------------

test("chưa bấm gì thì giữ nguyên thứ tự máy chủ trả về", async () => {
  await setup();
  expect(shownUsers()).toEqual(["an", "binh", "cuong", "dung"]);
});

test("bấm lần đầu vào Hội thoại là GIẢM DẦN", async () => {
  await setup();
  fireEvent.click(sortButton("Hội thoại"));

  // 12, 12, 5, 0 — hai em cùng 12 thì em nhiều dấu hiệu hơn (cuong) lên trước
  expect(shownUsers()).toEqual(["cuong", "binh", "an", "dung"]);
});

test("bấm lần hai thì đảo thành tăng dần", async () => {
  await setup();
  fireEvent.click(sortButton("Hội thoại"));
  fireEvent.click(sortButton("Hội thoại"));

  expect(shownUsers()).toEqual(["dung", "an", "cuong", "binh"]);
});

test("bấm lần ba thì về đúng thứ tự mặc định", async () => {
  await setup();
  const cot = () => sortButton("Hội thoại");

  fireEvent.click(cot());
  fireEvent.click(cot());
  fireEvent.click(cot());

  expect(shownUsers()).toEqual(["an", "binh", "cuong", "dung"]);
  expect(cot()).toHaveAttribute("aria-pressed", "false");
});

test("xếp theo Bị gắn cờ, bằng nhau thì em có phiên khẩn cấp lên trước", async () => {
  await setup();
  fireEvent.click(sortButton("Bị gắn cờ"));

  // an và cuong cùng 3 phiên gắn cờ, nhưng an có 2 phiên khẩn cấp
  expect(shownUsers()).toEqual(["an", "cuong", "binh", "dung"]);
});

test("xếp theo Khẩn cấp", async () => {
  await setup();
  fireEvent.click(sortButton("Khẩn cấp"));

  expect(shownUsers()[0]).toBe("an"); // em duy nhất có phiên khẩn cấp
});

// Một tiêu đề trông như đang bật trong khi không còn tác dụng gì là kiểu lỗi
// người dùng không báo, chỉ thôi tin cái bảng.
test("bấm cột này thì cột kia tắt", async () => {
  await setup();

  fireEvent.click(sortButton("Hội thoại"));
  expect(sortButton("Hội thoại")).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(sortButton("Bị gắn cờ"));
  expect(sortButton("Bị gắn cờ")).toHaveAttribute("aria-pressed", "true");
  expect(sortButton("Hội thoại")).toHaveAttribute("aria-pressed", "false");

  // và cột vừa tắt quay về mời gọi "nhiều nhất lên đầu", không giữ chiều cũ
  expect(sortButton("Hội thoại")).toHaveAccessibleName(/nhiều nhất lên đầu/);
});

test("ba cột số báo chiều đang xếp cho trình đọc màn hình", async () => {
  await setup();
  const cot = () => usersTable().getByRole("columnheader", { name: /Hội thoại/ });

  expect(cot()).toHaveAttribute("aria-sort", "none");

  fireEvent.click(sortButton("Hội thoại"));
  expect(cot()).toHaveAttribute("aria-sort", "descending");

  fireEvent.click(sortButton("Hội thoại"));
  expect(cot()).toHaveAttribute("aria-sort", "ascending");
});

// Lọc trước, xếp sau — nếu ngược lại thì lọc xong thứ tự vừa đặt sẽ mất.
test("sắp xếp chỉ đụng tới phần đang lọc ra", async () => {
  await setup();

  search("cuong");
  fireEvent.click(sortButton("Hội thoại"));

  expect(shownUsers()).toEqual(["cuong"]);
});

// Bảng vừa xếp lại thì trang 3 của thứ tự cũ chẳng còn nghĩa gì — mà đó lại đúng
// là lúc người ta muốn nhìn mấy dòng đầu nhất.
test("đổi cách xếp thì quay về trang đầu", async () => {
  // 25 tài khoản, số phiên tăng dần theo tên, để đủ ba trang
  const many = Array.from({ length: 25 }, (_, i) => ({
    id: 100 + i,
    username: `hs${String(i).padStart(2, "0")}`,
    role: "user",
    status: "approved",
    phone: `09000000${String(i).padStart(2, "0")}`,
    profile: {},
    sessionCount: i,
    flaggedCount: 0,
    highRiskCount: 0,
    lastSessionAt: ""
  }));

  await setup(many);

  fireEvent.click(screen.getByRole("button", { name: /^Sau/ }));
  expect(screen.getByText("2")).toBeInTheDocument(); // Trang 2

  fireEvent.click(sortButton("Hội thoại"));

  expect(screen.getByText("1")).toBeInTheDocument(); // đã về Trang 1
  expect(shownUsers()[0]).toBe("hs24"); // và đúng là em nhiều phiên nhất
});

// --- Bốn ô chọn lọc ----------------------------------------------------------

test("lọc theo vai trò, mục đọc ra tiếng Việt và xếp theo thứ tự cố định", async () => {
  await setup(MIXED);

  // Không xếp theo mã ("admin" lên đầu) mà theo thứ tự của hệ thống, nhóm đông
  // nhất trước. Số in cạnh mỗi mục trả lời "chọn cái này thì được mấy dòng".
  expect(optionsOf("Vai trò")).toEqual([
    "Tất cả vai trò (6)",
    "Học sinh (4)",
    "Giáo viên chủ nhiệm (1)",
    "Quản trị viên (1)"
  ]);

  pick("Vai trò", "teacher");
  expect(shownUsers()).toEqual(["co-lan"]);
});

test("lọc theo trường, lớp, khối", async () => {
  await setup(MIXED);

  pick("Trường", "Lê Quý Đôn");
  expect(shownUsers()).toEqual(["cuong", "dung"]);

  pick("Trường", "");
  pick("Lớp", "6A1");
  expect(shownUsers()).toEqual(["an", "cuong", "co-lan"]);

  pick("Lớp", "");
  pick("Khối", "7");
  expect(shownUsers()).toEqual(["binh"]);
});

// Tính chất quan trọng nhất: các ô ăn theo nhau nên không bấm ra được tổ hợp rỗng.
test("chọn trường xong thì ô Lớp và ô Vai trò chỉ còn thứ của trường đó", async () => {
  await setup(MIXED);

  pick("Trường", "Lê Quý Đôn");

  expect(optionsOf("Lớp")).toEqual(["Tất cả lớp (2)", "6A1 (1)", "9A6 (1)"]);
  expect(optionsOf("Vai trò")).toEqual(["Tất cả vai trò (2)", "Học sinh (2)"]);

  // Ô Trường KHÔNG tự thu hẹp theo chính nó, nếu không thì không đổi sang trường
  // khác được nữa.
  expect(optionsOf("Trường")).toEqual([
    "Tất cả trường (6)",
    "Đoàn Thị Điểm (3)",
    "Lê Quý Đôn (2)",
    "— Chưa khai trường — (1)"
  ]);
});

// "Ai chưa khai trường" là câu hỏi có thật — quản trị viên và mấy tài khoản khai
// thiếu — mà chuỗi rỗng thì đã là giá trị của mục "Tất cả" rồi.
test("chọn được cả ô trống: tài khoản chưa khai trường", async () => {
  await setup(MIXED);

  const select = facet("Trường");
  const trong = within(select).getByText(/Chưa khai trường/);
  fireEvent.change(select, { target: { value: trong.getAttribute("value") } });

  expect(shownUsers()).toEqual(["quantri"]);
});

test("ô tìm kiếm và mấy ô chọn cùng ăn một lúc", async () => {
  await setup(MIXED);

  // Gõ không dấu vẫn ra (xem utils/search.js)
  search("doan thi diem");
  expect(shownUsers()).toEqual(["an", "binh", "co-lan"]);

  // Ô chọn cũng thu hẹp theo ô tìm kiếm
  expect(optionsOf("Lớp")).toEqual(["Tất cả lớp (3)", "6A1 (2)", "7B1 (1)"]);

  pick("Vai trò", "user");
  expect(shownUsers()).toEqual(["an", "binh"]);
});

test("không khớp gì thì báo rõ và có nút xoá bộ lọc", async () => {
  await setup(MIXED);

  pick("Trường", "Lê Quý Đôn");
  search("binh"); // Bình học trường KIA

  expect(screen.getByText(/Không có tài khoản nào khớp/)).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "Xoá bộ lọc" })[0]);

  expect(shownUsers()).toEqual(["an", "binh", "cuong", "dung", "co-lan", "quantri"]);
});
