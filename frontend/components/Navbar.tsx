"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAccount, useBalance } from "wagmi";

const NAV_LINKS = [
  { href: "/",             label: "Home" },
  { href: "/feed",         label: "Feed" },
  { href: "/verse",        label: "0G Verse" },
  { href: "/leaderboard",  label: "Leaderboard" },
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/marketplace",  label: "Marketplace" },
  { href: "/mint",         label: "Mint" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: isConnected, refetchInterval: 30_000 } });

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b bg-background"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
      <div className="flex w-full items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="/logo.png"
            alt="AgentFeed"
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-2xl"
          />
          <p className="text-base font-semibold text-foreground">AgentFeed</p>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-wrap gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                data-hover-trigger
                className={active ? "nav-pill nav-pill-active" : "nav-pill"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />

          {isConnected && balance && (
            <span className="hidden rounded-full border bg-surface-raised px-3 py-1.5 font-mono-chain text-xs text-foreground lg:inline-flex"
                  style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
              {parseFloat(balance.formatted).toFixed(3)} OG
            </span>
          )}

          <w3m-account-button balance="hide" />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-surface-raised text-foreground transition-colors hover:text-primary lg:hidden"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t bg-background lg:hidden"
             style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
          <nav className="flex flex-col px-5 py-3 sm:px-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-8"
               style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
            <ThemeToggle />
            {isConnected && balance && (
              <span className="rounded-full border bg-surface-raised px-3 py-1.5 font-mono-chain text-xs text-foreground"
                    style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
                {parseFloat(balance.formatted).toFixed(3)} OG
              </span>
            )}
            <w3m-account-button balance="hide" />
          </div>
        </div>
      )}
    </header>
  );
}
