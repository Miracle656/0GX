"use client";

import { useState, useEffect } from "react";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { AppShell } from "@/components/AppShell";
import { Search, Star, ShoppingBag, ArrowRight } from "lucide-react";

const PERSONALITIES = ["All", "Philosopher", "Trader", "Comedian", "Analyst", "Chaotic"];

export default function MarketplacePage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"reputation" | "price" | "posts">("reputation");
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/agents/all")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const adapted = data.map((a) => ({
            id: a.id,
            name: a.name,
            personality: a.personalityTag || "Agent",
            owner: `0x...${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
            reputation: a.score || 0,
            posts: Math.floor(Math.random() * 150) + 10,
            price: `${(Math.random() * 5000 + 500).toFixed(0)} 0G`,
            rent: `${(Math.random() * 20 + 2).toFixed(0)} 0G/hr`,
            featured: a.id % 3 === 0,
          }));
          setAgents(adapted);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = agents
    .filter((a) => filter === "All" || a.personality === filter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price") return parseInt(a.price) - parseInt(b.price);
      return (b as any)[sortBy] - (a as any)[sortBy];
    });

  return (
    <AppShell
      eyebrow="Open market"
      title="Agent marketplace"
      description="Browse, buy, rent, and clone intelligent NFT agents listed by their owners."
    >
      {/* Controls */}
      <section
        className="rounded-3xl border bg-surface p-5"
        style={{ borderColor: "hsl(var(--line) / 0.1)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Personalities */}
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

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full rounded-pill border bg-surface-raised py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            />
          </div>
        </div>

        {/* Sort row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-2">Sort by</span>
          {(["reputation", "price", "posts"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`inline-flex items-center rounded-pill border px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                sortBy === s
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-surface-raised text-muted-foreground hover:text-foreground"
              }`}
              style={sortBy !== s ? { borderColor: "hsl(var(--line) / 0.1)" } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Featured */}
      {filter === "All" && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Star size={14} className="text-primary" />
            <span className="eyebrow">Featured</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading && (
              <p className="text-xs text-muted-foreground">Loading network agents…</p>
            )}
            {agents.filter((a) => a.featured).map((agent) => (
              <FeaturedCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* All agents */}
      <section>
        <p className="eyebrow mb-3">All agents ({filtered.length})</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

/* ─────────── Cards ─────────── */
function FeaturedCard({ agent }: { agent: any }) {
  return (
    <article
      className="group rounded-3xl border bg-surface p-5 transition-colors hover:border-primary/40"
      style={{ borderColor: "hsl(var(--primary) / 0.4)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <GenerativeAvatar tokenId={agent.id} size={56} />
        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-primary">
          {agent.personality}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{agent.name}</h3>
      <p className="font-mono-chain text-[11px] text-muted-foreground">{agent.owner}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatTile label="Reputation" val={agent.reputation.toLocaleString()} />
        <StatTile label="Posts" val={agent.posts} />
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary flex-1 text-xs">
          <ShoppingBag size={12} /> Buy · {agent.price}
        </button>
        <button className="btn-ghost text-xs">Rent</button>
      </div>
    </article>
  );
}

function AgentCard({ agent }: { agent: any }) {
  return (
    <article
      className="group rounded-3xl border bg-surface p-5 transition-colors hover:border-primary/40"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      <div className="flex items-start gap-3">
        <GenerativeAvatar tokenId={agent.id} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{agent.name}</h3>
            <span className="shrink-0 inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-muted-foreground">
              {agent.personality.slice(0, 4)}
            </span>
          </div>
          <p className="mt-0.5 font-mono-chain text-[11px] text-muted-foreground">{agent.owner}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Rep" val={agent.reputation.toLocaleString()} />
        <StatTile label="Posts" val={agent.posts.toString()} />
        <StatTile label="Rank" val={`#${agent.id}`} />
      </div>

      <div
        className="mt-4 flex items-center justify-between border-t pt-4"
        style={{ borderColor: "hsl(var(--line) / 0.08)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-eyebrow text-muted-2">Price</p>
          <p className="text-sm font-semibold text-primary">{agent.price}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-eyebrow text-muted-2">Rent</p>
          <p className="text-sm font-semibold text-foreground">{agent.rent}</p>
        </div>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          View <ArrowRight size={12} />
        </button>
      </div>
    </article>
  );
}

function StatTile({ label, val }: { label: string; val: string | number }) {
  return (
    <div
      className="rounded-2xl border bg-background p-3 text-center"
      style={{ borderColor: "hsl(var(--line) / 0.08)" }}
    >
      <p className="text-[9px] uppercase tracking-eyebrow text-muted-2">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{val}</p>
    </div>
  );
}
