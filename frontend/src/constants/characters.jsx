// Bộ sưu tập nhân vật — những gương mặt học sinh có thể chọn cho Larry.
//
// Quan trọng: đây CHỈ là gương mặt. Người trò chuyện vẫn luôn là Larry (prompt ở
// backend dặn model tự giới thiệu "Mình là Larry"), nên giao diện không bao giờ
// được gọi trợ lý bằng tên nhân vật — xem ASSISTANT_NAME trong introScript.js.
//
// Mọi nhân vật dùng CHUNG một bộ khung (xem CharacterAvatar): thân tròn ở giữa
// khung 300×300, mắt ở y≈174, và HAI CÁNH TAY xoay quanh hai điểm cố định
// (110,118) và (190,118). Nhờ vậy chỉ cần MỘT bộ CSS tư thế cho tất cả:
//
//   cover → tay che mắt (lúc chưa xin phép camera)
//   back  → tay vén ra sau, để lộ hẳn khuôn mặt (lúc mở mắt)
//   down  → tay buông xuôi hai bên (lúc trò chuyện bình thường)
//   up    → tay giơ cao (lúc vui)
//   wave  → tay vẫy (lúc chào tạm biệt)
//
// Muốn thêm nhân vật mới thì chỉ cần thêm một mục vào đây: giữ nguyên hình dáng
// tay (một trong bốn bộ dưới đây) và đổi màu + chi tiết riêng. KHÔNG cần đụng
// vào CharacterAvatar hay CSS.

// --- Hình dáng tay ----------------------------------------------------------
// Cả bốn bộ có cùng "bao ngoài": bắt đầu ở điểm xoay, kéo dài qua khỏi khuôn mặt.
// Khác nhau ở độ dày và phần đầu mút, đủ để đọc ra là tai thỏ / chân mèo / vây
// cánh cụt / bàn tay máy.

const EAR = {
  l: "M97,112 C87,144 85,178 91,202 C97,221 123,221 129,202 C135,178 133,144 123,112 C116,103 104,103 97,112 Z",
  r: "M177,112 C167,144 165,178 171,202 C177,221 203,221 209,202 C215,178 213,144 203,112 C196,103 184,103 177,112 Z"
};

const PAW = {
  l: "M99,113 C91,142 87,171 89,192 C91,215 129,215 131,192 C133,171 129,142 121,113 C116,103 104,103 99,113 Z",
  r: "M179,113 C171,142 167,171 169,192 C171,215 209,215 211,192 C213,171 209,142 201,113 C196,103 184,103 179,113 Z"
};

const FLIPPER = {
  l: "M103,113 C96,145 93,181 99,204 C103,219 119,219 123,204 C129,181 126,145 119,113 C115,104 107,104 103,113 Z",
  r: "M183,113 C176,145 173,181 179,204 C183,219 199,219 203,204 C209,181 206,145 199,113 C195,104 187,104 183,113 Z"
};

const MITTEN = {
  l: "M98,114 C90,143 87,173 90,193 C93,214 128,214 131,193 C134,173 130,143 122,114 C117,104 103,104 98,114 Z",
  r: "M178,114 C170,143 167,173 170,193 C173,214 208,214 211,193 C214,173 210,143 202,114 C197,104 183,104 178,114 Z"
};

// Chi tiết vẽ THÊM lên mỗi cánh tay. Toạ độ tính từ gốc tay (đã dịch sẵn), nên
// cùng một hình dùng được cho cả tay trái lẫn tay phải.
const PawPads = ({ fill }) => (
  <g fill={fill}>
    <ellipse cx="12" cy="94" rx="11" ry="8" />
    <circle cx="2" cy="80" r="4.4" />
    <circle cx="12" cy="76" r="4.4" />
    <circle cx="22" cy="80" r="4.4" />
  </g>
);

const Claws = ({ fill }) => (
  <g fill={fill}>
    <circle cx="4" cy="82" r="4" />
    <circle cx="13" cy="78" r="4" />
    <circle cx="22" cy="82" r="4" />
  </g>
);

export const CHARACTERS = [
  {
    id: "larry",
    name: "Larry",
    emoji: "🤖",
    species: "Người máy nhỏ",
    tagline: "Gương mặt gốc của Larry",
    // Mặt kính tối màu + mắt phát sáng, giống hệt hình Larry trên logo
    visor: true,
    arms: MITTEN,
    colors: {
      pale: "#F7FCFF",
      mid: "#DDF0FF",
      deep: "#A9D8F5",
      stroke: "#5AA9DC",
      ink: "#2A5A7C",
      blush: "#7FD3F0",
      glow: "#8ED4F5",
      badge: "linear-gradient(135deg, #4CC9F0, #7C6CF7)",
      chip: "#2A5A7C"
    },
    Back: ({ colors }) => (
      <>
        <line x1="150" y1="112" x2="150" y2="78" stroke={colors.stroke} strokeWidth="5" strokeLinecap="round" />
        <circle cx="150" cy="70" r="11" fill="#6FC3EE" stroke="#3E8FC4" strokeWidth="2.5" />
        <circle cx="146" cy="66" r="3.4" fill="#fff" opacity=".8" />
      </>
    ),
    // Thân là khối bo tròn chứ không phải hình trứng: Larry là người máy
    Body: ({ bodyFill, colors }) => (
      <>
        <rect x="65" y="107" width="170" height="150" rx="62" fill={bodyFill} stroke={colors.stroke} strokeWidth="2.8" />
        <ellipse cx="118" cy="146" rx="28" ry="17" fill="#fff" opacity=".7" />
      </>
    ),
    Front: () => <rect x="96" y="146" width="108" height="62" rx="30" fill="#25445E" opacity=".92" />,
    ArmDetail: () => <rect x="-3" y="-8" width="30" height="9" rx="4.5" fill="#6FC3EE" opacity=".9" />
  },

  {
    id: "lumi",
    name: "Lumi",
    emoji: "🐰",
    species: "Thỏ mây hồng",
    tagline: "Bạn nhỏ biết lắng nghe",
    arms: EAR,
    colors: {
      pale: "#FFF9FC",
      mid: "#FFE6F0",
      deep: "#FFBFD8",
      stroke: "#F49CBE",
      ink: "#6B3A55",
      blush: "#FF7FA8",
      glow: "#FFC0DC",
      badge: "linear-gradient(135deg, #FFB3CE, #F07FA8)",
      chip: "#7A3355"
    },
    ArmDetail: () => <ellipse cx="12" cy="90" rx="9" ry="26" fill="#FFD3E4" opacity=".85" />
  },

  {
    id: "miu",
    name: "Miu",
    emoji: "🐱",
    species: "Mèo bạc hà",
    tagline: "Nhẹ nhàng và ấm áp",
    arms: PAW,
    colors: {
      pale: "#F6FFFB",
      mid: "#DCFAEE",
      deep: "#A9E9D0",
      stroke: "#5FC3A1",
      ink: "#2F6B58",
      blush: "#6FD9B4",
      glow: "#9BEBD1",
      badge: "linear-gradient(135deg, #7ED957, #5FC3A1)",
      chip: "#2F6B58"
    },
    Back: ({ colors }) => (
      <>
        <path d="M104,128 L96,84 L138,110 Z" fill="#BDF0DD" stroke={colors.stroke} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M196,128 L204,84 L162,110 Z" fill="#BDF0DD" stroke={colors.stroke} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M106,124 L102,98 L124,113 Z" fill="#FFD9E8" />
        <path d="M194,124 L198,98 L176,113 Z" fill="#FFD9E8" />
      </>
    ),
    Front: ({ colors }) => (
      <g stroke={colors.stroke} strokeWidth="2.4" strokeLinecap="round" opacity=".7">
        <path d="M74,186 L98,190" />
        <path d="M74,200 L98,199" />
        <path d="M226,186 L202,190" />
        <path d="M226,200 L202,199" />
      </g>
    ),
    ArmDetail: () => <PawPads fill="#FFD9E8" />
  },

  {
    id: "bo",
    name: "Bo",
    emoji: "🐻",
    species: "Gấu mật ong",
    tagline: "Cái ôm to cho ngày mệt",
    arms: PAW,
    mouth: "M150,200 v6 M150,206 q-8,7 -14,0 M150,206 q8,7 14,0",
    colors: {
      pale: "#FFFDF3",
      mid: "#FFF0CE",
      deep: "#FFD98A",
      stroke: "#E5AE4E",
      ink: "#7A5320",
      blush: "#FFB27A",
      glow: "#FFDFA0",
      badge: "linear-gradient(135deg, #FFD93D, #E5AE4E)",
      chip: "#7A5320"
    },
    Back: ({ colors }) => (
      <>
        <circle cx="103" cy="119" r="25" fill="#FFE7B4" stroke={colors.stroke} strokeWidth="2.6" />
        <circle cx="197" cy="119" r="25" fill="#FFE7B4" stroke={colors.stroke} strokeWidth="2.6" />
        <circle cx="103" cy="119" r="12" fill="#FFCB94" />
        <circle cx="197" cy="119" r="12" fill="#FFCB94" />
      </>
    ),
    Front: ({ colors }) => (
      <>
        <ellipse cx="150" cy="203" rx="30" ry="22" fill="#FFF7E0" />
        <ellipse cx="150" cy="194" rx="9" ry="6.5" fill={colors.ink} />
      </>
    ),
    ArmDetail: () => <PawPads fill="#FFCB94" />
  },

  {
    id: "pengu",
    name: "Pengu",
    emoji: "🐧",
    species: "Cánh cụt biển",
    tagline: "Bình tĩnh, mát lành",
    eyeY: 168,
    arms: FLIPPER,
    colors: {
      pale: "#F5FBFF",
      mid: "#D9ECFF",
      deep: "#9CC6F0",
      stroke: "#5D8FC9",
      ink: "#2C4A72",
      blush: "#FFA9B8",
      glow: "#9EC8F2",
      badge: "linear-gradient(135deg, #4CC9F0, #41638F)",
      chip: "#2C4A72"
    },
    Back: () => <ellipse cx="150" cy="140" rx="62" ry="44" fill="#41638F" />,
    Front: () => (
      <>
        <ellipse cx="150" cy="196" rx="56" ry="52" fill="#FFFDF8" />
        <path d="M136,186 q14,-10 28,0 q-14,16 -28,0 Z" fill="#FFC24A" stroke="#E39A22" strokeWidth="2" />
      </>
    )
  },

  {
    id: "dino",
    name: "Dino",
    emoji: "🦖",
    species: "Khủng long tí hon",
    tagline: "Nhỏ xíu mà dũng cảm",
    arms: PAW,
    colors: {
      pale: "#FBF7FF",
      mid: "#EDE2FF",
      deep: "#C7ADF5",
      stroke: "#9B7BE0",
      ink: "#4B3480",
      blush: "#FF9ED2",
      glow: "#C9AEF7",
      badge: "linear-gradient(135deg, #A78BFA, #7C6CF7)",
      chip: "#4B3480"
    },
    Back: ({ colors }) => (
      <g fill="#B79BEE" stroke={colors.stroke} strokeWidth="2.4" strokeLinejoin="round">
        <path d="M150,104 l12,16 -22,0 Z" />
        <path d="M118,112 l10,14 -20,2 Z" />
        <path d="M182,112 l-10,14 20,2 Z" />
      </g>
    ),
    Front: ({ colors }) => (
      <>
        <ellipse cx="150" cy="202" rx="26" ry="18" fill="#F6EEFF" />
        <circle cx="142" cy="198" r="3" fill={colors.ink} />
        <circle cx="158" cy="198" r="3" fill={colors.ink} />
      </>
    ),
    ArmDetail: () => <Claws fill="#F6EEFF" />
  }
];

// Larry đứng đầu bộ sưu tập: em nào không đổi gì thì vẫn gặp đúng Larry như cũ.
export const DEFAULT_CHARACTER_ID = "larry";

export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[0];
}

// Nhân vật đã chọn được nhớ lại cho lần sau — em chọn Miu hôm nay thì mai vào
// vẫn là Miu, không phải chọn lại từ đầu.
const STORAGE_KEY = "larry.companion";

export function readSavedCharacterId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CHARACTER_ID;
  } catch {
    return DEFAULT_CHARACTER_ID;
  }
}

export function saveCharacterId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Trình duyệt chặn localStorage thì thôi, không có gì phải xử lý thêm */
  }
}
