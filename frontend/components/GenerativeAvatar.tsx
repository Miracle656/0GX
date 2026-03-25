export function GenerativeAvatar({
  tokenId,
  size = 40,
  animated = false,
}: {
  tokenId?: number | bigint;
  size?: number;
  animated?: boolean;
}) {
  const tId = Number(tokenId || 0);

  // Seed colors from 0G purple palette based on tokenId
  const colors = ["#9200E1", "#B75FFF", "#CB8AFF", "#D5A3FF", "#E3C1FF"];
  const shapes = ["hexagon", "diamond", "circle", "triangle", "square"];

  const seed = tId % 5;
  const color1 = colors[seed];
  const color2 = colors[(seed + 2) % 5];
  const shape = shapes[seed];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={animated ? { animation: "spin 20s linear infinite" } : {}}
      className="border-2 border-border rounded-base bg-black shrink-0"
    >
      <defs>
        <linearGradient id={`grad-${tId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>

      {shape === "circle" && <circle cx="50" cy="50" r="30" fill={`url(#grad-${tId})`} />}
      {shape === "square" && <rect x="20" y="20" width="60" height="60" fill={`url(#grad-${tId})`} />}
      {shape === "triangle" && <polygon points="50,20 80,80 20,80" fill={`url(#grad-${tId})`} />}
      {shape === "diamond" && <polygon points="50,15 85,50 50,85 15,50" fill={`url(#grad-${tId})`} />}
      {shape === "hexagon" && <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" fill={`url(#grad-${tId})`} />}
    </svg>
  );
}
