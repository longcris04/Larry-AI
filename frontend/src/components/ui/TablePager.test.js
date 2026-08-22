// Bài kiểm tra cho hàng phân trang dùng chung của trang quản trị.
//
// Đáng kiểm vì đây là chỗ dễ lệch một đơn vị nhất trong cả trang: trang đếm từ 0
// trong mã nguồn nhưng in ra từ 1, còn hai nút nhảy ±5 thì phải KẸP lại chứ
// không được nhảy ra ngoài bảng. Sai một trong hai chuyện đó thì bảng hiện ra
// trống trơn trong khi vẫn còn dữ liệu — và không có lỗi nào báo lên.

import { fireEvent, render, screen } from "@testing-library/react";

import TablePager from "./TablePager";

function setup(props) {
  const onPage = jest.fn();
  render(
    <TablePager
      page={0}
      pages={9}
      pageSize={10}
      total={87}
      unit="tài khoản"
      onPage={onPage}
      {...props}
    />
  );
  return onPage;
}

const click = (name) => fireEvent.click(screen.getByRole("button", { name }));

test("in ra số trang đếm từ 1, kèm khoảng dòng đang xem", () => {
  setup({ page: 2 });
  expect(screen.getByText(/Trang/)).toHaveTextContent("Trang 3 / 9");
  expect(screen.getByText(/đang xem/)).toHaveTextContent("đang xem 21–30 trong 87");
});

// Dòng cuối cùng của bảng: 87 dòng chia 10 thì trang chót chỉ có 7 dòng, và chữ
// phải nói 81–87 chứ không phải 81–90.
test("trang cuối in đúng số dòng còn lại, không phải một trang đầy", () => {
  setup({ page: 8 });
  expect(screen.getByText(/đang xem/)).toHaveTextContent("đang xem 81–87 trong 87");
});

test("bốn nút đi tới đúng trang", () => {
  const onPage = setup({ page: 3 });

  click("Về trang đầu");
  click("Tới trang cuối");
  click("Trước — 10 tài khoản trước đó");
  click("Sau — 10 tài khoản tiếp theo");

  expect(onPage.mock.calls.map(([n]) => n)).toEqual([0, 8, 2, 4]);
});

test("nhảy ±5 trang", () => {
  const onPage = setup({ page: 5 });

  click("Lùi 5 trang");
  click("Tiến 5 trang");

  expect(onPage.mock.calls.map(([n]) => n)).toEqual([0, 8]); // 10 bị kẹp về 8
});

// Kẹp chứ không phải chặn: đứng ở trang 2 mà bấm "lùi 5 trang" thì về trang đầu,
// không phải trang -3 và cũng không phải một cái nút chết không làm gì cả.
test("nhảy quá đầu bảng thì kẹp về trang đầu", () => {
  const onPage = setup({ page: 1 });
  click("Lùi 5 trang");
  expect(onPage).toHaveBeenCalledWith(0);
});

test("ở trang đầu thì mọi nút lùi đều tắt, ở trang cuối thì mọi nút tiến đều tắt", () => {
  const { unmount } = render(
    <TablePager page={0} pages={9} pageSize={10} total={87} onPage={jest.fn()} />
  );

  expect(screen.getByRole("button", { name: "Về trang đầu" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Lùi 5 trang" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Tới trang cuối" })).toBeEnabled();

  unmount();
  render(<TablePager page={8} pages={9} pageSize={10} total={87} onPage={jest.fn()} />);

  expect(screen.getByRole("button", { name: "Tới trang cuối" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Tiến 5 trang" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Về trang đầu" })).toBeEnabled();
});

// Năm trang trở xuống thì "lùi 5 trang" luôn rơi đúng về trang đầu — hai cái nút
// làm cùng một việc, đứng cạnh nhau.
test("bảng ngắn thì không vẽ hai nút ±5", () => {
  setup({ page: 1, pages: 4, total: 35 });

  expect(screen.queryByRole("button", { name: "Lùi 5 trang" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Tiến 5 trang" })).toBeNull();
  expect(screen.getByRole("button", { name: "Về trang đầu" })).toBeInTheDocument();
});

test("một trang thì không vẽ gì cả", () => {
  const { container } = render(
    <TablePager page={0} pages={1} pageSize={10} total={7} onPage={jest.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
});

// --- Ô "tới trang" -----------------------------------------------------------
//
// Cái đáng kiểm không phải chuyện gõ số rồi nhảy — mà mấy trường hợp quanh nó:
// ô trống, số ngoài khoảng, và chuyện ô phải sạch sau khi nhảy. Không có bài nào
// canh thì mỗi trường hợp đó là một lần bảng nhảy sang trang NaN, tức trang trống.

const jumpBox = () => screen.getByRole("spinbutton", { name: /Tới trang số/ });
const jumpForm = () => screen.getByRole("form", { name: "Chuyển nhanh tới trang" });

// jsdom không tự gửi form khi bấm Enter trong ô nhập (trình duyệt thật thì có,
// vì trong form có một nút type="submit"), nên bắn thẳng sự kiện submit — đúng
// cái mà phím Enter sinh ra.
function typeAndEnter(value) {
  fireEvent.change(jumpBox(), { target: { value } });
  fireEvent.submit(jumpForm());
}

test("gõ số trang rồi Enter thì nhảy thẳng tới trang đó", () => {
  const onPage = setup({ page: 0 });

  typeAndEnter("7");

  // Người đọc đếm trang từ 1, mã đếm từ 0
  expect(onPage).toHaveBeenCalledWith(6);
});

test("nhảy xong thì ô sạch trở lại", () => {
  setup({ page: 0 });

  typeAndEnter("7");

  expect(jumpBox()).toHaveValue(null);
});

// Gõ 999 ở bảng 9 trang nghĩa là "cho tôi tới cuối", không phải một lỗi cần chặn.
test("số ngoài khoảng thì kẹp về trang đầu hoặc trang cuối", () => {
  const onPage = setup({ page: 3 });

  typeAndEnter("999");
  typeAndEnter("0");
  typeAndEnter("-4");

  expect(onPage.mock.calls.map(([n]) => n)).toEqual([8, 0, 0]);
});

test("ô trống thì Enter không làm gì cả", () => {
  const onPage = setup({ page: 3 });

  fireEvent.submit(jumpForm());

  expect(onPage).not.toHaveBeenCalled();
});

test("nút Tới → đi cùng một đường với phím Enter", () => {
  const onPage = setup({ page: 0 });

  fireEvent.change(jumpBox(), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Tới trang vừa gõ" }));

  expect(onPage).toHaveBeenCalledWith(3);
});

// Cùng một lý do với hai nút ±5: năm trang thì mọi trang đều cách một cú bấm, gõ
// số vào ô còn lâu hơn.
test("bảng ngắn thì không vẽ ô tới trang", () => {
  setup({ page: 1, pages: 4, total: 35 });

  expect(screen.queryByRole("spinbutton")).toBeNull();
});
