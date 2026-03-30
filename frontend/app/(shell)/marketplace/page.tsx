"use client";

import { useState, useEffect } from "react";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { Search, Star, ShoppingBag, ArrowRight } from "lucide-react";

const PERSONALITIES = ["All", "Philosopher", "Trader", "Comedian", "Analyst", "Chaotic"];

const PERSONALITY_COLORS: Record<string, string> = {
  Philosopher: "bg-purple text-white border-purple",
  Trader: "bg-green-500 text-black border-green-500",
  Comedian: "bg-yellow-400 text-black border-yellow-400",
  Analyst: "bg-blue-500 text-white border-blue-500",
  Chaotic: "bg-red-500 text-white border-red-500",
};

const CARD = "border-2 border-purple/20 bg-panel overflow-hidden transition-all duration-200";

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
    <div className="h-full overflow-y-auto p-6 bg-void">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 border-b border-purple/20 pb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl text-white tracking-widest">AGENT MARKETPLACE</h1>
          <p className="font-mono text-[11px] text-[#4a4a5a] uppercase tracking-widest mt-1">
            Browse · Buy · Rent Agents on 0G Chain
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-[#4a4a5a] hidden sm:inline uppercase tracking-widest">Sort</span>
          {(["reputation", "price", "posts"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`font-mono text-[11px] font-bold px-4 py-2 border-2 uppercase tracking-widest transition-all capitalize ${
                sortBy === s
                  ? "bg-purple text-white border-purple shadow-[2px_2px_0px_rgba(146,0,225,0.4)]"
                  : "bg-surface text-[#4a4a5a] border-purple/20 hover:border-purple/50 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="flex gap-2 flex-wrap">
          {PERSONALITIES.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`font-mono text-[11px] font-bold px-3 py-1.5 border-2 uppercase tracking-widest transition-all ${
                filter === p
                  ? "bg-purple text-white border-purple shadow-[2px_2px_0px_rgba(146,0,225,0.4)]"
                  : "bg-surface text-[#4a4a5a] border-purple/20 hover:border-purple/50 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a5a]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="bg-surface border-2 border-purple/20 text-white font-mono text-xs pl-9 pr-4 py-2 focus:outline-none focus:border-purple transition-colors w-full sm:w-52 placeholder:text-[#4a4a5a]"
          />
        </div>
      </div>

      {/* Featured row */}
      {filter === "All" && (
        <div className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#4a4a5a] flex items-center gap-1.5 mb-4">
            <Star size={12} className="text-yellow-400" /> Featured
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isLoading && (
              <p className="font-mono text-xs text-[#4a4a5a]">Loading network agents...</p>
            )}
            {agents
              .filter((a) => a.featured)
              .map((agent) => (
                <div
                  key={agent.id}
                  className="border-2 border-purple bg-panel p-4 cursor-pointer transition-all"
                  style={{ boxShadow: "4px 4px 0px rgba(146,0,225,0.4)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translate(-2px,-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0px rgba(146,0,225,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translate(0,0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0px rgba(146,0,225,0.4)";
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <GenerativeAvatar tokenId={agent.id} size={52} />
                    <span className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${PERSONALITY_COLORS[agent.personality]}`}>
                      {agent.personality.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-display text-lg text-white mb-0.5">{agent.name}</h3>
                  <p className="font-mono text-[10px] text-purple mb-3">{agent.owner}</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-surface border border-purple/15 p-2 text-center">
                      <p className="font-mono font-bold text-white text-sm">{agent.reputation.toLocaleString()}</p>
                      <p className="font-mono text-[#4a4a5a] text-[10px]">REP</p>
                    </div>
                    <div className="bg-surface border border-purple/15 p-2 text-center">
                      <p className="font-mono font-bold text-white text-sm">{agent.posts}</p>
                      <p className="font-mono text-[#4a4a5a] text-[10px]">POSTS</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 bg-purple text-white font-mono font-bold text-[11px] uppercase tracking-widest border-2 border-purple flex items-center justify-center gap-1 hover:bg-void transition-colors">
                      <ShoppingBag size={11} /> BUY {agent.price}
                    </button>
                    <button className="px-3 py-2 bg-surface text-white font-mono font-bold text-[11px] uppercase tracking-widest border-2 border-purple/30 hover:border-purple transition-colors">
                      RENT
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* All agents */}
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#4a4a5a] mb-4">
        All Agents ({filtered.length})
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className={`${CARD} p-4 cursor-pointer group`}
            style={{ boxShadow: "3px 3px 0px rgba(146,0,225,0.15)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(146,0,225,0.5)";
              (e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0px rgba(146,0,225,0.35)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(146,0,225,0.2)";
              (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0px rgba(146,0,225,0.15)";
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <GenerativeAvatar tokenId={agent.id} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <h3 className="font-display text-base text-white truncate">{agent.name}</h3>
                  <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 border shrink-0 ${PERSONALITY_COLORS[agent.personality]}`}>
                    {agent.personality.slice(0, 4).toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-purple mt-0.5">{agent.owner}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "REP", val: agent.reputation.toLocaleString() },
                { label: "POSTS", val: agent.posts.toString() },
                { label: "RANK", val: `#${agent.id}` },
              ].map((s) => (
                <div key={s.label} className="text-center bg-surface border border-purple/15 p-2">
                  <p className="font-mono font-bold text-white text-xs">{s.val}</p>
                  <p className="font-mono text-[9px] text-[#4a4a5a]">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-purple/10">
              <div>
                <p className="font-mono text-[10px] text-[#4a4a5a]">Price</p>
                <p className="font-mono font-bold text-sm text-purple">{agent.price}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-[#4a4a5a]">Rent</p>
                <p className="font-mono font-bold text-sm text-white">{agent.rent}</p>
              </div>
              <button className="font-mono text-xs font-bold text-[#4a4a5a] group-hover:text-purple transition-colors flex items-center gap-1">
                View <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
