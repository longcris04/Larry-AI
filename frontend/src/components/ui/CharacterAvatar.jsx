import { useId } from "react";
import { getCharacter } from "../../constants/characters";
import "../../styles/companion.css";

// Khung vẽ dùng chung cho MỌI nhân vật trong bộ sưu tập.
//
// Tư thế được điều khiển bằng hai thuộc tính data trên thẻ <svg>, còn góc xoay
// nằm hết trong companion.css:
//
//   arms: cover | back | down | up | wave
//   eyes: shut | open | happy
//
// Cách này quan trọng ở chỗ: đổi tư thế là CSS tự chuyển động mượt sang tư thế
// mới (transition), nên lúc Larry "mở mắt" em thấy hai bàn tay từ từ vén ra chứ
// không phải khuôn mặt nhảy phắt sang hình khác.

// Thân mặc định: một khối trứng tròn. Nhân vật nào cần hình khác (Larry là khối
// bo tròn của người máy) thì tự khai `Body` trong bộ sưu tập.
function RoundBody({ bodyFill, colors }) {
  return (
    <>
      <ellipse cx="150" cy="182" rx="85" ry="75" fill={bodyFill} />
      <ellipse cx="150" cy="182" rx="85" ry="75" fill="none" stroke={colors.stroke} strokeWidth="2.6" opacity=".8" />
      <ellipse cx="120" cy="146" rx="31" ry="20" fill="#fff" opacity=".6" />
    </>
  );
}

// Trong khi mắt đang MỞ, thỉnh thoảng chớp một cái. Làm bằng CSS animation chứ
// không phải setInterval: không tốn một vòng render nào của React, và tự dừng
// khi mắt đang nhắm (lúc đó nhóm .eyes-open bị ẩn hẳn).
export default function CharacterAvatar({
  characterId,
  eyes = "shut",
  arms = "cover",
  mood = "",
  size,
  className = "",
  children
}) {
  const character = getCharacter(characterId);
  const { colors } = character;

  // Nhiều avatar cùng nằm trên một trang (bảng chọn nhân vật), nên id của
  // gradient PHẢI khác nhau — trùng id thì mọi avatar dùng chung màu của cái
  // được vẽ đầu tiên.
  const uid = useId().replace(/:/g, "");
  const bodyId = `body-${uid}`;
  const armId = `arm-${uid}`;
  const glowId = `glow-${uid}`;
  const irisId = `iris-${uid}`;

  const eyeY = character.eyeY || 174;
  const Back = character.Back;
  const Front = character.Front;
  const ArmDetail = character.ArmDetail;

  const Body = character.Body || RoundBody;

  // Mắt của Larry là hai vệt sáng trên mặt kính; các bạn khác có tròng mắt thật.
  const face = character.visor ? (
    <>
      <g className="eyes eyes-open">
        <ellipse cx="128" cy={eyeY} rx="12" ry="14" fill="#67E8F9" />
        <ellipse cx="172" cy={eyeY} rx="12" ry="14" fill="#67E8F9" />
        <circle cx="124" cy={eyeY - 6} r="4" fill="#fff" opacity=".9" />
        <circle cx="168" cy={eyeY - 6} r="4" fill="#fff" opacity=".9" />
      </g>
      <g className="eyes eyes-shut">
        <path d={`M116,${eyeY} q12,10 24,0`} fill="none" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" />
        <path d={`M160,${eyeY} q12,10 24,0`} fill="none" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="eyes eyes-happy">
        <path d={`M116,${eyeY + 5} q12,-13 24,0`} fill="none" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" />
        <path d={`M160,${eyeY + 5} q12,-13 24,0`} fill="none" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M140,193 q10,9 20,0" fill="none" stroke="#67E8F9" strokeWidth="4" strokeLinecap="round" />
    </>
  ) : (
    <>
      <g className="eyes eyes-open">
        <ellipse cx="124" cy={eyeY} rx="14" ry="16.5" fill={`url(#${irisId})`} />
        <ellipse cx="176" cy={eyeY} rx="14" ry="16.5" fill={`url(#${irisId})`} />
        <circle cx="119" cy={eyeY - 7} r="5.4" fill="#fff" />
        <circle cx="171" cy={eyeY - 7} r="5.4" fill="#fff" />
        <circle cx="129" cy={eyeY + 7} r="2.9" fill="#fff" opacity=".9" />
        <circle cx="181" cy={eyeY + 7} r="2.9" fill="#fff" opacity=".9" />
      </g>
      <g className="eyes eyes-shut">
        <path d={`M113,${eyeY - 2} q11,10 22,0`} fill="none" stroke={colors.ink} strokeWidth="4.4" strokeLinecap="round" />
        <path d={`M165,${eyeY - 2} q11,10 22,0`} fill="none" stroke={colors.ink} strokeWidth="4.4" strokeLinecap="round" />
      </g>
      <g className="eyes eyes-happy">
        <path d={`M113,${eyeY + 4} q11,-13 22,0`} fill="none" stroke={colors.ink} strokeWidth="4.4" strokeLinecap="round" />
        <path d={`M165,${eyeY + 4} q11,-13 22,0`} fill="none" stroke={colors.ink} strokeWidth="4.4" strokeLinecap="round" />
      </g>
    </>
  );

  return (
    <div
      className={`companion ${mood ? `companion--${mood}` : ""} ${className}`}
      style={size ? { width: size } : undefined}
    >
      <svg
        className="companion__svg"
        viewBox="0 0 300 300"
        data-arms={arms}
        data-eyes={eyes}
        role="img"
        aria-label={`${character.name} — ${character.species}`}
      >
        <defs>
          <radialGradient id={bodyId} cx="38%" cy="26%" r="82%">
            <stop offset="0%" stopColor={colors.pale} />
            <stop offset="46%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.deep} />
          </radialGradient>
          <linearGradient id={armId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.pale} />
            <stop offset="100%" stopColor={colors.deep} />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.glow} stopOpacity=".95" />
            <stop offset="52%" stopColor={colors.glow} stopOpacity=".4" />
            <stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={irisId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2B2340" />
            <stop offset="56%" stopColor="#4A3B63" />
            <stop offset="100%" stopColor="#A583C0" />
          </linearGradient>
        </defs>

        <g className="companion__float">
          <ellipse className="companion__glow" cx="150" cy="182" rx="128" ry="118" fill={`url(#${glowId})`} />
          <ellipse cx="150" cy="266" rx="58" ry="10" fill={colors.stroke} opacity=".2" />

          {Back && <Back colors={colors} />}
          <Body bodyFill={`url(#${bodyId})`} colors={colors} />
          {Front && <Front colors={colors} />}

          {face}

          {!character.visor && (
            <>
              <ellipse cx="100" cy="194" rx="12" ry="7.5" fill={colors.blush} opacity=".42" />
              <ellipse cx="200" cy="194" rx="12" ry="7.5" fill={colors.blush} opacity=".42" />
              <path
                d={character.mouth || "M143,198 q7,7 14,0"}
                fill="none"
                stroke={colors.ink}
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </>
          )}

          <g className="companion__arm companion__arm--l">
            <path d={character.arms.l} fill={`url(#${armId})`} stroke={colors.stroke} strokeWidth="2.6" />
            {ArmDetail && (
              <g transform="translate(96,112)">
                <ArmDetail colors={colors} />
              </g>
            )}
          </g>
          <g className="companion__arm companion__arm--r">
            <path d={character.arms.r} fill={`url(#${armId})`} stroke={colors.stroke} strokeWidth="2.6" />
            {ArmDetail && (
              <g transform="translate(176,112)">
                <ArmDetail colors={colors} />
              </g>
            )}
          </g>
        </g>
      </svg>

      {/* Khung camera nhỏ nép bên cạnh nhân vật, do nơi gọi truyền vào */}
      {children}
    </div>
  );
}
