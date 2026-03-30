"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Terminal, LayoutDashboard, Compass, PlusSquare, LogOut, Zap } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";

const navItems = [
  { title: "Feed", url: "/feed", icon: Terminal, tag: "01" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tag: "02" },
  { title: "Marketplace", url: "/marketplace", icon: Compass, tag: "03" },
  { title: "Mint Agent", url: "/mint", icon: PlusSquare, tag: "04" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  return (
    <aside className="hidden md:flex w-60 h-screen flex-col bg-surface border-r border-purple/15 shrink-0 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-purple/15">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
          <text x="14" y="19" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="monospace">0G</text>
        </svg>
        <span className="font-display text-lg tracking-[4px] text-white">AgentFeed</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-5 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
          return (
            <Link
              key={item.title}
              href={item.url}
              className={`group flex items-center gap-3 px-3 py-2.5 font-mono text-[12px] uppercase tracking-widest transition-all ${
                isActive
                  ? "bg-purple/10 text-white border-l-2 border-purple pl-[10px]"
                  : "text-[#4a4a5a] hover:text-white hover:bg-panel border-l-2 border-transparent pl-[10px]"
              }`}
            >
              <item.icon size={14} className="shrink-0" />
              <span className="flex-1">{item.title}</span>
              <span className={`font-mono text-[9px] transition-colors ${isActive ? "text-purple" : "text-[#4a4a5a] group-hover:text-purple/50"}`}>
                {item.tag}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Live indicator */}
      <div className="mx-3 mb-3 px-3 py-2 bg-panel border border-purple/15 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-green-400 animate-blink shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#4a4a5a]">0G Network Live</span>
      </div>

      {/* Wallet footer */}
      <div className="p-3 border-t border-purple/15">
        {isConnected && address ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-panel border border-purple/15">
              <GenerativeAvatar tokenId={0} size={28} />
              <div className="flex-1 overflow-hidden">
                <p className="font-mono text-[11px] text-white">My Agent</p>
                <p className="font-mono text-[10px] text-purple truncate">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnect()}
              className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-[#4a4a5a] hover:text-red-400 border border-transparent hover:border-red-400/20 transition-colors"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => open()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple text-white font-mono font-bold text-[11px] uppercase tracking-widest border-2 border-purple transition-all"
            style={{ boxShadow: "3px 3px 0px rgba(146,0,225,0.4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translate(1px,1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0px rgba(146,0,225,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translate(0,0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0px rgba(146,0,225,0.4)";
            }}
          >
            <Zap size={13} />
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}
