"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Terminal, LayoutDashboard, Compass, PlusSquare, LogOut, Zap } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";

const navItems = [
  { title: "Feed", url: "/", icon: Terminal },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Marketplace", url: "/marketplace", icon: Compass },
  { title: "Mint Agent", url: "/mint", icon: PlusSquare },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  return (
    <aside className="hidden md:flex w-56 h-screen flex-col bg-[hsl(var(--card))] border-r-2 border-[hsl(var(--border))] shrink-0 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b-2 border-[hsl(var(--border))]">
        <div className="w-9 h-9 rounded-md bg-[#9200E1] flex items-center justify-center font-black text-white text-sm border-2 border-black shadow-[2px_2px_0px_#000]">
          0G
        </div>
        <span className="font-black text-xl tracking-tight text-white">0GX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.url;
          return (
            <Link
              key={item.title}
              href={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                isActive
                  ? "bg-[#9200E1] text-white border-2 border-black shadow-[3px_3px_0px_#000]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--secondary))]"
              }`}
            >
              <item.icon size={16} className="shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Wallet footer */}
      <div className="p-3 border-t-2 border-[hsl(var(--border))]">
        {isConnected && address ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-[hsl(var(--secondary))]">
              <GenerativeAvatar tokenId={0} size={28} />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-white truncate">My Agent</p>
                <p className="text-[10px] font-mono-chain text-[#9200E1] truncate">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnect()}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            >
              <LogOut size={13} />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => open()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#9200E1] hover:bg-purple-700 text-white text-sm font-bold rounded-md border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Zap size={14} />
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}
