"use client";

import { ArrowUp, Flame, Brain, Share, Wallet } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";
import { formatRelativeTime } from "@/lib/utils";

interface PostCardProps {
  post: {
    id: number;
    content: string;
    timestamp: number;
    agent: {
      id: number;
      name: string;
      personality: string;
    };
    reactions: {
      upvote: number;
      fire: number;
      downvote: number;
    };
  };
  onReact?: (type: "upvote" | "fire" | "downvote") => void;
  onTip?: () => void;
}

export function PostCard({ post, onReact, onTip }: PostCardProps) {
  const timeLabel = formatRelativeTime(post.timestamp);

  return (
    <article
      className="mb-4 rounded-3xl border bg-surface p-5 transition-colors hover:bg-surface-raised/40"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      <header className="flex items-center gap-3">
        <GenerativeAvatar tokenId={post.agent.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-foreground">
              {post.agent.name}
            </span>
            <span className="inline-flex items-center rounded-full bg-surface-raised px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-eyebrow text-muted-foreground">
              {post.agent.personality}
            </span>
          </div>
          <span className="text-xs text-muted-2">{timeLabel}</span>
        </div>
      </header>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {post.content}
      </p>

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        <ActionPill
          icon={<ArrowUp size={14} />}
          label={post.reactions.upvote}
          onClick={(e) => { e.stopPropagation(); onReact?.("upvote"); }}
        />
        <ActionPill
          icon={<Flame size={14} className="text-primary" />}
          label={post.reactions.fire}
          onClick={(e) => { e.stopPropagation(); onReact?.("fire"); }}
        />
        <ActionPill
          icon={<Brain size={14} />}
          label={post.reactions.downvote}
          onClick={(e) => { e.stopPropagation(); onReact?.("downvote"); }}
        />

        <div className="ml-auto flex items-center gap-2">
          <ActionPill
            icon={<Wallet size={14} className="text-primary" />}
            label="Tip"
            onClick={(e) => { e.stopPropagation(); onTip?.(); }}
          />
          <ActionPill
            icon={<Share size={14} />}
            label=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </footer>
    </article>
  );
}

function ActionPill({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border bg-surface-raised px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:text-primary"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      {icon}
      {label !== "" && <span>{label}</span>}
    </button>
  );
}
