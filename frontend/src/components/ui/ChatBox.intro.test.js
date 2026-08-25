import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatBox from "./ChatBox";
import { useIntroScript, READ_BASE_MS, READ_PER_CHAR_MS, readingTime } from "../../hooks/useIntroScript";

// Kịch bản mở đầu chạy NGAY TRONG khung chat, không phải một màn hình riêng.
// Bài này dựng đúng như thật: ChatBox + useIntroScript, rồi đi hết phiếu cảm xúc
// và kiểm xem lượt mở lời bằng model có nổ đúng lúc không.

jest.setTimeout(40000);

// Chạy ở chế độ "giảm chuyển động": chữ hiện ra ngay, các khoảng nghỉ rút xuống
// còn 100ms. Không thì một lượt chạy thử mất hàng chục giây chỉ để xem gõ chữ.
beforeAll(() => {
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  // jsdom không có scrollTo; khung chat gọi nó mỗi lần có bong bóng mới
  Element.prototype.scrollTo = () => {};
});

// Không có backend trong bài này: chặn luôn cả phần gọi model lẫn giọng nói.
const runTurn = jest.fn();
jest.mock("../../hooks/useAgentStream", () => ({
  useAgentStream: () => ({
    messages: [],
    streaming: null,
    steps: [],
    busy: false,
    knowledge: null,
    // eslint-disable-next-line no-undef
    runTurn: mockRunTurn
  })
}));
jest.mock("../../hooks/useVoiceConfig", () => ({ useVoiceConfig: () => ({ tts: false, stt: false }) }));
jest.mock("../../hooks/useSpeaker", () => ({
  useSpeaker: () => ({ speaking: false, feed: jest.fn(), stop: jest.fn() })
}));
jest.mock("../../hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({ supported: false, isRecording: false, isTranscribing: false, clearError: jest.fn() })
}));
// ChatBox chốt phiên bằng axios.post lúc rời màn hình. Khai cả __esModule để
// `import axios from "axios"` lấy đúng object này chứ không lấy phải {default:…}.
jest.mock("axios", () => ({
  __esModule: true,
  default: { post: () => Promise.resolve({ data: {} }) }
}));

global.mockRunTurn = runTurn;

function makeCamera(overrides = {}) {
  return {
    status: "off",
    stream: null,
    isOn: false,
    emotion: null,
    emotionReady: true,
    open: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
    skipEmotion: jest.fn(),
    unavailable: false,
    ...overrides
  };
}

// Dựng đúng cặp App vẫn dùng: hook giữ kịch bản, ChatBox vẽ nó ra.
// Bọc Router vì hết kịch bản là nút "Chơi với Larry" hiện ra, mà nút đó điều hướng.
//
// `peek` chìa ra state của hook cho bài kiểm tra. Cần nó vì khung chat chỉ VẼ
// lượt cuối cùng — có lỗi nhân đôi trong dữ liệu thì nhìn màn hình cũng không
// thấy, đúng nghĩa lỗi ẩn.
function Harness({ camera, peek }) {
  const intro = useIntroScript({ camera });
  if (peek) peek.current = intro;
  return (
    <MemoryRouter>
      <ChatBox intro={intro} checkin={intro.checkin} emotionReady={camera.emotionReady} />
    </MemoryRouter>
  );
}

// Chạm vào khung chat cho tới khi thấy thứ đang chờ — mỗi cái chạm bỏ qua phần
// còn lại của câu đang được giữ trên màn hình.
async function tapUntil(matcher, { limit = 60 } = {}) {
  for (let i = 0; i < limit; i += 1) {
    const found = screen.queryAllByText(matcher);
    if (found.length) return found[found.length - 1];
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      fireEvent.pointerDown(document.querySelector(".chat-messages"));
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
  }
  throw new Error(`Không thấy "${matcher}" sau ${limit} lần chạm`);
}

const click = async (element, wait = 400) =>
  act(async () => {
    fireEvent.click(element);
    await new Promise((resolve) => setTimeout(resolve, wait));
  });

beforeEach(() => runTurn.mockClear());

test("lời chào và phiếu cảm xúc là bong bóng trong chính khung chat", async () => {
  const camera = makeCamera();
  render(<Harness camera={camera} />);

  await tapUntil("Chào bạn! Mình là Larry 👋");

  // Bong bóng thật của khung chat, không phải một khung riêng nào khác
  expect(document.querySelector(".chat-messages .message-bubble")).toBeInTheDocument();

  await tapUntil("Bạn có muốn mình mở mắt khi nói chuyện không?");
  const yes = await tapUntil("👀 Được, bạn mở mắt đi");

  // Chưa hỏi xong phiếu thì Larry chưa được gọi model
  expect(runTurn).not.toHaveBeenCalled();

  await click(yes);

  // Lựa chọn của em cũng vào dòng hội thoại như một lượt nói
  await waitFor(() =>
    expect(document.querySelectorAll(".message-row--user").length).toBeGreaterThan(0)
  );

  // Ba câu cảm ơn trước, rồi mới thật sự xin quyền camera
  await tapUntil("Mình nhìn thấy bạn rồi này.");
  expect(camera.open).toHaveBeenCalledTimes(1);

  await click(await tapUntil("⏱️ Cảm xúc của bạn ngay lúc này"));
  await click(await tapUntil("🙁 Khó chịu"));

  await click(await tapUntil("Buồn"), 60);
  await click(screen.getByText("Xong rồi ✓"));

  await click(await tapUntil("Học tập"), 60);
  await click(screen.getByText("Xong rồi ✓"));

  // Câu tự kể mượn luôn ô nhắn tin của khung chat
  await tapUntil(/vì sao học tập lại làm bạn buồn/);
  const input = await waitFor(
    () => {
      const el = document.querySelector(".chat-input");
      if (!el) throw new Error("chưa mở ô nhắn tin");
      return el;
    },
    { timeout: 5000 }
  );

  await act(async () => {
    fireEvent.change(input, { target: { value: "Mình bị điểm kém." } });
  });
  await click(document.querySelector(".send-btn"));

  await tapUntil("Giờ mình trò chuyện thoải mái nhé — bạn muốn hỏi gì, kể gì cũng được.");

  // Hỏi xong phiếu thì Larry mới mở lời bằng model, và phiếu đi kèm ngay lượt đó.
  // Câu chốt còn được giữ lại một nhịp để đọc, nên chờ rộng tay hơn mặc định.
  await waitFor(() => expect(runTurn).toHaveBeenCalledTimes(1), { timeout: 5000 });
  expect(runTurn.mock.calls[0][0]).toMatchObject({
    text: "",
    checkin: {
      scope: "now",
      level: 1,
      emotions: ["Buồn"],
      reasons: ["Học tập"],
      detail: "Mình bị điểm kém."
    }
  });
});

test("từ chối camera thì vẫn đi tiếp tới phiếu cảm xúc", async () => {
  const camera = makeCamera();
  render(<Harness camera={camera} />);

  await click(await tapUntil("💬 Thôi, mình trò chuyện thôi"));

  expect(camera.open).not.toHaveBeenCalled();
  // Bước đọc cảm xúc phải được đánh dấu là XONG, nếu không khung chat chờ mãi
  expect(camera.skipEmotion).toHaveBeenCalledTimes(1);

  await tapUntil("Bạn không cần cho mình xem gì cả.");
  await tapUntil("Bạn muốn kể cho mình nghe về điều nào?");
});

test("ô nhắn tin đóng trong lúc Larry đang nói, chỉ mở ở câu tự kể", async () => {
  render(<Harness camera={makeCamera()} />);

  await tapUntil("Chào bạn! Mình là Larry 👋");
  expect(document.querySelector(".chat-input")).toBeNull();

  await click(await tapUntil("💬 Thôi, mình trò chuyện thôi"));
  await click(await tapUntil("⏱️ Cảm xúc của bạn ngay lúc này"));
  await click(await tapUntil("😐 Bình thường"));

  // Mức "bình thường" bỏ qua bộ từ cảm xúc, đi thẳng tới nguyên nhân
  await click(await tapUntil("Bạn bè"), 60);
  await click(screen.getByText("Xong rồi ✓"));

  await tapUntil(/vì sao bạn bè lại làm bạn/);
  await waitFor(() => expect(document.querySelector(".chat-input")).toBeInTheDocument(), {
    timeout: 5000
  });

  // Được phép không kể gì
  await click(screen.getByText("Mình chưa muốn kể"));
  await tapUntil("Cảm ơn bạn đã kể cho mình nghe 💛");
});

// index.js bọc cả app trong <React.StrictMode>. Chế độ này cố tình gọi HAI LẦN
// mọi hàm cập nhật state, để lộ ra những chỗ lén làm việc phụ bên trong chúng.
// Ghi nhận câu trả lời từ bên trong một hàm như vậy thì nó vào dòng hội thoại
// hai lượt.
//
// Bài này soi thẳng vào DỮ LIỆU chứ không nhìn màn hình: khung chat chỉ vẽ lượt
// cuối, nên hai bong bóng giống hệt nhau chồng lên nhau vẫn trông như một.
test("trong StrictMode, câu trả lời của em chỉ được ghi nhận MỘT lần", async () => {
  const peek = { current: null };

  render(
    <StrictMode>
      <Harness camera={makeCamera()} peek={peek} />
    </StrictMode>
  );

  await click(await tapUntil("💬 Thôi, mình trò chuyện thôi"));

  const answers = peek.current.turns.filter((turn) => turn.sender === "user");
  expect(answers.map((turn) => turn.text)).toEqual(["💬 Thôi, mình trò chuyện thôi"]);
});

test("đoạn mở đầu không chất đống: câu sau thế chỗ câu trước", async () => {
  render(<Harness camera={makeCamera()} />);

  await tapUntil("Chào bạn! Mình là Larry 👋");
  await tapUntil("Mình vui lắm vì có bạn ở đây.");

  // Câu chào đầu đã bị câu sau thế chỗ, không nằm lại trên màn hình
  expect(screen.queryByText("Chào bạn! Mình là Larry 👋")).toBeNull();

  // Và cả đoạn mở đầu chỉ chiếm đúng một bong bóng của Larry
  expect(document.querySelectorAll(".message-row:not(.message-row--user)")).toHaveLength(1);

  // Bong bóng đó là cùng một phần tử từ đầu tới giờ, chỉ đổi chữ bên trong
  expect(screen.getByText("Mình vui lắm vì có bạn ở đây.").closest(".message-row")).toBe(
    document.querySelector(".message-row:not(.message-row--user)")
  );
});

// .message-row chạy animation bounce-in từ opacity 0. Nếu bong bóng bị thay bằng
// một PHẦN TỬ KHÁC lúc gõ xong thì animation chạy lại và câu vừa nói nháy một
// cái. Cách duy nhất để không nháy: giữ nguyên đúng một phần tử.
test("câu Larry nói xong không bị thay phần tử — không có cú nháy nào", async () => {
  // Riêng bài này PHẢI bật hiệu ứng gõ chữ: cú nháy xảy ra đúng lúc bong bóng
  // "đang viết" nhường chỗ cho bong bóng đã viết xong. Cả file chạy ở chế độ
  // giảm chuyển động (gõ tức thì) nên không có khoảnh khắc đó để mà bắt.
  const reduced = window.matchMedia;
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });

  render(<Harness camera={makeCamera({ emotionReady: true })} />);

  // Bắt lấy bong bóng lúc chữ ĐANG chạy
  const bubbleWhileTyping = await waitFor(
    () => {
      const el = document.querySelector(".message-bubble--streaming");
      if (!el) throw new Error("chưa gõ");
      return el.closest(".message-row");
    },
    { timeout: 4000 }
  );

  // Rồi đợi tới lúc gõ xong hẳn
  await waitFor(
    () => expect(document.querySelector(".message-bubble--streaming")).toBeNull(),
    { timeout: 4000 }
  );

  // Vẫn phải là ĐÚNG cái phần tử lúc nãy, không phải một cái mới dựng lại
  expect(document.querySelector(".message-row:not(.message-row--user)")).toBe(bubbleWhileTyping);

  window.matchMedia = reduced;
});

test("câu trả lời gần nhất của em ở lại trong lúc Larry đáp lời", async () => {
  render(<Harness camera={makeCamera()} />);

  await click(await tapUntil("💬 Thôi, mình trò chuyện thôi"));
  await tapUntil("Bạn không cần cho mình xem gì cả.");

  // Lựa chọn vừa bấm vẫn thấy được — bấm xong mà nó biến mất luôn thì em không
  // biết mình đã chọn được chưa
  expect(screen.getByText("💬 Thôi, mình trò chuyện thôi")).toBeInTheDocument();
});

describe("nhịp tự chuyển câu", () => {
  const typeMs = 28;

  test("câu càng dài thì giữ càng lâu", () => {
    const short = "Ừ.";
    const long = "Và nhớ nhé — lúc nào bạn cũng có thể bảo mình nhắm mắt lại.";
    expect(readingTime(long, long.length * typeMs)).toBeGreaterThan(
      readingTime(short, short.length * typeMs)
    );
  });

  test("thời gian gõ chữ được trừ khỏi quỹ, không cộng dồn thêm", () => {
    const text = "Mình vui lắm vì có bạn ở đây.";
    expect(text.length * typeMs + readingTime(text, text.length * typeMs)).toBe(
      READ_BASE_MS + text.length * READ_PER_CHAR_MS
    );
  });

  test("câu ngắn tí xíu vẫn kịp đọc, câu dài lê thê vẫn có điểm dừng", () => {
    expect(readingTime("", 0)).toBeGreaterThanOrEqual(400);
    expect(readingTime("x".repeat(500), 0)).toBeLessThanOrEqual(2200);
  });
});
