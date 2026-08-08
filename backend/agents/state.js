// State của graph — thứ được checkpointer lưu lại giữa các lượt.
//
// Vì sao phải có state riêng thay vì để frontend gửi lại history mỗi lượt như
// bản cũ: hệ multi-agent còn phải nhớ những thứ không nằm trong hội thoại —
// đã phân nhóm ra sao, đã thông báo cho học sinh chưa, đã hỏi khai thác mấy
// lượt rồi. Không có chỗ nhớ thì mỗi lượt supervisor lại thông báo lại từ đầu.

const { Annotation } = require("@langchain/langgraph");

// Nối thêm vào cuối
const append = (current = [], incoming = []) =>
  current.concat(Array.isArray(incoming) ? incoming : [incoming]);

// Vết chạy chỉ phục vụ hiển thị: giao diện đọc phần DELTA nhận được lúc stream,
// nên state không cần giữ lại toàn bộ lịch sử. Cắt bớt để phiên dài không phình.
const appendCapped = (current = [], incoming = []) => append(current, incoming).slice(-60);

// Ghi đè hoàn toàn; node không trả field thì giữ nguyên giá trị cũ
const replace = (current, incoming) => (incoming === undefined ? current : incoming);

const LarryState = Annotation.Root({
  // --- Bối cảnh của phiên (đặt một lần lúc bắt đầu, cập nhật khi có cái mới) ---

  sessionId: Annotation({ reducer: replace, default: () => "" }),

  // { username, fullName, grade, school, className } — lấy từ JWT + account.json
  student: Annotation({ reducer: replace, default: () => ({}) }),

  // Phiếu cảm xúc ĐÃ qua sanitizeCheckin(), hoặc null nếu học sinh bỏ qua
  checkin: Annotation({ reducer: replace, default: () => null }),

  // Cảm xúc camera nhận diện: "happy" | "sad" | ... (nguồn kém tin cậy nhất)
  cameraEmotion: Annotation({ reducer: replace, default: () => "" }),

  // --- Hội thoại --------------------------------------------------------------
  // { role: "user" | "assistant", content: string, agent: string | null }
  // Field `agent` là thứ để giao diện biết bong bóng này của agent nào.
  messages: Annotation({ reducer: append, default: () => [] }),

  // --- Kết quả đánh giá của supervisor ----------------------------------------
  // Xem AssessmentSchema trong supervisor.js
  assessment: Annotation({ reducer: replace, default: () => null }),

  // Nhóm đang hoạt động SAU KHI đã áp sàn an toàn + bộ chống rung (routing.js)
  activeGroups: Annotation({ reducer: replace, default: () => [] }),

  // Agent ĐANG phụ trách em, sống xuyên nhiều lượt. Chỉ có MỘT agent (giữ dạng
  // mảng cho khớp với `queue`). Khác `queue` ở chỗ: queue rỗng đi khi agent chạy
  // xong, còn đây là thứ được nạp lại vào queue ở lượt sau nếu tình trạng không đổi.
  activeAgents: Annotation({ reducer: replace, default: () => [] }),

  // Số lượt LIÊN TIẾP model không còn đề xuất một nhóm: { [group]: số lượt }.
  // Đủ DROP_AFTER_TURNS lượt thì nhóm đó mới được gỡ — xem resolveGroups().
  groupMissStreak: Annotation({ reducer: replace, default: () => ({}) }),

  // Các nhóm đã thông báo cho học sinh rồi — để không lặp lại thông báo mỗi lượt.
  // Do AGENT ghi (không phải supervisor): supervisor chỉ quyết định, agent mới là
  // nơi thật sự nói câu đó với em. Gọi model lỗi giữa chừng thì lượt sau vẫn thông
  // báo lại, thay vì im lặng vì hệ thống tưởng đã nói rồi.
  announcedGroups: Annotation({ reducer: replace, default: () => [] }),

  // Các tín hiệu nguy hiểm đã thông báo. Tách khỏi announcedGroups vì tín hiệu
  // nguy hiểm nằm rải trong cả 4 nhóm: em bị dụ dỗ vẫn có thể thuộc "general",
  // nhóm không đổi nhưng vẫn phải thông báo.
  announcedDangers: Annotation({ reducer: replace, default: () => [] }),

  // Số lượt supervisor đã hỏi khai thác thêm. Có trần để không thành hỏi cung.
  probeCount: Annotation({ reducer: replace, default: () => 0 }),

  // --- Điều phối trong MỘT lượt ------------------------------------------------

  // Việc BÀN GIAO của supervisor cho agent sắp nói:
  //   { groups, added, removed, dangerSignals } — hoặc null nếu không có gì mới.
  //
  // Supervisor KHÔNG tự nói câu thông báo nữa (§6.3). Nó xác định tình trạng rồi
  // giao lại đây, và chính agent chuyên trách mở lời bằng phần này — học sinh chỉ
  // nghe MỘT giọng trong một lượt. Agent xoá field này khi đã nói xong.
  pendingAnnouncement: Annotation({ reducer: replace, default: () => null }),

  // Agent còn phải chạy trong lượt này, ví dụ ["agent_self_harm"].
  // LUÔN có TỐI ĐA MỘT phần tử — một lượt chỉ một agent được nói (xem pickAgent
  // trong routing.js); rỗng khi supervisor chỉ hỏi khai thác. Giữ dạng mảng vì
  // đây là thứ hàm định tuyến của graph đọc, và agent tự bỏ mình ra khi xong.
  queue: Annotation({ reducer: replace, default: () => [] }),

  // --- Vết chạy để giao diện hiển thị -----------------------------------------
  trace: Annotation({ reducer: appendCapped, default: () => [] })
});

module.exports = { LarryState };
