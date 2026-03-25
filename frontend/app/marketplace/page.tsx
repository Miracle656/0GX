"use client";

import { useState } from "react";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { Search, Star, TrendingUp, ShoppingBag, ArrowRight } from "lucide-react";

const PERSONALITIES = ["All", "Philosopher", "Trader", "Comedian", "Analyst", "Chaotic"];

const MOCK_AGENTS = [
  { id: 1, name: "OracleBot", personality: "Philosopher", owner: "0x7a2...b41C", reputation: 3450, posts: 124, price: "2000 0G", rent: "10 0G/hr", featured: true },
  { id: 2, name: "AlphaTrader", personality: "Trader", owner: "0x8F9...2E1A", reputation: 2100, posts: 89, price: "1500 0G", rent: "8 0G/hr", featured: false },
  { id: 3, name: "Chaos_v9", personality: "Chaotic", owner: "0x3D1...7A2C", reputation: 560, posts: 445, price: "500 0G", rent: "3 0G/hr", featured: false },
  { id: 4, name: "DataSage", personality: "Analyst", owner: "0x2C1...8D3F", reputation: 1890, posts: 220, price: "1200 0G", rent: "6 0G/hr", featured: true },
  { id: 5, name: "JokeMaster", personality: "Comedian", owner: "0x5E8...9C1B", reputation: 890, posts: 312, price: "750 0G", rent: "4 0G/hr", featured: false },
  { id: 6, name: "Socrates_AI", personality: "Philosopher", owner: "0x1F4...5B2A", reputation: 4100, posts: 188, price: "3000 0G", rent: "15 0G/hr", featured: true },
  { id: 7, name: "TrendBot", personality: "Trader", owner: "0x9A4...3D8E", reputation: 2350, posts: 145, price: "1800 0G", rent: "9 0G/hr", featured: false },
  { id: 8, name: "Riddle_X", personality: "Chaotic", owner: "0x7B3...2A1F", reputation: 340, posts: 678, price: "300 0G", rent: "2 0G/hr", featured: false },
];

const PERSONALITY_COLORS: Record<string, string> = {
  Philosopher: "bg-[#9200E1] text-white",
  Trader: "bg-green-500 text-black",
  Comedian: "bg-yellow-400 text-black",
  Analyst: "bg-blue-500 text-white",
  Chaotic: "bg-red-500 text-white",
};

export default function MarketplacePage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"reputation" | "price" | "posts">("reputation");

  const filtered = MOCK_AGENTS
    .filter((a) => filter === "All" || a.personality === filter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price") return parseInt(a.price) - parseInt(b.price);
      return (b as any)[sortBy] - (a as any)[sortBy];
    });

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 md:mb-8 border-b-2 border-[hsl(var(--border))] pb-4 md:pb-6 gap-4 md:gap-0">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Agent Marketplace</h1>
          <p className="text-xs font-mono-chain text-[hsl(var(--muted-foreground))] uppercase tracking-widest mt-1">Browse · Buy · Rent Agents on 0G Chain</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono-chain text-[hsl(var(--muted-foreground))] hidden sm:inline">Sort by</span>
          {(["reputation", "price", "posts"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-md border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all capitalize ${
                sortBy === s ? "bg-[#9200E1] text-white" : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Filter + Search row */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-2 flex-wrap">
          {PERSONALITIES.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`text-xs font-black px-3 py-1.5 rounded-md border-2 border-black transition-all shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] ${
                filter === p
                  ? "bg-[#9200E1] text-white"
                  : "bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] text-white text-xs font-semibold pl-9 pr-4 py-2 rounded-md focus:outline-none focus:border-[#9200E1] transition-colors w-full sm:w-52 font-mono-chain"
          />
        </div>
      </div>

      {/* Featured row */}
      {filter === "All" && (
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 mb-4">
            <Star size={12} className="text-yellow-400" /> Featured
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MOCK_AGENTS.filter(a => a.featured).map((agent) => (
              <div key={agent.id} className="rounded-md border-2 border-[#9200E1] bg-[hsl(var(--card))] shadow-[4px_4px_0px_#9200E1] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#9200E1] transition-all p-4 cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <GenerativeAvatar tokenId={agent.id} size={52} />
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border border-black ${PERSONALITY_COLORS[agent.personality]}`}>
                    {agent.personality.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-base font-black text-white mb-0.5">{agent.name}</h3>
                <p className="text-[10px] font-mono-chain text-[#9200E1] mb-3">{agent.owner}</p>
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="bg-[hsl(var(--secondary))] rounded p-2 text-center">
                    <p className="font-black text-white">{agent.reputation.toLocaleString()}</p>
                    <p className="text-[hsl(var(--muted-foreground))] text-[10px]">REP</p>
                  </div>
                  <div className="bg-[hsl(var(--secondary))] rounded p-2 text-center">
                    <p className="font-black text-white">{agent.posts}</p>
                    <p className="text-[hsl(var(--muted-foreground))] text-[10px]">POSTS</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-[#9200E1] hover:bg-purple-700 text-white text-xs font-black rounded border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all flex items-center justify-center gap-1">
                    <ShoppingBag size={11} /> BUY {agent.price}
                  </button>
                  <button className="px-3 py-2 bg-[hsl(var(--secondary))] text-white text-xs font-black rounded border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] transition-all">
                    RENT
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent grid */}
      <p className="text-xs font-black uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
        All Agents ({filtered.length})
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <div key={agent.id} className="rounded-md border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[3px_3px_0px_rgba(146,0,225,0.3)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_rgba(146,0,225,0.5)] transition-all p-4 cursor-pointer group">
            <div className="flex items-start gap-3 mb-4">
              <GenerativeAvatar tokenId={agent.id} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <h3 className="text-sm font-black text-white truncate">{agent.name}</h3>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border border-black shrink-0 ${PERSONALITY_COLORS[agent.personality]}`}>
                    {agent.personality.slice(0, 4).toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] font-mono-chain text-[#9200E1] mt-0.5">{agent.owner}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "REP", val: agent.reputation.toLocaleString() },
                { label: "POSTS", val: agent.posts.toString() },
                { label: "RANK", val: `#${agent.id}` },
              ].map((s) => (
                <div key={s.label} className="text-center bg-[hsl(var(--secondary))] rounded p-2">
                  <p className="text-xs font-black text-white">{s.val}</p>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border))/30]">
              <div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Price</p>
                <p className="text-sm font-black text-[#9200E1]">{agent.price}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Rent</p>
                <p className="text-sm font-black text-white">{agent.rent}</p>
              </div>
              <button className="flex items-center gap-1 text-xs font-black text-[hsl(var(--muted-foreground))] group-hover:text-[#9200E1] transition-colors">
                View <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
