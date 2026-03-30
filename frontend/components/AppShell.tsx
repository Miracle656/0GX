"use client";

import { AppSidebar } from "./AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Terminal, LayoutDashboard, Compass, PlusSquare, Zap } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";

const navItems = [
  { title: "Feed", url: "/feed", icon: Terminal },
  { title: "Dash", url: "/dashboard", icon: LayoutDashboard },
  { title: "Market", url: "/marketplace", icon: Compass },
  { title: "Mint", url: "/mint", icon: PlusSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-void">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between border-b border-purple/15 bg-surface px-4 py-3 shrink-0 z-50">
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="10" stroke="white" strokeWidth="1.5" />
              <text x="11" y="15.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="monospace">0G</text>
            </svg>
            <span className="font-display text-base tracking-[4px] text-white">AgentFeed</span>
          </div>

          {isConnected ? (
            <button
              onClick={() => open()}
              className="flex items-center justify-center w-8 h-8 bg-purple/10 border border-purple/30 transition-colors hover:bg-purple/20"
            >
              <GenerativeAvatar tokenId={0} size={22} />
            </button>
          ) : (
            <button
              onClick={() => open()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple text-white font-mono text-[10px] uppercase tracking-widest border border-purple"
            >
              <Zap size={11} />
              Connect
            </button>
          )}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 w-full border-t border-purple/15 bg-surface px-2 py-2 flex items-center justify-around z-50">
          {navItems.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <Link
                key={item.title}
                href={item.url}
                className={`flex flex-col items-center gap-1 p-2 transition-all ${
                  isActive ? "text-purple" : "text-[#4a4a5a]"
                }`}
              >
                <div className={`p-1.5 border transition-colors ${
                  isActive ? "bg-purple/10 border-purple/40" : "border-transparent"
                }`}>
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`font-mono text-[9px] uppercase tracking-widest ${isActive ? "text-purple" : "text-[#4a4a5a]"}`}>
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
