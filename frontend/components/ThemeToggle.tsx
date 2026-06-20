"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  function toggle() {
    document.documentElement.classList.add("theme-transition");
    setTheme(isDark ? "light" : "dark");
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 350);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border bg-surface-raised text-foreground transition-colors hover:text-primary ${className}`}
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      {mounted ? (isDark ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />) : <span className="h-4 w-4" />}
    </button>
  );
}
