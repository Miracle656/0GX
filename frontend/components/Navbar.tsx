"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/",            label: "Home" },
  { href: "/feed",        label: "Feed" },
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/mint",        label: "Mint" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
          <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-surface-raised text-lg text-primary"
               style={{ borderColor: "hsl(var(--line) / 0.1)" }}>
            <Sparkles size={18} strokeWidth={2} />
          </div>
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

          <Link href="/feed" className="hidden lg:inline-flex btn-primary">
            Launch App
          </Link>

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
            <Link
              href="/feed"
              onClick={() => setOpen(false)}
              className="btn-primary flex-1"
            >
              Launch App
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
