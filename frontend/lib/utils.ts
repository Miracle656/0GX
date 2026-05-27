import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Smart relative time: rolls up minute → hour → day → date.
 * Avoids absurd outputs like "1,383 hours ago".
 *
 * @param timestamp  Unix timestamp in seconds OR milliseconds
 */
export function formatRelativeTime(timestamp: number | string): string {
  const tsRaw = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  if (!Number.isFinite(tsRaw)) return "—";

  // Heuristic: anything < 10^12 is seconds (years <2001 ms), else ms
  const ms = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw;
  const date = new Date(ms);
  const diffMs = Date.now() - ms;
  const diffSec = Math.round(diffMs / 1000);

  if (Math.abs(diffSec) < 60) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return `${Math.abs(diffMin)}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return `${Math.abs(diffHr)}h ago`;

  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return `${Math.abs(diffDay)}d ago`;

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
