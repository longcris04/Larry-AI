// Luật định tuyến: chuẩn hoá nhóm, áp sàn an toàn, chọn agent cho lượt này.
//
// Tách riêng khỏi supervisor.js vì đây là phần KHÔNG được để LLM quyết định.
// Model đề xuất nhóm; các luật dưới đây mới là thứ chốt lại agent nào chạy.

const { GROUPS, GROUP_LIST, agentIdsForGroups } = require("./registry");

// Số lượt supervisor được phép hỏi khai thác trong một phiên.
// Dùng ?? ở đây là sai: Number("") và Number(undefined) ra NaN chứ không phải
// null/undefined, nên ?? không đỡ được và trần trở thành NaN (mọi so sánh đều false).
const MAX_PROBE_TURNS = Math.max(1, Number(process.env.MAX_PROBE_TURNS) || 5);

// SÀN AN TOÀN — các nhóm một khi đã bật thì KHÔNG tự tắt.
//
// Vì sao: học sinh nói "hôm nay em vui rồi" hoàn toàn không chứng minh rằng hành
// vi tự hại đã dừng. Đây chính là kiểu ca mà bỏ sót thì hậu quả không sửa được.
// Đối xứng với applyRiskFloor() ở tầng gắn cờ cho giáo viên trong server.js.
const STICKY_GROUPS = [GROUPS.SELF_HARM];

// Số lượt LIÊN TIẾP model phải không còn thấy dấu hiệu của một nhóm thì nhóm đó
// mới được gỡ.
//
// Vì sao không gỡ ngay: model đánh giá lại từ đầu ở mỗi lượt, nên một lượt em
// nói sang chuyện khác ("trưa nay em ăn cơm gà") là đủ để nhóm "victim" biến mất
// khỏi đề xuất — dù chuyện bị bắt nạt chẳng thay đổi gì. Gỡ ngay thì agent bị
// đổi qua đổi lại theo nhiễu của model. Đây là bộ chống rung, không phải sàn an
// toàn: đủ số lượt xác nhận thì nhóm vẫn được gỡ bình thường.
const DROP_AFTER_TURNS = Math.max(1, Number(process.env.GROUP_DROP_AFTER_TURNS) || 2);

// Bỏ mã lạ do model bịa ra, khử trùng lặp, áp luật "general loại trừ"
function normalizeGroups(groups = []) {
  let list = [...new Set(groups)].filter((g) => GROUP_LIST.includes(g));

  // "general" chỉ tồn tại khi KHÔNG có nhóm chuyên biệt nào
  const specific = list.filter((g) => g !== GROUPS.GENERAL);
  if (specific.length > 0) list = specific;

  // Model không chọn được nhóm nào hợp lệ → trò chuyện thường ngày
  if (list.length === 0) list = [GROUPS.GENERAL];

  return list;
}

/**
 * Chốt danh sách nhóm cho lượt này từ đề xuất của model + nhóm đang giữ.
 *
 * Nhóm MỚI xuất hiện thì áp dụng NGAY (em vừa lộ ý định tự sát thì không có
 * chuyện đợi xác nhận). Nhóm biến mất thì phải chờ đủ DROP_AFTER_TURNS lượt liên
 * tiếp, trừ nhóm thuộc sàn an toàn — nhóm đó không bao giờ tự gỡ.
 *
 * @param {string[]} previousGroups  nhóm đang hoạt động trước lượt này
 * @param {string[]} proposedGroups  nhóm model vừa đề xuất
 * @param {object}   missStreak      { [group]: số lượt liên tiếp đã vắng mặt }
 * @returns {{groups, kept, pending, missStreak}}
 *          kept    = giữ nhờ sàn an toàn
 *          pending = giữ tạm vì chưa đủ lượt xác nhận việc gỡ
 */
function resolveGroups(previousGroups = [], proposedGroups = [], missStreak = {}) {
  const proposed = normalizeGroups(proposedGroups);

  const kept = [];
  const pending = [];
  const nextStreak = {};

  for (const group of previousGroups) {
    // Model vẫn thấy nhóm này → chuỗi vắng mặt reset về 0 (không ghi vào streak)
    if (proposed.includes(group)) continue;

    if (STICKY_GROUPS.includes(group)) {
      kept.push(group);
      continue;
    }

    const misses = (missStreak[group] || 0) + 1;
    if (misses < DROP_AFTER_TURNS) {
      pending.push(group);
      nextStreak[group] = misses;
    }
    // Đủ số lượt vắng mặt → nhóm rơi ra khỏi cả groups lẫn streak
  }

  const groups = normalizeGroups([...proposed, ...kept, ...pending]);

  // Chỉ báo cáo những nhóm THỰC SỰ còn lại. "general" hay bị giữ tạm rồi bị luật
  // loại trừ gạt đi ngay sau đó — báo nó ra chỉ làm log và trace khó đọc.
  return {
    groups,
    kept: kept.filter((g) => groups.includes(g)),
    pending: pending.filter((g) => groups.includes(g)),
    missStreak: nextStreak
  };
}

// So sánh hai danh sách nhóm. Dùng cho cả hai việc: quyết định có phân luồng lại
// không (so với nhóm đang chạy) và có thông báo lại không (so với nhóm đã báo).
function diffGroups(announced = [], current = []) {
  const added = current.filter((g) => !announced.includes(g));
  const removed = announced.filter((g) => !current.includes(g));
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

/**
 * CÓ PHÂN LUỒNG LẠI KHÔNG?
 *
 * Supervisor đánh giá lại ở MỌI lượt — đó là lớp phát hiện nguy hiểm, không được
 * bỏ. Nhưng việc ĐỔI AGENT thì chỉ xảy ra khi tình trạng của em thực sự đổi:
 *
 *   - lần đầu tiên trong phiên, chưa có agent nào đang phụ trách
 *   - xuất hiện nhóm MỚI: đang là nạn nhân nay có thêm hành vi bắt nạt lại,
 *     hoặc lộ ra ý định tự sát
 *   - một nhóm đã được xác nhận là hết (đã qua bộ chống rung ở resolveGroups)
 *   - xuất hiện tín hiệu nguy hiểm MỚI, kể cả khi nhóm không đổi — em vẫn nằm
 *     trong "general" nhưng vừa kể chuyện bị dụ dỗ chẳng hạn
 *
 * Ngoài các trường hợp đó, em vẫn nói tiếp về đúng chuyện cũ → giữ nguyên agent
 * đang đồng hành. Đổi agent giữa chừng làm em phải kể lại từ đầu với một "người"
 * khác, đó là thứ tệ nhất có thể làm với một cuộc trò chuyện tư vấn.
 *
 * @returns {{reroute: boolean, reason: string, added: string[], removed: string[]}}
 */
function shouldReroute({
  previousGroups = [],
  groups = [],
  currentAgents = [],
  newDangers = []
} = {}) {
  const { added, removed } = diffGroups(previousGroups, groups);

  let reason = "";
  if (currentAgents.length === 0) reason = "first";
  else if (added.length) reason = "added";
  else if (removed.length) reason = "removed";
  else if (newDangers.length) reason = "danger";

  return { reroute: reason !== "", reason, added, removed };
}

/**
 * CHỌN ĐÚNG MỘT AGENT cho lượt này.
 *
 * Một lượt chỉ có MỘT agent trả lời — không bao giờ hai. Vì sao:
 *   - Học sinh 6-15 tuổi nhận hai đoạn văn liền nhau trong một lượt là quá nhiều,
 *     và em không biết mình đang nói chuyện với ai.
 *   - Hai agent cùng nói rất dễ giẫm lên nhau: lặp lời khuyên, lặp tổng đài 111,
 *     hoặc hỏi hai câu một lúc khiến em không biết trả lời câu nào.
 *
 * Nhiều nhóm cùng bật thì nhóm ƯU TIÊN CAO NHẤT thắng — thứ tự trong registry:
 * self_harm → victim → actor → general. Em vừa bị bắt nạt vừa lộ ý định tự sát
 * thì agent tự hại trả lời; an toàn tính mạng không bao giờ nhường lượt.
 * Nhóm còn lại KHÔNG mất đi: nó vẫn nằm trong activeGroups, vẫn được thông báo
 * cho em, vẫn nâng sàn rủi ro cho giáo viên, và nếu về sau nó thành chuyện chính
 * (nhóm ưu tiên cao hơn được gỡ) thì agent của nó sẽ tiếp quản.
 */
function pickAgent(groups = []) {
  // normalizeGroups đảm bảo luôn còn ít nhất "general" → luôn có agent để gọi
  return agentIdsForGroups(normalizeGroups(groups))[0];
}

module.exports = {
  MAX_PROBE_TURNS,
  STICKY_GROUPS,
  DROP_AFTER_TURNS,
  normalizeGroups,
  resolveGroups,
  diffGroups,
  shouldReroute,
  pickAgent
};
