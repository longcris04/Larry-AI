// Kịch bản mở đầu: Larry chào, xin phép camera, rồi hỏi hết phiếu cảm xúc.
//
// Đây là MỘT PHẦN CỦA CUỘC TRÒ CHUYỆN, không phải một màn hình riêng đứng chắn
// phía trước. Hook này không vẽ gì cả — nó nhả ra đúng thứ khung chat cần để
// dựng thành bong bóng như mọi lượt nói khác:
//
//   turns    những câu đã nói xong, cả của Larry lẫn lựa chọn em vừa bấm
//   typing   câu Larry đang gõ dở (khung chat vẽ nó thành bong bóng đang viết)
//   prompt   câu hỏi đang chờ trả lời: chọn một / chọn nhiều / tự viết
//   pose     tư thế nhân vật, để cột bên trái mở mắt đúng lúc
//
// Mạch chuyện chạy bằng MỘT HÀNG ĐỢI các bước bất đồng bộ (xem `enqueue`/`pump`).
// Mỗi bước là một hàm async: nói một câu rồi giữ lại đủ lâu để đọc, đổi tư thế,
// mở camera, hay dựng một câu hỏi rồi chờ em bấm. Nhánh rẽ (đồng ý / từ chối
// camera, mức độ cảm xúc nào) chỉ là chuyện đẩy thêm bước vào hàng đợi giữa chừng.
//
// Vì sao không dùng state machine phẳng: kịch bản này đọc từ trên xuống giống
// một trang kịch bản thật, ai sửa lời thoại cũng thấy ngay thứ tự trước sau.

import { useCallback, useEffect, useRef, useState } from "react";
import { describeFeeling, getLevel, joinVi } from "../constants/checkin";
import {
  CAMERA_FAILED,
  CAMERA_OFF_LINES,
  CAMERA_ON_LINES,
  CAMERA_SAW_YOU,
  CHECKIN_DONE,
  CHECKIN_OPENING,
  CONSENT_CHOICES,
  CONSENT_NOTE,
  CONSENT_QUESTION,
  EMOTION_QUESTION,
  EMOTION_REPLIES,
  GREETING,
  HINTS,
  LEVEL_CHOICES,
  LEVEL_REPLIES,
  REASON_CHOICES,
  SCOPE_CHOICES,
  SCOPE_QUESTION,
  UI_TEXT,
  detailQuestion,
  emotionChoices,
  levelQuestion,
  reasonQuestion,
  summariseCheckin
} from "../constants/introScript";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Larry tự nói tiếp, không bắt em chạm từng câu. Câu dài vẫn đứng lâu hơn câu
// ngắn — đây là quỹ thời gian TỔNG một câu được ở trên màn hình, tính cả lúc chữ
// đang chạy:
//
//   READ_BASE_MS      chỗ trống để mắt kịp bắt được là có câu mới
//   READ_PER_CHAR_MS  thêm bấy nhiêu cho mỗi ký tự
//
// Thời gian gõ chữ ĐƯỢC TRỪ ra khỏi quỹ đó: chữ chạy tới đâu em đọc tới đó, cộng
// thêm lần nữa thành ra câu nào cũng lê thê.
export const READ_BASE_MS = 350;
export const READ_PER_CHAR_MS = 42;
const READ_MIN_MS = 400;
const READ_MAX_MS = 2200;

export function readingTime(text, typingMs) {
  const budget = READ_BASE_MS + text.length * READ_PER_CHAR_MS - typingMs;
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, budget));
}

let turnSeq = 0;
const nextTurnId = () => `i${++turnSeq}`;

export function useIntroScript({ camera }) {
  const [turns, setTurns] = useState([]);
  const [typing, setTyping] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [hint, setHint] = useState("");
  const [pose, setPose] = useState({ arms: "cover", eyes: "shut", mood: "shy" });
  const [checkin, setCheckin] = useState(null);
  const [done, setDone] = useState(false);
  // "intro" = chưa trả lời chuyện camera, nên chưa có gì để bật/tắt
  const [phase, setPhase] = useState("intro");

  const reduced = useRef(
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;
  const typeMs = reduced ? 0 : 28;

  // Các bước trong hàng đợi được dựng MỘT LẦN lúc mở màn hình, nhưng lúc chạy thì
  // cần dữ liệu mới nhất — nên mọi thứ thay đổi theo thời gian đều đi qua ref.
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  });

  const draftRef = useRef({ scope: null, level: 2, emotions: [], reasons: [], detail: "" });
  const queueRef = useRef([]);
  const startedRef = useRef(false);
  const pumpingRef = useRef(false);
  const typingRef = useRef(null);
  const tapResolveRef = useRef(null);
  const promptRef = useRef(null);
  const holdTimerRef = useRef(null);
  // Đếm số câu Larry đã nói, để chỉ mách nước "chạm cho nhanh" ở mấy câu đầu
  const spokenRef = useRef(0);
  const aliveRef = useRef(true);
  const moodTimerRef = useRef(null);

  // --- Tư thế ---------------------------------------------------------------

  // Camera đang bật thì khuôn mặt PHẢI nhìn thấy được: không bao giờ để tay che
  // mắt trong khi đèn camera đang sáng — em sẽ tưởng Larry đang lén nhìn.
  const applyPose = useCallback((next = {}) => {
    setPose((prev) => {
      const merged = { ...prev, ...next };
      if (cameraRef.current?.isOn) {
        if (merged.eyes === "shut") merged.eyes = "open";
        if (merged.arms === "cover") merged.arms = "back";
      }
      if ((merged.eyes === "open" || merged.eyes === "happy") && merged.arms === "cover") {
        merged.arms = "back";
      }
      return merged;
    });

    // "hop" là một cú nhảy, không phải một trạng thái — tự gỡ ra để lần sau nhảy
    // được tiếp.
    if (next.mood === "hop") {
      clearTimeout(moodTimerRef.current);
      moodTimerRef.current = setTimeout(() => {
        if (aliveRef.current) setPose((prev) => (prev.mood === "hop" ? { ...prev, mood: "" } : prev));
      }, 800);
    }
  }, []);

  // Em bật/tắt camera giữa chừng bằng nút mắt: chỉnh lại nét mặt cho khớp
  useEffect(() => {
    applyPose(camera.isOn ? { arms: "back", eyes: "open" } : {});
  }, [camera.isOn, applyPose]);

  // --- Nói ------------------------------------------------------------------

  // Chữ chạy ra trong một bong bóng đang viết dở, gõ xong thì bong bóng đó chốt
  // lại thành một lượt trong cuộc trò chuyện — y hệt cách một lượt trả lời thật
  // của Larry hiện ra.
  const showLine = useCallback(
    (text) =>
      new Promise((resolve) => {
        const settle = () => {
          setTyping(null);
          setTurns((prev) => [...prev, { id: nextTurnId(), sender: "ai", text }]);
          typingRef.current = null;
          resolve();
        };

        if (!typeMs) {
          settle();
          return;
        }

        setTyping({ text: "" });

        let i = 0;
        const done = () => {
          clearInterval(id);
          settle();
        };
        const id = setInterval(() => {
          if (!aliveRef.current) {
            clearInterval(id);
            return;
          }
          i += 1;
          setTyping({ text: text.slice(0, i) });
          if (i >= text.length) done();
        }, typeMs);

        // Chạm giữa lúc chữ đang chạy = hiện luôn cả câu, đừng bắt em ngồi đợi
        typingRef.current = { skip: done };
      }),
    [typeMs]
  );

  // Giữ câu vừa nói lại đủ lâu để đọc, rồi tự đi tiếp. Chạm vào khung chat là bỏ
  // qua phần chờ còn lại — em đọc nhanh thì không phải ngồi đợi Larry.
  const holdLine = useCallback(
    (text) =>
      new Promise((resolve) => {
        const ms = readingTime(text, text.length * typeMs);

        // Mách nước ở hai câu đầu rồi thôi. Câu nào cũng treo một dòng gợi ý y hệt
        // thì em quen mắt và không đọc nữa.
        spokenRef.current += 1;
        setHint(spokenRef.current <= 2 ? HINTS.faster : "");

        const finish = () => {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          tapResolveRef.current = null;
          setHint("");
          resolve();
        };

        holdTimerRef.current = setTimeout(finish, ms);
        tapResolveRef.current = finish;
      }),
    [typeMs]
  );

  // Chạm để đi nhanh hơn: đang gõ thì hiện luôn cả câu, đang giữ thì sang câu sau
  const skip = useCallback(() => {
    if (typingRef.current) {
      typingRef.current.skip();
      return;
    }
    const resolve = tapResolveRef.current;
    if (resolve) {
      tapResolveRef.current = null;
      resolve();
    }
  }, []);

  // --- Hỏi ------------------------------------------------------------------

  const ask = useCallback(
    (config) =>
      new Promise((resolve) => {
        const pending = { ...config, resolve };
        promptRef.current = pending;
        setHint(config.hint || "");
        setPrompt(pending);
      }),
    []
  );

  // Lựa chọn em vừa bấm cũng vào dòng hội thoại như một lượt nói của em.
  //
  // Câu hỏi đang chờ được giữ ở REF chứ không đọc ra từ state. Hàm cập nhật state
  // phải thuần tuý: React ở chế độ nghiêm ngặt cố tình gọi nó HAI LẦN để lộ ra
  // những chỗ lén làm việc phụ bên trong. Nhét setTurns với resolve vào đó thì
  // câu trả lời của em bị đẩy vào dòng hội thoại hai lượt, hiện lên màn hình hai
  // bong bóng giống hệt nhau.
  const answer = useCallback((echo, payload) => {
    const pending = promptRef.current;
    if (!pending) return;
    promptRef.current = null;

    setPrompt(null);
    setHint("");
    if (echo) setTurns((prev) => [...prev, { id: nextTurnId(), sender: "user", text: echo }]);
    pending.resolve(payload);
  }, []);

  // --- Hàng đợi -------------------------------------------------------------

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    while (queueRef.current.length && aliveRef.current) {
      const step = queueRef.current.shift();
      // eslint-disable-next-line no-await-in-loop -- các bước PHẢI chạy tuần tự
      await step();
    }
    pumpingRef.current = false;
  }, []);

  const enqueue = useCallback(
    (...steps) => {
      queueRef.current.push(...steps.flat(Infinity).filter(Boolean));
      pump();
    },
    [pump]
  );

  // aliveRef PHẢI được bật lại ở thân effect, không chỉ đặt lúc khai báo useRef.
  // React ở chế độ nghiêm ngặt dựng lên, dọn đi, rồi dựng lại: lần dọn đó tắt cờ,
  // và nếu không có dòng bật lại thì cả kịch bản đứng hình vĩnh viễn — vòng chạy
  // hàng đợi thoát ngay sau bước đầu tiên, Larry không nói câu nào.
  //
  // Gọi luôn pump(): hàng đợi vẫn còn nguyên sau lần dọn, chỉ vòng chạy là dừng.
  useEffect(() => {
    aliveRef.current = true;
    pump();

    return () => {
      aliveRef.current = false;
      clearTimeout(moodTimerRef.current);
      clearTimeout(holdTimerRef.current);
    };
  }, [pump]);

  // --- Kịch bản -------------------------------------------------------------

  useEffect(() => {
    // React ở chế độ nghiêm ngặt chạy effect hai lần — không chặn thì Larry chào
    // chồng lên nhau hai lượt.
    if (startedRef.current) return;
    startedRef.current = true;

    const say = (text) => async () => {
      await showLine(text);
      await holdLine(text);
    };
    const hold = (ms) => async () => {
      await sleep(reduced ? 100 : ms);
    };
    const setPoseStep = (next) => async () => {
      applyPose(next);
      await sleep(reduced ? 100 : 430);
    };
    const act = (fn) => async () => {
      await fn();
    };
    const choose = (config, handler) => async () => {
      const picked = await ask(config);
      await sleep(reduced ? 80 : 280);
      await handler(picked);
    };

    // ----- Lời chào và xin phép camera -----
    const intro = () => [
      setPoseStep({ arms: "cover", eyes: "shut", mood: "shy" }),
      hold(700),
      ...GREETING.map((text) => say(text)),
      hold(320),
      say(CONSENT_QUESTION),
      say(CONSENT_NOTE),
      choose({ kind: "single", options: CONSENT_CHOICES, hint: HINTS.choose }, (picked) => {
        setPhase(picked.value === "yes" ? "camera" : "no-camera");
        enqueue(picked.value === "yes" ? consentYes() : consentNo());
      })
    ];

    const consentYes = () => [
      hold(280),
      // Tay nhấc thẳng lên khỏi mặt trước, rồi mới vén hẳn ra sau: hai nhịp này
      // làm khoảnh khắc "mở mắt" đáng nhớ hơn một cú đổi hình.
      setPoseStep({ arms: "up", eyes: "shut" }),
      hold(360),
      act(() => applyPose({ arms: "back", eyes: "open", mood: "hop" })),
      hold(420),
      ...CAMERA_ON_LINES.map((text) => say(text)),
      act(async () => {
        const ok = await cameraRef.current.open();
        if (ok) {
          applyPose({ arms: "back", eyes: "happy", mood: "hop" });
          enqueue(
            ...CAMERA_SAW_YOU.map((text) => say(text)),
            setPoseStep({ arms: "down", eyes: "open" }),
            checkinFlow()
          );
        } else {
          setPhase("no-camera");
          applyPose({ arms: "cover", eyes: "shut" });
          enqueue(
            ...CAMERA_FAILED.map((text) => say(text)),
            setPoseStep({ arms: "down", eyes: "shut" }),
            checkinFlow()
          );
        }
      })
    ];

    const consentNo = () => [
      act(() => cameraRef.current.skipEmotion()),
      hold(400),
      setPoseStep({ arms: "cover", eyes: "shut" }),
      hold(340),
      setPoseStep({ arms: "down", eyes: "shut" }),
      ...CAMERA_OFF_LINES.map((text) => say(text)),
      checkinFlow()
    ];

    // ----- Phiếu cảm xúc, hỏi từng câu một -----
    const checkinFlow = () => [
      setPoseStep({ mood: "tilt" }),
      ...CHECKIN_OPENING.map((text) => say(text)),
      say(SCOPE_QUESTION),
      choose({ kind: "single", options: SCOPE_CHOICES, hint: HINTS.choose }, (picked) => {
        draftRef.current.scope = picked.value;
        enqueue(levelStep());
      })
    ];

    const levelStep = () => [
      say(levelQuestion(draftRef.current.scope)),
      choose({ kind: "single", options: LEVEL_CHOICES, hint: HINTS.choose }, (picked) => {
        draftRef.current.level = picked.value;
        const { tone } = getLevel(picked.value);
        enqueue(
          setPoseStep({ arms: "down", mood: tone === "pleasant" ? "hop" : "tilt" }),
          ...LEVEL_REPLIES[tone].map((text) => say(text)),
          // Ngày bình thường thì bỏ qua bộ từ cảm xúc, đúng như phiếu cũ: không
          // có từ nào tả "bình thường" mà không bắt em phải nghĩ ra một cảm xúc.
          tone === "neutral" ? reasonStep() : emotionStep(tone)
        );
      })
    ];

    const emotionStep = (tone) => [
      say(EMOTION_QUESTION),
      choose(
        {
          kind: "multi",
          options: emotionChoices(tone),
          hint: HINTS.pick,
          customPlaceholder: UI_TEXT.customEmotion
        },
        (picked) => {
          draftRef.current.emotions = picked.values;
          enqueue(...EMOTION_REPLIES.map((text) => say(text)), reasonStep());
        }
      )
    ];

    const reasonStep = () => [
      say(reasonQuestion(describeFeeling(draftRef.current))),
      choose(
        {
          kind: "multi",
          options: REASON_CHOICES,
          hint: HINTS.pick,
          customPlaceholder: UI_TEXT.customReason
        },
        (picked) => {
          draftRef.current.reasons = picked.values;
          enqueue(detailStep());
        }
      )
    ];

    const detailStep = () => [
      setPoseStep({ arms: "down", mood: "tilt" }),
      say(
        detailQuestion(
          joinVi(draftRef.current.reasons).toLowerCase(),
          describeFeeling(draftRef.current)
        )
      ),
      // Câu cuối để em tự kể: dùng luôn ô nhắn tin của khung chat, không dựng
      // thêm ô nhập nào khác.
      choose({ kind: "text", hint: HINTS.write }, (picked) => {
        draftRef.current.detail = picked.text;
        enqueue(finishStep());
      })
    ];

    const finishStep = () => [
      setPoseStep({
        arms: "up",
        eyes: cameraRef.current.isOn ? "open" : "happy",
        mood: "hop"
      }),
      say(summariseCheckin(draftRef.current)),
      ...CHECKIN_DONE.map((text) => say(text)),
      act(() => {
        const draft = draftRef.current;
        setCheckin({
          scope: draft.scope,
          level: draft.level,
          emotions: draft.emotions,
          reasons: draft.reasons,
          detail: draft.detail
        });
        setDone(true);
      })
    ];

    enqueue(intro());
  }, [applyPose, ask, enqueue, holdLine, reduced, showLine]);

  return { turns, typing, prompt, hint, pose, checkin, done, phase, answer, skip };
}
