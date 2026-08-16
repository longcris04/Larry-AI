import { act, renderHook, waitFor } from "@testing-library/react";
import { useSpeaker } from "./useSpeaker";

const REPLY =
  "Larry nghe bạn kể rồi đây. Chuyện bạn gặp hôm nay nghe có vẻ buồn thật đấy, " +
  "và mình rất vui vì bạn đã chịu nói ra thay vì giữ một mình. " +
  "Bạn có muốn kể cho mình nghe kỹ hơn một chút không? Mình sẽ ngồi đây nghe hết, không vội gì đâu nhé.";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let played;
let requested;
let inFlight;
let peakInFlight;
let revoked;
let failFor;

class FakeAudio {
  constructor(url) {
    this.src = url;
    this.onended = null;
    this.onerror = null;
  }
  play() {
    played.push(this.src);
    setTimeout(() => this.onended?.(), 5);
    return Promise.resolve();
  }
  pause() {}
}

beforeEach(() => {
  played = [];
  requested = [];
  inFlight = 0;
  peakInFlight = 0;
  revoked = [];
  failFor = null;

  global.Audio = FakeAudio;
  global.URL.createObjectURL = (blob) => `blob:${blob.__text}`;
  global.URL.revokeObjectURL = (url) => revoked.push(url);

  global.fetch = jest.fn(async (url, options) => {
    const { text } = JSON.parse(options.body);
    requested.push(text);

    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    // Sinh tiếng phải LÂU HƠN tốc độ chữ chảy về, đúng như thực tế (2–3 giây một
    // đoạn, trong khi Larry viết xong cả câu trả lời trong vài giây). Để nhanh
    // ngang nhau thì đoạn trước luôn xong trước khi đoạn sau kịp vào hàng đợi, và
    // bài test sẽ không bao giờ chạm tới nhánh tải song song.
    await delay(60);
    inFlight -= 1;

    if (failFor && text.includes(failFor)) {
      return { ok: false, status: 502, json: async () => ({ error: "hỏng" }) };
    }
    return { ok: true, blob: async () => ({ __text: text }) };
  });
});

// Chờ tới lúc đọc xong hẳn.
//
// KHÔNG chờ mỗi `speaking === false`: lúc chưa bắt đầu nó cũng đang là false, nên
// điều kiện đó khớp ngay lập tức và bài test sẽ nghiệm thu một hàng đợi còn chưa
// chạy. Phải có thêm "đã phát được gì đó" và "không còn request nào đang bay".
async function waitUntilDone(result) {
  await waitFor(
    () => {
      expect(played.length).toBeGreaterThan(0);
      expect(inFlight).toBe(0);
      expect(result.current.speaking).toBe(false);
    },
    { timeout: 5000 }
  );
}

// Mô phỏng chữ chảy về từng token rồi chốt tin nhắn, đúng như ChatBox gọi
async function streamReply(result, text, { flush = true } = {}) {
  for (let i = 8; i <= text.length; i += 8) {
    await act(async () => {
      result.current.feed(text.slice(0, i));
      await delay(1);
    });
  }
  if (flush) {
    await act(async () => {
      result.current.feed(text, { flush: true });
      await delay(1);
    });
  }
}

test("đọc hết tin nhắn, đúng thứ tự, mỗi đoạn đúng một lần", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY);
  await waitUntilDone(result);

  // Ghép các đoạn đã PHÁT lại phải đúng bằng câu trả lời gốc
  const spoken = played.map((url) => url.replace("blob:", "")).join(" ");
  expect(spoken.replace(/\s+/g, " ").trim()).toBe(REPLY.replace(/\s+/g, " ").trim());

  // Không đoạn nào bị gọi API hai lần
  expect(new Set(requested).size).toBe(requested.length);

  // Cắt thành nhiều đoạn thật, không phải gộp một cục
  expect(played.length).toBeGreaterThan(1);
});

test("phát tuần tự — không đoạn nào chồng lên đoạn nào", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  const startedAt = [];
  const originalPlay = FakeAudio.prototype.play;
  FakeAudio.prototype.play = function play() {
    startedAt.push(Date.now());
    return originalPlay.call(this);
  };

  await streamReply(result, REPLY);
  await waitUntilDone(result);

  FakeAudio.prototype.play = originalPlay;

  // Số lần bắt đầu phát = số đoạn, và chúng nối tiếp nhau chứ không cùng lúc
  expect(startedAt.length).toBe(played.length);
  for (let i = 1; i < startedAt.length; i += 1) {
    expect(startedAt[i]).toBeGreaterThanOrEqual(startedAt[i - 1]);
  }
});

test("sinh trước tối đa 3 đoạn cùng lúc", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY);
  await waitUntilDone(result);

  expect(peakInFlight).toBeGreaterThan(1); // có tải trước thật
  expect(peakInFlight).toBeLessThanOrEqual(3); // nhưng không tải ồ ạt
});

test("một đoạn hỏng thì bỏ qua, các đoạn sau vẫn đọc", async () => {
  failFor = "Chuyện bạn gặp hôm nay";
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY);
  await waitUntilDone(result);

  const spoken = played.map((url) => url.replace("blob:", "")).join(" ");
  expect(spoken).not.toContain("Chuyện bạn gặp hôm nay");
  expect(spoken).toContain("Larry nghe bạn kể rồi đây");
  expect(spoken).toContain("không vội gì đâu nhé");
});

test("stop() cắt tiếng và thu hồi hết URL tạm", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY, { flush: false });
  await act(async () => {
    result.current.stop();
    await delay(30);
  });

  expect(result.current.speaking).toBe(false);
  const playedCount = played.length;

  // Sau khi dừng thì không có đoạn nào được phát thêm
  await act(async () => {
    await delay(50);
  });
  expect(played.length).toBe(playedCount);
});

test("tắt tiếng thì không gọi API lần nào", async () => {
  localStorage.setItem("larry.voice.muted", "true");
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY);
  await act(async () => {
    await delay(30);
  });

  expect(global.fetch).not.toHaveBeenCalled();
  expect(played).toHaveLength(0);
  localStorage.removeItem("larry.voice.muted");
});

// `speaking` là thứ duy nhất quyết định dải báo "Larry đang nói" hiện hay ẩn
// (SpeakingIndicator trong ChatBox), nên hai bài dưới đây kiểm đúng cái đó.

test("cờ speaking bật lúc phát và tắt hẳn khi đọc xong", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  // Chưa đọc gì thì không có dải báo nào
  expect(result.current.speaking).toBe(false);

  await streamReply(result, REPLY, { flush: false });
  await waitFor(() => expect(result.current.speaking).toBe(true), { timeout: 5000 });

  await act(async () => {
    result.current.feed(REPLY, { flush: true });
    await delay(1);
  });
  await waitUntilDone(result);

  expect(result.current.speaking).toBe(false);
});

test("không nhấp nháy khi hàng đợi cạn giữa lúc chữ còn chảy về", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  const states = [];
  for (let i = 8; i <= REPLY.length; i += 8) {
    await act(async () => {
      result.current.feed(REPLY.slice(0, i));
      // Lâu hơn thời gian phát một đoạn (5ms) để hàng đợi kịp cạn giữa chừng —
      // đây chính là lúc dải báo sẽ tắt/bật loạn nếu thiếu cờ "đã viết xong".
      await delay(20);
    });
    states.push(result.current.speaking);
  }

  let turnedOffAgain = 0;
  let seenOn = false;
  for (const speaking of states) {
    if (speaking) seenOn = true;
    else if (seenOn) turnedOffAgain += 1;
  }

  expect(seenOn).toBe(true);
  expect(turnedOffAgain).toBe(0);
});

test("tin nhắn mới cắt ngang tin đang đọc", async () => {
  const { result } = renderHook(() => useSpeaker({ enabled: true }));

  await streamReply(result, REPLY, { flush: false });
  await act(async () => {
    result.current.feed("Câu trả lời hoàn toàn khác.", { flush: true });
    await delay(60);
  });

  const spoken = played.map((url) => url.replace("blob:", "")).join(" ");
  expect(spoken).toContain("Câu trả lời hoàn toàn khác.");
});
