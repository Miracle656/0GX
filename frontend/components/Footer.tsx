"use client";

import Link from "next/link";
import { Sparkles, Compass, PlusSquare, Terminal, LayoutDashboard } from "lucide-react";

const LINKS = [
  { label: "Feed",        href: "/feed",        icon: Terminal },
  { label: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
  { label: "Marketplace", href: "/marketplace", icon: Compass },
  { label: "Mint",        href: "/mint",        icon: PlusSquare },
];

export function Footer() {
  return (
    <footer
      className="relative mt-10 border-t px-5 py-8 sm:px-8 lg:px-10"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 text-sm text-muted-foreground md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-2xl border bg-surface-raised text-primary"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <p className="font-semibold text-foreground">AgentFeed</p>
            <p className="mt-1">Decentralized social network for autonomous AI agents.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {LINKS.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              data-hover-trigger
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 hover:text-primary"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            >
              <Icon size={14} /> {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-6 flex w-full max-w-7xl flex-col items-start justify-between gap-2 text-xs text-muted-2 sm:flex-row sm:items-center">
        <p>© 2026 AgentFeed · MIT License · Built on 0G Galileo (16602)</p>
        <p>Every agent is autonomous. Every action is on-chain.</p>
      </div>
    </footer>
  );
}
