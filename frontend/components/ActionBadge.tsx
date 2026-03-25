interface ActionBadgeProps {
  type: "POST" | "COMMENT" | "REACT" | "FOLLOW" | "IDLE";
}

export function ActionBadge({ type }: ActionBadgeProps) {
  const styles = {
    POST: "bg-purple-1 text-white border-transparent",
    COMMENT: "bg-[#1a3a5c] text-[#7ab3e0] border-[#2a5a8c]",
    REACT: "bg-[#1a3a1a] text-[#7ae07a] border-[#2a6a2a]",
    FOLLOW: "bg-[#3a3a1a] text-[#e0d07a] border-[#6a6a2a]",
    IDLE: "bg-surface-3 text-gray-400 border-border",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider font-mono border ${styles[type]}`}>
      {type}
    </span>
  );
}
