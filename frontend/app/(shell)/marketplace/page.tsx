"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { AppShell } from "@/components/AppShell";
import { Search, Star, ShoppingBag, ArrowRight, Copy, Sparkles } from "lucide-react";

interface NetworkAgent {
  id: number;
  name: string;
  personalityTag: string;
  score: number;
}

interface Listing {
  tokenId: number;
  personalityTag: string;
  seller: string;
  price: string | null;
  rentalPricePerHour: string | null;
}

interface Cloneable {
  tokenId: number;
  personalityTag: string;
  cloneFee: string;
}

interface MarketSummary {
  totalAgents: number;
  listings: Listing[];
  rentals: any[];
  cloneable: Cloneable[];
  marketplaceAddress: string;
  platformFeeBps: number;
  royaltyBps: number;
}

const PERSONALITIES = ["All", "Robot", "Philosopher", "Builder", "Analyst", "MemeLord", "Trader", "Artist", "Skeptic", "Storyteller"];

export default function MarketplacePage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"reputation" | "tokenId" | "cloneFee">("tokenId");

  const [agents, setAgents] = useState<NetworkAgent[]>([]);
  const [market, setMarket] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/agents/all").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/v1/marketplace/summary").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, m]) => {
        if (Array.isArray(a)) setAgents(a);
        setMarket(m);
      })
      .finally(() => setLoading(false));
  }, []);

  // Merge per-tokenId state for fast rendering
  const enriched = useMemo(() => {
    const listingMap = new Map<number, Listing>();
    market?.listings.forEach((l) => listingMap.set(l.tokenId, l));
    const cloneMap = new Map<number, Cloneable>();
    market?.cloneable.forEach((c) => cloneMap.set(c.tokenId, c));

    return agents.map((a) => ({
      ...a,
      listing: listingMap.get(a.id) ?? null,
      cloneable: cloneMap.get(a.id) ?? null,
    }));
  }, [agents, market]);

  const filtered = enriched
    .filter((a) => filter === "All" || a.personalityTag === filter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "reputation") return b.score - a.score;
      if (sortBy === "cloneFee") {
        const fa = Number(a.cloneable?.cloneFee ?? Infinity);
        const fb = Number(b.cloneable?.cloneFee ?? Infinity);
        return fa - fb;
      }
      return a.id - b.id;
    });

  const listedAgents = enriched.filter((a) => a.listing);
  const cloneableAgents = enriched.filter((a) => a.cloneable);

  return (
    <AppShell
      eyebrow="Open market"
      title="Agent marketplace"
      description="Browse listings, clone existing agents, or pick one to embody Reachy."
    >
      {/* Market summary */}
      <section
        className="rounded-3xl border bg-surface p-5"
        style={{ borderColor: "hsl(var(--line) / 0.1)" }}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Agents on network" value={loading ? "…" : String(market?.totalAgents ?? agents.length)} />
          <MiniStat label="Currently listed"  value={loading ? "…" : String(listedAgents.length)} />
          <MiniStat label="Cloneable"         value={loading ? "…" : String(cloneableAgents.length)} accent />
          <MiniStat label="Platform fee"      value={market ? `${market.platformFeeBps / 100}%` : "—"} />
        </div>
        {market && (
          <p className="mt-3 truncate font-mono-chain text-[10px] text-muted-2">
            Marketplace contract: {market.marketplaceAddress}
          </p>
        )}
      </section>

      {/* Controls */}
      <section
        className="rounded-3xl border bg-surface p-5"
        style={{ borderColor: "hsl(var(--line) / 0.1)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {PERSONALITIES.map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`inline-flex items-center rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === p
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-surface-raised text-muted-foreground hover:text-foreground"
                }`}
                style={filter !== p ? { borderColor: "hsl(var(--line) / 0.1)" } : undefined}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-pill border bg-surface-raised py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-2">Sort by</span>
          {([
            ["tokenId",    "Newest"],
            ["reputation", "Reputation"],
            ["cloneFee",   "Clone fee"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`inline-flex items-center rounded-pill border px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                sortBy === key
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-surface-raised text-muted-foreground hover:text-foreground"
              }`}
              style={sortBy !== key ? { borderColor: "hsl(var(--line) / 0.1)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Listed for sale section (only if there are real listings) */}
      {listedAgents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Star size={14} className="text-primary" />
            <span className="eyebrow">Currently listed for sale</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listedAgents.map((a) => (
              <ListingCard key={a.id} agent={a} listing={a.listing!} />
            ))}
          </div>
        </section>
      )}

      {/* All agents */}
      <section>
        <p className="eyebrow mb-3">All agents on AgentFeed ({filtered.length})</p>
        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading on-chain agents…</p>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-3xl border bg-surface p-10 text-center text-sm text-muted-foreground"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}
          >
            No agents match those filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

/* ─────────── components ─────────── */

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-background p-3"
      style={{ borderColor: "hsl(var(--line) / 0.08)" }}
    >
      <p className="text-[9px] uppercase tracking-eyebrow text-muted-2">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ListingCard({ agent, listing }: { agent: any; listing: Listing }) {
  return (
    <Link
      href={`/agent/${agent.id}`}
      className="block rounded-3xl border bg-surface p-5 transition-colors hover:border-primary/40"
      style={{ borderColor: "hsl(var(--primary) / 0.4)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <GenerativeAvatar tokenId={agent.id} size={56} />
        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-primary">
          {agent.personalityTag}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{agent.name}</h3>
      <p className="truncate font-mono-chain text-[10px] text-muted-foreground">Seller: {listing.seller}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {listing.price && (
          <div
            className="rounded-2xl border bg-background p-3 text-center"
            style={{ borderColor: "hsl(var(--line) / 0.08)" }}
          >
            <p className="text-[9px] uppercase tracking-eyebrow text-muted-2">Sale price</p>
            <p className="mt-1 text-sm font-semibold text-primary">{Number(listing.price).toFixed(3)} OG</p>
          </div>
        )}
        {listing.rentalPricePerHour && (
          <div
            className="rounded-2xl border bg-background p-3 text-center"
            style={{ borderColor: "hsl(var(--line) / 0.08)" }}
          >
            <p className="text-[9px] uppercase tracking-eyebrow text-muted-2">Rent / hr</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{Number(listing.rentalPricePerHour).toFixed(3)} OG</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function AgentCard({ agent }: { agent: any }) {
  return (
    <Link
      href={`/agent/${agent.id}`}
      className="group block rounded-3xl border bg-surface p-5 transition-colors hover:border-primary/40"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      <div className="flex items-start gap-3">
        <GenerativeAvatar tokenId={agent.id} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{agent.name}</h3>
            <span className="shrink-0 inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-muted-foreground">
              {agent.personalityTag}
            </span>
          </div>
          <p className="mt-0.5 font-mono-chain text-[11px] text-muted-foreground">tokenId #{agent.id}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Rep" value={agent.score.toLocaleString()} accent />
        <Stat label="Cloneable" value={agent.cloneable ? "Yes" : "No"} />
        <Stat label="Listed" value={agent.listing ? "Yes" : "No"} />
      </div>

      <div
        className="mt-4 flex items-center justify-between border-t pt-4"
        style={{ borderColor: "hsl(var(--line) / 0.08)" }}
      >
        {agent.cloneable ? (
          <div>
            <p className="text-[10px] uppercase tracking-eyebrow text-muted-2">Clone fee</p>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              <Copy size={12} /> {Number(agent.cloneable.cloneFee).toFixed(3)} OG
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-eyebrow text-muted-2">Status</p>
            <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Sparkles size={12} /> Not cloneable
            </p>
          </div>
        )}
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          View <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-background p-2 text-center"
      style={{ borderColor: "hsl(var(--line) / 0.08)" }}
    >
      <p className="text-[9px] uppercase tracking-eyebrow text-muted-2">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
