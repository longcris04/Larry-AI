import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

// Định tuyến của cả web, kiểm bằng địa chỉ thật trong jsdom.
//
// Điều quan trọng nhất ở đây: "/" LUÔN mở trang giới thiệu, kể cả khi đã đăng
// nhập. Khung chat có địa chỉ riêng "/chat", và từ trong chat luôn có đường quay
// ra. Trước kia khung chat nằm ngay tại "/" nên người đã đăng nhập mở app lên là
// rơi thẳng vào cuộc trò chuyện, không có lối nào ra.

// jsdom không có scrollTo; khung chat gọi nó mỗi lần có bong bóng mới
beforeAll(() => {
  Element.prototype.scrollTo = () => {};
});

let mockAuth = {};

jest.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth
}));

// Trang giới thiệu kéo theo cả đồ thị kho tri thức; ở đây chỉ cần biết là đã tới
// đúng chỗ.
jest.mock("./components/ui/AboutPage", () => ({
  __esModule: true,
  default: () => <div>Trang giới thiệu Larry</div>
}));

jest.mock("./hooks/usePublicSettings", () => ({
  usePublicSettings: () => ({ guestMode: true, voice: { tts: false }, loading: false })
}));

// Camera thật sẽ nạp model nhận diện — không liên quan gì tới định tuyến
jest.mock("./hooks/useCompanionCamera", () => ({
  useCompanionCamera: () => ({
    status: "off",
    stream: null,
    isOn: false,
    emotion: null,
    emotionReady: false,
    open: jest.fn(),
    close: jest.fn(),
    skipEmotion: jest.fn(),
    unavailable: false
  })
}));

const signedIn = {
  user: { username: "Bé Na", profile: { fullName: "Bé Na" } },
  loading: false,
  isAuthenticated: true,
  isGuest: false,
  isAdmin: false,
  isTeacher: false,
  isCounselor: false,
  logout: jest.fn()
};

const signedOut = { ...signedIn, user: null, isAuthenticated: false };

const go = (path) => window.history.pushState({}, "", path);

beforeEach(() => {
  mockAuth = signedOut;
});

test("chưa đăng nhập, mở địa chỉ gốc thì vào trang giới thiệu", async () => {
  go("/");
  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe("/gioi-thieu"));
  expect(await screen.findByText("Trang giới thiệu Larry")).toBeInTheDocument();
});

test("ĐÃ đăng nhập, mở địa chỉ gốc VẪN vào trang giới thiệu chứ không nhảy thẳng vào chat", async () => {
  mockAuth = signedIn;
  go("/");
  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe("/gioi-thieu"));
  expect(await screen.findByText("Trang giới thiệu Larry")).toBeInTheDocument();
});

test("khung chat nằm ở /chat, và trong đó có nút tài khoản để ra vào", async () => {
  mockAuth = signedIn;
  go("/chat");
  render(<App />);

  expect(await screen.findByText("👤 Tài khoản")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/chat");
});

test("chưa đăng nhập mà mở thẳng /chat thì về trang đăng nhập", async () => {
  go("/chat");
  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe("/login"));
});

test("nút tài khoản mở ra đường về giới thiệu và nút đăng xuất", async () => {
  mockAuth = signedIn;
  go("/chat");
  render(<App />);

  fireEvent.click(await screen.findByText("👤 Tài khoản"));

  // Thẻ tài khoản cuối cột trái cũng in tên, nên bám vào tiêu đề của bảng phụ
  expect(screen.getByRole("heading", { name: "Bé Na" })).toBeInTheDocument();
  expect(screen.getByText("📖 Về trang giới thiệu")).toHaveAttribute("href", "/gioi-thieu");

  fireEvent.click(screen.getByText("👋 Đăng xuất"));
  expect(signedIn.logout).toHaveBeenCalled();
});

test("ĐÃ đăng nhập, mở trang đăng nhập thì dừng lại hỏi chứ không tống thẳng vào chat", async () => {
  mockAuth = signedIn;
  go("/login");
  render(<App />);

  // Không có form đăng nhập nào cả — nó nhận ra mình rồi
  expect(await screen.findByText("Chào Bé Na 👋")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/login");

  // Vào chat là một cái bấm có chủ đích
  fireEvent.click(screen.getByText("Trò chuyện với Larry ngay! 💬"));
  await waitFor(() => expect(window.location.pathname).toBe("/chat"));
});

test("vừa đăng nhập xong thì vào thẳng chat, không phải bấm thêm lần nữa", async () => {
  go("/login");
  const { rerender } = render(<App />);

  // Mở trang lúc chưa đăng nhập → thấy form
  expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();

  // Đăng nhập thành công: AuthContext đổi trạng thái, App vẽ lại
  mockAuth = signedIn;
  rerender(<App />);

  await waitFor(() => expect(window.location.pathname).toBe("/chat"));
});
