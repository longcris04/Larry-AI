// Bài kiểm tra cho bộ lọc của bảng "Các lớp đã tạo tài khoản".
//
// Chỉ kiểm phần LỌC, không kiểm mấy ô số liệu ở trên — chúng chỉ in lại thứ máy
// chủ gửi xuống, còn bốn ô chọn ở đây tự tính lấy danh sách lựa chọn từ dữ liệu,
// và đó mới là chỗ sai được.
//
// Điều đáng kiểm nhất là các ô chọn ĂN THEO NHAU: chọn trường xong thì ô Lớp chỉ
// còn lớp của trường đó. Không có tính chất này thì quản trị viên bấm được những
// tổ hợp không tồn tại và nhìn ra một cái bảng trống, không hiểu vì sao.

import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import AdminDashboard from "./AdminDashboard";

jest.mock("axios");

// Hai trường, để kiểm phần ăn theo nhau. Đoàn Thị Điểm có ba lớp thuộc hai khối
// và một lớp CHƯA CÓ GVCN; Lê Quý Đôn có một lớp trùng tên "6A1" — trùng tên lớp
// giữa hai trường là chuyện bình thường và bộ lọc phải chịu được.
const BY_CLASS = [
  {
    key: "dtd|6a1", school: "Đoàn Thị Điểm", className: "6A1", grade: "6",
    teacherName: "Cô Lan", teacherStatus: "approved",
    students: 30, activeStudents: 12, sessions: 40, flagged: 5, high: 1, lastActivityAt: null
  },
  {
    key: "dtd|6a2", school: "Đoàn Thị Điểm", className: "6A2", grade: "6",
    teacherName: "", teacherStatus: "",
    students: 28, activeStudents: 3, sessions: 10, flagged: 0, high: 0, lastActivityAt: null
  },
  {
    key: "dtd|7b1", school: "Đoàn Thị Điểm", className: "7B1", grade: "7",
    teacherName: "Thầy Nam", teacherStatus: "pending",
    students: 31, activeStudents: 8, sessions: 22, flagged: 2, high: 0, lastActivityAt: null
  },
  {
    key: "lqd|6a1", school: "Lê Quý Đôn", className: "6A1", grade: "6",
    teacherName: "Cô Hoa", teacherStatus: "approved",
    students: 27, activeStudents: 5, sessions: 15, flagged: 1, high: 0, lastActivityAt: null
  }
];

const STATS = {
  range: { from: "2026-07-22", to: "2026-08-20", days: 30 },
  accounts: {
    students: 116, teachers: 3, teachersApproved: 2, teachersPending: 1,
    newStudents: 10, newTeachers: 1
  },
  classes: { total: 4, schools: 2, withTeacher: 2, withoutTeacher: 2 },
  conversations: {
    sessions: 87, messages: 900, flagged: 8, high: 1, medium: 3, low: 4,
    alerts: 2, activeStudents: 28
  },
  unassigned: { students: 0, sessions: 0, flagged: 0 },
  daily: [],
  byClass: BY_CLASS,
  bySchool: [],
  byCategory: []
};

const CLASSES_TABLE = "Các lớp đã tạo tài khoản";

// Ba bảng trên cùng màn hình nên phải gọi đúng tên, đừng bám vào thứ tự: thêm
// một bảng nữa là bài test hỏng mà chẳng liên quan gì tới bộ lọc.
const classTable = () => within(screen.getByRole("table", { name: CLASSES_TABLE }));

// Tên lớp nằm ở cột 2 — đọc ra để biết bảng còn đúng những dòng nào.
function shownClasses() {
  return classTable()
    .getAllByRole("row")
    .slice(1) // bỏ dòng tiêu đề
    .map((tr) => within(tr).getAllByRole("cell")[1].textContent);
}

// Bốn ô chọn có tên riêng nên hỏi thẳng từ màn hình, không cần khoanh vùng
const control = (name) => screen.getByLabelText(name);

function pick(label, value) {
  fireEvent.change(control(`Lọc theo ${label}`), { target: { value } });
}

function search(text) {
  fireEvent.change(control("Tìm trong bảng lớp"), { target: { value: text } });
}

const optionsOf = (label) =>
  within(control(`Lọc theo ${label}`))
    .getAllByRole("option")
    .map((o) => o.textContent);

async function setup() {
  render(<AdminDashboard />);
  await screen.findByRole("table", { name: CLASSES_TABLE });
}

beforeEach(() => {
  axios.get.mockResolvedValue({ data: STATS });
});

test("chưa lọc thì hiện đủ bốn lớp", async () => {
  await setup();
  expect(shownClasses()).toEqual(["6A1", "6A2", "7B1", "6A1"]);
  expect(screen.getByText("4 lớp")).toBeInTheDocument();
});

test("lọc theo trường", async () => {
  await setup();
  pick("Trường", "Lê Quý Đôn");

  expect(shownClasses()).toEqual(["6A1"]);
  expect(screen.getByText("1 / 4 lớp khớp")).toBeInTheDocument();
});

test("lọc theo khối", async () => {
  await setup();
  pick("Khối", "7");
  expect(shownClasses()).toEqual(["7B1"]);
});

test("lọc theo lớp — trùng tên giữa hai trường thì ra cả hai", async () => {
  await setup();
  pick("Lớp", "6A1");
  expect(shownClasses()).toEqual(["6A1", "6A1"]);
});

test("lọc theo GVCN", async () => {
  await setup();
  pick("GVCN", "Thầy Nam");
  expect(shownClasses()).toEqual(["7B1"]);
});

// Đây là câu hỏi hay gặp nhất ở bảng này: lớp nào chưa có ai chủ nhiệm để đi
// nhắc. Ô trống phải chọn được, không thể chỉ có mấy cái tên.
test("lọc ra lớp CHƯA CÓ giáo viên chủ nhiệm", async () => {
  await setup();
  const select = control("Lọc theo GVCN");
  const none = within(select).getByText(/Chưa có GVCN/);

  fireEvent.change(select, { target: { value: none.getAttribute("value") } });

  expect(shownClasses()).toEqual(["6A2"]);
});

// Tính chất quan trọng nhất: bốn ô ăn theo nhau nên không bấm ra được tổ hợp rỗng.
test("chọn trường xong thì ô Lớp chỉ còn lớp của trường đó", async () => {
  await setup();
  expect(optionsOf("Lớp")).toEqual(["Tất cả lớp (4)", "6A1 (2)", "6A2 (1)", "7B1 (1)"]);

  pick("Trường", "Lê Quý Đôn");

  expect(optionsOf("Lớp")).toEqual(["Tất cả lớp (1)", "6A1 (1)"]);
  // Ô Trường KHÔNG được tự thu hẹp theo chính nó, nếu không thì không đổi sang
  // trường khác được nữa.
  expect(optionsOf("Trường")).toEqual([
    "Tất cả trường (4)",
    "Đoàn Thị Điểm (3)",
    "Lê Quý Đôn (1)"
  ]);
});

test("hai bộ lọc chồng nhau cùng ăn", async () => {
  await setup();
  pick("Trường", "Đoàn Thị Điểm");
  pick("Khối", "6");

  expect(shownClasses()).toEqual(["6A1", "6A2"]);
});

// Gõ không dấu vẫn ra — cả bảng này toàn tên có dấu (xem utils/search.js).
test("ô tìm nhanh gõ không dấu vẫn ra, và thu hẹp luôn các ô chọn", async () => {
  await setup();
  search("doan thi diem");

  expect(shownClasses()).toEqual(["6A1", "6A2", "7B1"]);
  expect(optionsOf("Trường")).toEqual(["Tất cả trường (3)", "Đoàn Thị Điểm (3)"]);
});

// Bốn ô chọn ăn theo nhau nên KHÔNG bấm ra được tổ hợp rỗng — chọn Lê Quý Đôn
// xong thì ô Khối không còn mục "7" để mà chọn. Bảng trống chỉ tới được từ ô gõ
// chữ, vì ô đó lọc trước và không đụng gì tới lựa chọn đang đặt ở bốn ô kia.
test("chọn xong thì ô kia không còn mục nào bấm ra bảng trống", async () => {
  await setup();
  pick("Trường", "Lê Quý Đôn");

  const khoi = control("Lọc theo Khối");
  expect(within(khoi).queryByText(/^7 /)).toBeNull();
  expect(within(khoi).getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Tất cả khối (1)",
    "6 (1)"
  ]);
});

test("không khớp gì thì báo rõ và có nút xoá bộ lọc", async () => {
  await setup();
  pick("Trường", "Lê Quý Đôn");
  // 7B1 là lớp của trường KIA — tìm ra nó rồi lọc theo trường này thì còn 0 dòng
  search("7B1");

  expect(screen.getByText(/Không có lớp nào khớp/)).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "Xoá bộ lọc" })[0]);

  expect(shownClasses()).toEqual(["6A1", "6A2", "7B1", "6A1"]);
});

// Bỏ chọn được là điều kiện để bộ lọc không thành cái bẫy. Mục đang chọn phải ở
// lại trong ô kể cả khi nó vừa bị lọc về 0 dòng — biến mất thì không còn cách
// nào bỏ chọn nó, và bảng cứ trống mãi.
test("mục đang chọn vẫn còn trong ô để bỏ chọn, dù đã về 0 dòng", async () => {
  await setup();
  pick("Trường", "Lê Quý Đôn");
  search("7B1");

  const truong = control("Lọc theo Trường");
  expect(within(truong).getByText("Lê Quý Đôn (0)")).toBeInTheDocument();

  fireEvent.change(truong, { target: { value: "" } });
  expect(shownClasses()).toEqual(["7B1"]);
});

// --- Bảng "Các trường đã tạo tài khoản" --------------------------------------
//
// Hai tính chất đáng kiểm, và cả hai đều là chỗ dễ sai lặng lẽ:
//
//   1. Bấm tiêu đề cột đi qua BA trạng thái và trạng thái thứ ba phải trả bảng về
//      đúng thứ tự máy chủ gửi xuống — không có đường về thì "trường cần chú ý
//      lên đầu" mất luôn cho tới khi tải lại cả trang.
//   2. Xếp lại thì phải về trang đầu. Không thì bấm xếp lúc đang ở trang 2 sẽ
//      hiện ra mấy dòng giữa bảng, trông y hệt một cách xếp sai.

const SCHOOLS_TABLE = "Các trường đã tạo tài khoản";

// Bốn trường, mỗi cột một bộ giá trị khác nhau, và thứ tự trong mảng KHÔNG trùng
// với thứ tự của bất kỳ cột nào — đó chính là thứ tự mặc định phải quay về được.
// Bến Tre và Đông Hà cùng 0 email cảnh báo, để kiểm phần so bù theo tên trường.
const SORT_SCHOOLS = [
  { key: "a", school: "An Dương", classes: 5, students: 300, teachers: 2, sessions: 10, flagged: 3, high: 1, alerts: 4 },
  { key: "b", school: "Bến Tre", classes: 12, students: 90, teachers: 7, sessions: 40, flagged: 1, high: 0, alerts: 0 },
  { key: "c", school: "Cửa Lò", classes: 3, students: 500, teachers: 1, sessions: 25, flagged: 9, high: 5, alerts: 2 },
  { key: "d", school: "Đông Hà", classes: 8, students: 200, teachers: 4, sessions: 5, flagged: 0, high: 0, alerts: 0 }
];

// Mười hai trường: vừa đủ hai trang để kiểm phần cắt trang.
const PAGE_SCHOOLS = Array.from({ length: 12 }, (_, i) => ({
  key: `p${i}`,
  school: `Trường ${String(i + 1).padStart(2, "0")}`,
  classes: 1, students: 1, teachers: 1, sessions: 1, flagged: 0, high: 0, alerts: 0
}));

async function setupSchools(rows) {
  axios.get.mockResolvedValue({ data: { ...STATS, bySchool: rows } });
  render(<AdminDashboard />);
  await screen.findByRole("table", { name: SCHOOLS_TABLE });
}

const schoolTable = () => within(screen.getByRole("table", { name: SCHOOLS_TABLE }));

// Cột đầu là tên trường — đọc ra để biết bảng đang xếp thế nào
function shownSchools() {
  return schoolTable()
    .getAllByRole("row")
    .slice(1)
    .map((tr) => within(tr).getAllByRole("cell")[0].textContent);
}

// Chữ "đang xem" cũng có trong lời dẫn của thẻ bảng lớp ("…tính trong khoảng
// đang xem"), nên phải hỏi bên trong đúng hàng phân trang của bảng trường.
const schoolPager = () =>
  within(screen.getByRole("group", { name: "Phân trang bảng trường" }));

const sortBy = (label) =>
  fireEvent.click(schoolTable().getByRole("button", { name: new RegExp(`^(Sắp xếp theo|Đang xếp) ${label}`) }));

test("bảng trường: bấm tiêu đề cột xếp giảm dần, rồi tăng dần, rồi về mặc định", async () => {
  await setupSchools(SORT_SCHOOLS);
  expect(shownSchools()).toEqual(["An Dương", "Bến Tre", "Cửa Lò", "Đông Hà"]);

  sortBy("Học sinh");
  expect(shownSchools()).toEqual(["Cửa Lò", "An Dương", "Đông Hà", "Bến Tre"]);

  sortBy("Học sinh");
  expect(shownSchools()).toEqual(["Bến Tre", "Đông Hà", "An Dương", "Cửa Lò"]);

  sortBy("Học sinh");
  expect(shownSchools()).toEqual(["An Dương", "Bến Tre", "Cửa Lò", "Đông Hà"]);
});

test("bảng trường: xếp được theo cả bảy cột số", async () => {
  await setupSchools(SORT_SCHOOLS);

  sortBy("Lớp");
  expect(shownSchools()).toEqual(["Bến Tre", "Đông Hà", "An Dương", "Cửa Lò"]);

  // Bấm cột khác thì cột cũ tự tắt — hai cách xếp không chồng lên nhau được
  sortBy("Hội thoại");
  expect(shownSchools()).toEqual(["Bến Tre", "Cửa Lò", "An Dương", "Đông Hà"]);

  sortBy("Khẩn cấp");
  expect(shownSchools()).toEqual(["Cửa Lò", "An Dương", "Bến Tre", "Đông Hà"]);
});

// Phần so bù luôn tăng dần theo tên, dù mũi tên đang chỉ chiều nào: lật cả nó thì
// mấy dòng bằng nhau đảo chỗ lẫn nhau và trông như bảng vừa đổi thêm thứ gì đó.
test("bảng trường: bằng nhau thì xếp theo tên trường, chiều nào cũng vậy", async () => {
  await setupSchools(SORT_SCHOOLS);

  sortBy("Cảnh báo đã gửi");
  expect(shownSchools()).toEqual(["An Dương", "Cửa Lò", "Bến Tre", "Đông Hà"]);

  sortBy("Cảnh báo đã gửi");
  expect(shownSchools()).toEqual(["Bến Tre", "Đông Hà", "Cửa Lò", "An Dương"]);
});

test("bảng trường: ô tiêu đề khai chiều đang xếp cho trình đọc màn hình", async () => {
  await setupSchools(SORT_SCHOOLS);
  const header = () => schoolTable().getByRole("columnheader", { name: /Học sinh/ });

  expect(header()).toHaveAttribute("aria-sort", "none");
  sortBy("Học sinh");
  expect(header()).toHaveAttribute("aria-sort", "descending");
  sortBy("Học sinh");
  expect(header()).toHaveAttribute("aria-sort", "ascending");
});

test("bảng trường: mười dòng một trang, đi tới cuối rồi về đầu", async () => {
  await setupSchools(PAGE_SCHOOLS);

  expect(shownSchools()).toHaveLength(10);
  expect(shownSchools()[0]).toBe("Trường 01");
  expect(schoolPager().getByText(/đang xem/)).toHaveTextContent("đang xem 1–10 trong 12");

  fireEvent.click(screen.getByRole("button", { name: "Tới trang cuối" }));
  expect(shownSchools()).toEqual(["Trường 11", "Trường 12"]);
  expect(schoolPager().getByText(/đang xem/)).toHaveTextContent("đang xem 11–12 trong 12");

  fireEvent.click(screen.getByRole("button", { name: "Về trang đầu" }));
  expect(shownSchools()[0]).toBe("Trường 01");
});

test("bảng trường: xếp lại thì quay về trang đầu", async () => {
  await setupSchools(PAGE_SCHOOLS);

  fireEvent.click(screen.getByRole("button", { name: /^Sau/ }));
  expect(shownSchools()).toEqual(["Trường 11", "Trường 12"]);

  sortBy("Học sinh");
  expect(shownSchools()).toHaveLength(10);
  expect(schoolPager().getByText(/đang xem/)).toHaveTextContent("đang xem 1–10 trong 12");
});
