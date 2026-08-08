export default function PlayfulBackground() {
  const shapes = [
    { type: "cloud", emoji: "☁️", top: "8%", left: "5%", delay: "0s" },
    { type: "cloud", emoji: "☁️", top: "15%", right: "8%", delay: "1s" },
    { type: "star", emoji: "⭐", top: "6%", left: "45%", delay: "0.5s" },
    { type: "star", emoji: "✨", top: "22%", left: "20%", delay: "1.5s" },
    { type: "star", emoji: "⭐", bottom: "18%", right: "12%", delay: "0.8s" },
    { type: "heart", emoji: "💛", top: "35%", right: "5%", delay: "0s" },
    { type: "heart", emoji: "💙", bottom: "30%", left: "8%", delay: "1.2s" },
    { type: "heart", emoji: "💜", top: "55%", left: "3%", delay: "0.6s" },
  ];

  const circles = [
    { color: "#FFD93D", size: 80, top: "12%", left: "70%" },
    { color: "#FF8FAB", size: 60, bottom: "25%", left: "15%" },
    { color: "#4CC9F0", size: 100, bottom: "10%", right: "20%" },
    { color: "#A78BFA", size: 50, top: "40%", right: "30%" },
    { color: "#7ED957", size: 70, top: "70%", left: "40%" },
  ];

  const blocks = [
    { color: "#FFD93D", top: "18%", left: "30%", rotate: "15deg" },
    { color: "#4CC9F0", top: "50%", right: "6%", rotate: "-10deg" },
    { color: "#FF8FAB", bottom: "40%", left: "25%", rotate: "20deg" },
    { color: "#A78BFA", bottom: "15%", right: "35%", rotate: "-15deg" },
  ];

  return (
    <div className="playful-bg" aria-hidden="true">
      <div
        className="bg-shape"
        style={{
          top: "4%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "4rem",
          opacity: 0.12,
        }}
      >
        🌈
      </div>

      {shapes.map((s, i) => (
        <span
          key={i}
          className={`bg-shape bg-${s.type}`}
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            bottom: s.bottom,
            animationDelay: s.delay,
          }}
        >
          {s.emoji}
        </span>
      ))}

      {circles.map((c, i) => (
        <div
          key={`c-${i}`}
          className="bg-shape bg-circle"
          style={{
            width: c.size,
            height: c.size,
            background: c.color,
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            animation: `float ${5 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      {blocks.map((b, i) => (
        <div
          key={`b-${i}`}
          className="bg-shape bg-block"
          style={{
            background: b.color,
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            transform: `rotate(${b.rotate})`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}

      <span
        className="bg-shape"
        style={{ bottom: "8%", left: "50%", fontSize: "1.5rem", opacity: 0.2 }}
      >
        😊
      </span>
    </div>
  );
}
