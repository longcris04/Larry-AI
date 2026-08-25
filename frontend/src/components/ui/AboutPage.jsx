import React, { useState } from "react";
import { Link } from "react-router-dom";
import KnowledgeGraphExplorer from "./KnowledgeGraphExplorer";
import PlayfulBackground from "./PlayfulBackground";
import { useAuth } from "../../context/AuthContext";
import { useGuestMode } from "../../hooks/useGuestMode";
import { useGuideLink } from "../../hooks/useGuideLink";
import "../../styles/AboutPage.css";

// Trang giới thiệu — CÔNG KHAI, ai mở đường link cũng xem được, không cần đăng
// nhập. Nó nằm song song với trang đăng nhập chứ không nằm sau nó: qua lại giữa
// hai trang bằng thanh điều hướng ở đầu trang.

// Đội ngũ phát triển. Bốn bạn học sinh cùng lớp 8T1.1.
//
// Chưa có tên cụ thể nên chỗ này để trống — điền `name` vào là thẻ tự hiện tên
// thay cho dòng "Thành viên N". KHÔNG bịa tên vào đây.
//
// ẢNH ĐẠI DIỆN — hai bước, không phải sửa JSX:
//   1. Chép ảnh vào  frontend/public/team/   (ví dụ: mai-anh.jpg)
//   2. Điền  photo: "/team/mai-anh.jpg"  vào dòng tương ứng bên dưới
// Để trống `photo` thì thẻ vẫn hiện emoji như cũ, nên thêm được ảnh của bạn nào
// trước cũng được, không cần đủ cả bốn.
//
// `photo` là ĐỊA CHỈ TRÊN WEB, KHÔNG phải đường dẫn file tính từ file này. Mọi
// thứ trong frontend/public/ được phục vụ ngay tại gốc web, nên chữ "public"
// KHÔNG xuất hiện trong địa chỉ:
//
//    file trên máy   frontend/public/team/mai-anh.jpg
//    viết vào đây    "/team/mai-anh.jpg"      ✅ mở bằng dấu /
//    KHÔNG viết      "./../../public/team/mai-anh.jpg"   ❌ trình duyệt tìm
//                    /public/team/... — không có gì ở đó, ra ảnh vỡ
//
// Tên file phải khớp ĐÚNG chữ hoa/chữ thường: HoangLan.png khác hoangLan.png
// trên máy chủ thật (Linux), dù ở Windows mở vẫn ra.
//
// Ảnh nên cắt VUÔNG (khung hiển thị là hình tròn 76px, ảnh chữ nhật sẽ bị cắt bớt
// hai bên) và nhẹ dưới ~200KB — trang giới thiệu giờ là trang đầu tiên ai mở web
// cũng thấy, ảnh nặng làm nó lâu hiện.
const TEAM = [
  { id: 1, name: "Nguyễn Hoàng Lân", emoji: "👩‍💻", photo: "/team/HoangLan.png" },
  { id: 2, name: "Lưu Hoàng Hiệp", emoji: "👨‍💻", photo: "/team/HoangHiep.png" },
  { id: 3, name: "Lê Hoàng Duy Lâm", emoji: "🧑‍🎨", photo: "/team/DuyLam.png" },
  { id: 4, name: "Đoàn Hải Nam", emoji: "🧑‍🔬", photo: "/team/HaiNam.png" }
];

// Ba nhóm cố vấn, hiện thành ba mục liền nhau ngay dưới đội phát triển.
//
// `unit` là bộ môn / phòng ban, `org` là trường hoặc cơ quan — tách hai dòng cho
// dễ đọc, thiếu dòng nào thì thẻ tự bỏ dòng đó đi (xem PersonCard).
//
// ẢNH: giống hệt học sinh — chép ảnh vào frontend/public/team/ rồi điền
// photo: "/team/ten-file.jpg". Chưa có ảnh thì để "" và thẻ hiện emoji.
//
// `id` phải là duy nhất trong CẢ danh sách, không chỉ trong một nhóm — cùng một
// người được nêu ở hai nhóm thì hai thẻ vẫn phải mang hai id khác nhau, không thì
// React dựng lại nhầm thẻ khi trang đổi.
const ADVISOR_GROUPS = [
  {
    id: "co-van-tam-ly",
    eyebrow: "Cố vấn & đồng hành",
    title: "Đội ngũ cố vấn chuyên môn tâm lý học đường",
    people: [
      {
        id: "mai-huong",
        name: "TS. Nguyễn Thị Mai Hương",
        unit: "Khoa Công tác Xã hội",
        org: "Trường ĐH Sư phạm Hà Nội",
        emoji: "🎓",
        photo: ""
      },
      {
        id: "thanh-mai",
        name: "TS. Nguyễn Thị Thanh Mai",
        unit: "Khoa Công tác Xã hội",
        org: "Học viện Phụ nữ Việt Nam",
        emoji: "🎓",
        photo: ""
      },
      {
        id: "anh-nguyet",
        name: "TS. Nguyễn Thị Ánh Nguyệt",
        unit: "Khoa Công tác Xã hội",
        org: "Trường ĐH Sư phạm Hà Nội",
        emoji: "🎓",
        photo: ""
      },
      {
        id: "bich-ngoc",
        name: "ThS. Ngô Thị Bích Ngọc",
        unit: "Phòng Tâm lý học đường",
        org: "Trường THCS Đoàn Thị Điểm",
        emoji: "💬",
        photo: ""
      }
    ]
  },
  {
    id: "co-van-ky-thuat",
    title: "Đội ngũ cố vấn và hỗ trợ kỹ thuật",
    people: [
      {
        id: "quang-nam",
        name: "ThS. Phạm Quang Nam",
        unit: "Phòng Hệ thống Thông tin Quản lý",
        org: "Viện CNTT, Viện Hàn lâm KH&CN Việt Nam",
        emoji: "🧑‍💻",
        photo: "/team/PhamQuangNam.png"
      },
      {
        id: "hoang-long",
        name: "Nguyễn Hoàng Long",
        unit: "Sinh viên Viện Kỹ thuật & Khoa học Máy tính",
        org: "Trường ĐH VinUni",
        emoji: "🧑‍🎓",
        photo: "/team/HoangLong.png"
      },
      {
        id: "tuan-kiet",
        name: "Tạ Tuấn Kiệt",
        unit: "Sinh viên Viện Điện tử Viễn thông",
        org: "Đại học Bách khoa Hà Nội",
        emoji: "🧑‍🎓",
        photo: "/team/TaTuanKiet.png"
      },
      {
        id: "the-trung",
        name: "Phạm Thế Trung",
        unit: "Sinh viên Viện Trí tuệ Nhân tạo",
        org: "Trường ĐH Công nghệ, ĐHQG Hà Nội",
        emoji: "🧑‍🎓",
        photo: "/team/PhamTheTrung.png"
      },
      {
        id: "manh-tuyen",
        name: "ThS. Vi Mạnh Tuyên",
        unit: "Khoa Điện - Điện tử",
        org: "Trường ĐH Phenikaa",
        emoji: "⚡",
        photo: ""
      }
    ]
  },
  {
    id: "co-van-chung",
    title: "Cố vấn chung và tổng thể",
    people: [
      {
        id: "kim-duyen-chung",
        name: "ThS. Phạm Thị Kim Duyên",
        unit: "Tổ Khoa học tự nhiên",
        org: "Trường THCS Đoàn Thị Điểm",
        emoji: "🧑‍🏫",
        photo: "/team/Duyen.png"
      },
      {
        id: "tien-son",
        name: "TS. Bùi Tiến Sơn",
        unit: "Phòng thí nghiệm Robotics mềm",
        org: "Đại học Công nghiệp Hà Nội",
        emoji: "🤖",
        photo: "/team/BuiTienSon.png"
      },
      {
        id: "quang-hoa",
        name: "ThS. Nguyễn Quang Hòa",
        unit: "",
        org: "",
        emoji: "🧭",
        photo: ""
      }
    ]
  }
];

const PAINPOINTS = [
  {
    icon: "🤐",
    title: "Chuyện khó nói ra với người quen",
    body: "Bị bắt nạt, thấy mình vô dụng, nghĩ những điều tiêu cực về bản thân — kể với bố mẹ thì sợ bị mắng, kể với bạn thì sợ cả lớp biết, kể với thầy cô thì sợ làm to chuyện."
  },
  {
    icon: "🕐",
    title: "Phòng tham vấn chỉ mở trong giờ hành chính",
    body: "Nỗi buồn không hẹn giờ. Lúc khó khăn nhất thường là buổi tối, cuối tuần — đúng lúc không còn ai ở trường để hỏi."
  },
  {
    icon: "👀",
    title: "Người lớn biết quá muộn",
    body: "Dấu hiệu ở học sinh thường lộ ra gián tiếp và rải rác. Đến lúc giáo viên chủ nhiệm nhận ra thì chuyện đã đi khá xa."
  },
  {
    icon: "🤖",
    title: "Chatbot thường không hiểu trẻ em",
    body: "Các trợ lý AI phổ thông nói chuyện như với người lớn, và không có quy trình an toàn riêng cho tình huống một học sinh đang gặp nguy hiểm."
  }
];

const AUDIENCE = [
  {
    icon: "🎒",
    title: "Học sinh tiểu học & THCS",
    body: "Người trò chuyện chính. Kể chuyện với Larry bằng cách gõ hoặc nói, bất cứ lúc nào."
  },
  {
    icon: "🍎",
    title: "Giáo viên chủ nhiệm",
    body: "Xem bản tóm tắt tình hình lớp mình và biết khi nào một em cần được hỏi thăm sớm."
  },
  {
    icon: "👑",
    title: "Ban tư vấn tâm lý học đường",
    body: "Theo dõi toàn trường, và là người quyết định có gửi email cảnh báo tới giáo viên hay không."
  }
];

const STEPS = [
  {
    n: 1,
    title: "Mở app và cho Larry nhìn thấy bạn",
    body: "Webcam đọc cảm xúc trên gương mặt trong vài giây rồi tắt. Không cho phép camera cũng không sao — Larry sẽ hỏi bằng lời."
  },
  {
    n: 2,
    title: "Trả lời phiếu cảm xúc nhỏ",
    body: "Vài câu chọn nhanh về việc hôm nay của bạn thế nào. Bỏ qua cũng được."
  },
  {
    n: 3,
    title: "Kể chuyện — gõ hoặc bấm micro để nói",
    body: "Larry mở lời trước. Bạn kể bằng cách gõ, hoặc bấm 🎤 rồi nói bình thường; Larry nghe và trả lời cả bằng chữ lẫn bằng giọng nói."
  },
  {
    n: 4,
    title: "Nhìn sang bảng bên trái để biết Larry dựa vào đâu",
    body: "Mỗi lượt trả lời, bảng đó hiện đúng những mẩu tài liệu mà Larry vừa tra — chính là các chấm trong đồ thị ở cuối trang này."
  },
  {
    n: 5,
    title: "Thư giãn bằng một game Scratch nhỏ",
    body: "Khi cuộc trò chuyện đã nhẹ hơn, Larry gợi ý chơi một game nhỏ để đổi không khí."
  }
];

function Section({ id, eyebrow, title, children, className = "" }) {
  return (
    <section id={id} className={`about-section ${className}`}>
      {eyebrow && <p className="about-eyebrow">{eyebrow}</p>}
      <h2 className="about-h2">{title}</h2>
      {children}
    </section>
  );
}

// Một thẻ người — dùng chung cho cả học sinh lẫn cố vấn. Khác nhau đúng ở phần
// chữ dưới tên (`lines`): học sinh là lớp, cố vấn là đơn vị và cơ quan.
//
// Ảnh không tải được — sai tên file, sai đường dẫn, quên chép vào public/team —
// thì tụt về emoji, thay vì để trình duyệt vẽ khung ảnh vỡ kèm dòng chữ alt tràn
// ra ngoài hình tròn. Trang giới thiệu là trang đầu tiên khách mở web nhìn thấy,
// một cái ảnh vỡ ở đây trông hỏng hơn nhiều so với một emoji vui vẻ.
function PersonCard({ name, emoji, photo, lines = [] }) {
  const [photoBroken, setPhotoBroken] = useState(false);

  return (
    <div className="about-member">
      {/* Emoji để aria-hidden vì nó chỉ là hình trang trí đứng cạnh tên; ảnh thì
          có alt là tên người đó, cho trình đọc màn hình đọc ra được. */}
      {photo && !photoBroken ? (
        <img
          className="about-member__photo"
          src={`${process.env.PUBLIC_URL}${photo}`}
          alt={name}
          width="76"
          height="76"
          loading="lazy"
          onError={() => setPhotoBroken(true)}
        />
      ) : (
        <span className="about-member__avatar" aria-hidden="true">{emoji}</span>
      )}
      <strong className="about-member__name">{name}</strong>
      {/* Bỏ qua dòng rỗng: có cố vấn chỉ ghi mỗi tên, không kèm đơn vị nào */}
      {lines.filter(Boolean).map((line, i) => (
        <span key={i} className="about-member__line">
          {line}
        </span>
      ))}
    </div>
  );
}

export default function AboutPage() {
  // Phần hướng dẫn có nhắc tới nút vào-thẳng-không-cần-đăng-ký, mà nút đó do
  // quản trị viên bật/tắt — xem mục "Chế độ khách" trong trang quản trị.
  const { guestMode, loading: guestModeLoading } = useGuestMode();

  // Link tài liệu hướng dẫn, khai bằng USER_GUIDE_URL trong backend/.env
  const guideUrl = useGuideLink();

  // Mọi nút "vào chat" đều đi qua trang đăng nhập, kể cả khi đã đăng nhập sẵn:
  // đó là cửa vào duy nhất của khung chat. Người đã đăng nhập không phải gõ lại
  // mật khẩu — trang đó nhận ra họ và chỉ hỏi một câu "vào chưa?" (xem Login).
  //
  // Chữ trên nút thì đổi theo, vì mời một người đang đăng nhập đi "Đăng nhập"
  // nghe rất vô duyên.
  const { isAuthenticated } = useAuth();
  const enterTo = "/login";

  return (
    <div className="about-page">
      <PlayfulBackground />

      {/* Thanh điều hướng: qua lại giữa giới thiệu và đăng nhập, tuỳ ý */}
      <header className="about-nav">
        <Link to="/gioi-thieu" className="about-nav__brand">
          <span className="about-nav__avatar">
          <img className="brand-logo" src={`${process.env.PUBLIC_URL}/logo_mark.png`} alt="" />
        </span>
          <span>
            Larry <span className="about-nav__star" aria-hidden="true">⭐</span>
          </span>
        </Link>

        <nav className="about-nav__links">
          <a href="#kho-tri-thuc" className="about-nav__link">
            Kho tri thức
          </a>
          <a href="#huong-dan" className="about-nav__link">
            Cách dùng
          </a>
          <Link to={enterTo} className="about-nav__cta">
            {isAuthenticated ? "Vào chat →" : "Đăng nhập →"}
          </Link>
        </nav>
      </header>

      <main className="about-main">
        {/* --- Mở đầu --- */}
        <section className="about-hero">
          <div className="about-hero__text">
            <p className="about-eyebrow">Dự án học sinh · THCS Đoàn Thị Điểm</p>
            <h1 className="about-h1">
              Larry là người bạn AI <br />
              biết lắng nghe học sinh
            </h1>
            <p className="about-lead">
              Một chatbot đồng hành cảm xúc dành cho học sinh tiểu học và THCS. Larry nhận ra
              tâm trạng của bạn qua webcam, chủ động mở lời bằng tiếng Việt, và lắng nghe những
              chuyện khó nói với người khác — bất cứ lúc nào, không cần chờ tới giờ hành chính.
            </p>
            <div className="about-hero__actions">
              <Link to={enterTo} className="about-btn about-btn--primary">
                Trò chuyện với Larry
              </Link>
              <a href="#kho-tri-thuc" className="about-btn">
                Xem Larry dựa vào đâu
              </a>
            </div>
          </div>

          <div className="about-hero__card" aria-hidden="true">
            <div className="about-chat-demo">
              <div className="about-bubble about-bubble--ai">
                Chào bạn! Mình là Larry 🤖 Hôm nay trông bạn hơi buồn, có chuyện gì kể mình
                nghe không?
              </div>
              <div className="about-bubble about-bubble--user">
                Mấy bạn trong lớp không cho tớ chơi cùng...
              </div>
              <div className="about-bubble about-bubble--ai">
                Nghe buồn thật đấy. Cảm ơn bạn đã kể với mình. Chuyện đó xảy ra lâu chưa?
              </div>
            </div>
          </div>
        </section>

        {/* --- Vấn đề --- */}
        <Section
          eyebrow="Vấn đề"
          title="Vì sao học sinh cần một người bạn như Larry?"
        >
          <div className="about-grid about-grid--2">
            {PAINPOINTS.map((p) => (
              <div key={p.title} className="about-card">
                <span className="about-card__icon" aria-hidden="true">{p.icon}</span>
                <h3 className="about-card__title">{p.title}</h3>
                <p className="about-card__body">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- Mục tiêu --- */}
        <Section eyebrow="Mục tiêu" title="Larry được làm ra để làm gì?">
          <ul className="about-goals">
            <li>
              <strong>Có mặt lúc cần nhất.</strong> Một chỗ để nói ra ngay khi buồn, kể cả 10
              giờ đêm, mà không sợ bị đánh giá.
            </li>
            <li>
              <strong>Nghe đúng cách với trẻ em.</strong> Không giảng đạo, không phán xét, không
              hứa những điều không giữ được — và tuyệt đối không giả vờ là bác sĩ tâm lý.
            </li>
            <li>
              <strong>Báo cho người lớn đúng lúc.</strong> Khi có dấu hiệu đáng lo, hệ thống tóm
              tắt lại cho ban tư vấn và giáo viên chủ nhiệm, để người lớn vào cuộc sớm.
            </li>
            <li>
              <strong>Trả lời có chỗ dựa.</strong> Mỗi câu Larry nói đều tra từ một kho tri thức
              do chuyên môn tâm lý học đường biên soạn — xem tận mắt ở{" "}
              <a href="#kho-tri-thuc">phần cuối trang</a>.
            </li>
          </ul>
        </Section>

        {/* --- Đối tượng --- */}
        <Section eyebrow="Đối tượng sử dụng" title="Larry dành cho ai?">
          <div className="about-grid about-grid--3">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="about-card about-card--center">
                <span className="about-card__icon" aria-hidden="true">{a.icon}</span>
                <h3 className="about-card__title">{a.title}</h3>
                <p className="about-card__body">{a.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- Hướng dẫn --- */}
        <Section id="huong-dan" eyebrow="Hướng dẫn" title="Dùng Larry như thế nào?">
          <ol className="about-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="about-step">
                <span className="about-step__n" aria-hidden="true">{s.n}</span>
                <div>
                  <h3 className="about-step__title">{s.title}</h3>
                  <p className="about-card__body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Tài liệu hướng dẫn đầy đủ. Đặt NGAY SAU năm bước: ai đọc hết tới đây
              là người đang muốn biết cách dùng, đúng lúc đưa tài liệu chi tiết.
              Chưa khai USER_GUIDE_URL trong backend/.env thì khối này không hiện. */}
          {guideUrl && (
            <p className="about-guide">
              <a
                className="about-btn about-btn--primary"
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                📄 Xem hướng dẫn sử dụng đầy đủ ↗
              </a>
            </p>
          )}

          {/* Chỉ nhắc tới nút vào-thẳng khi quản trị viên đang BẬT chế độ khách.
              Trang này là cửa vào của cả web, để nó mời một cái nút không còn ở
              đó là đẩy học sinh đi tìm một thứ không tồn tại. */}
          {!guestModeLoading && guestMode && (
            <p className="about-note">
              💡 Chưa muốn tạo tài khoản? Ở trang đăng nhập có nút{" "}
              <strong>“Trò chuyện với Larry ngay”</strong> — vào nói chuyện luôn, không cần
              đăng ký.
            </p>
          )}
        </Section>

        {/* --- Kho tri thức --- */}
        <Section
          id="kho-tri-thuc"
          eyebrow="Larry dựa vào đâu"
          title="Kho tri thức mà Larry tra trước khi trả lời"
          className="about-section--wide"
        >
          <p className="about-lead about-lead--small">
            Larry không tự nghĩ ra lời khuyên. Trước mỗi câu trả lời, Larry tra một kho tri thức
            được biên soạn từ tài liệu chuyên môn về tâm lý học đường — mỗi chấm dưới đây là một
            mẩu tri thức, mỗi đường nối là một mối liên hệ do người viết nối tay. Chính những
            mối nối đó cho phép Larry đi từ <em>một dấu hiệu bạn kể</em> sang{" "}
            <em>việc nên làm</em>, thứ mà tìm theo từ khoá đơn thuần không bao giờ ra.
          </p>

          <KnowledgeGraphExplorer />
        </Section>

        {/* --- Đội ngũ --- */}
        <Section eyebrow="Đội ngũ phát triển" title="Ai làm ra Larry?">
          <p className="about-lead about-lead--small">
            Larry AI được phát triển bởi <strong>4 bạn học sinh lớp 8T1.1</strong>, trường{" "}
            <strong>THCS Đoàn Thị Điểm</strong>.
          </p>

          <div className="about-team">
            {TEAM.map((member, i) => (
              <PersonCard
                key={member.id}
                name={member.name || `Thành viên ${i + 1}`}
                emoji={member.emoji}
                photo={member.photo}
                lines={["Lớp 8T1.1"]}
              />
            ))}
          </div>
        </Section>

        {/* --- Cố vấn --- */}
        {/* Ba mục riêng chứ không gộp một: mỗi nhóm cố vấn giúp Larry ở một mặt
            khác hẳn nhau (chuyên môn tâm lý / kỹ thuật / định hướng chung), gộp
            lại thành một danh sách dài là mất đúng thông tin đó. Thẻ cố vấn rộng
            hơn thẻ học sinh vì phải chứa tên đơn vị. */}
        {ADVISOR_GROUPS.map((group) => (
          <Section key={group.id} id={group.id} eyebrow={group.eyebrow} title={group.title}>
            <div className="about-team about-team--advisors">
              {group.people.map((person) => (
                <PersonCard
                  key={person.id}
                  name={person.name}
                  emoji={person.emoji}
                  photo={person.photo}
                  lines={[person.unit, person.org]}
                />
              ))}
            </div>
          </Section>
        ))}

        {/* --- Kết --- */}
        <section className="about-cta">
          <h2 className="about-h2">Sẵn sàng trò chuyện chưa?</h2>
          <p className="about-card__body">
            Larry đang đợi để nghe câu chuyện của bạn.
          </p>
          <Link to={enterTo} className="about-btn about-btn--primary about-btn--lg">
            Bắt đầu ngay →
          </Link>
        </section>
      </main>

      <footer className="about-footer">
        <p>
          Larry AI · Dự án của học sinh lớp 8T1.1, THCS Đoàn Thị Điểm ·{" "}
          <Link to={enterTo}>{isAuthenticated ? "Vào chat" : "Đăng nhập"}</Link>
        </p>
        <p className="about-footer__warn">
          Larry là người bạn để tâm sự, <strong>không thay thế</strong> bác sĩ hay chuyên gia
          tâm lý. Khi có nguy hiểm tới tính mạng, hãy gọi ngay{" "}
          <strong>111</strong> (Tổng đài quốc gia bảo vệ trẻ em) hoặc <strong>115</strong>.
        </p>
      </footer>
    </div>
  );
}
