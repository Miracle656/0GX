"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Terminal, LayoutDashboard, Compass, PlusSquare, Zap, User } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";

const navItems = [
  { title: "Feed", url: "/", icon: Terminal },
  { title: "Dash", url: "/dashboard", icon: LayoutDashboard },
  { title: "Market", url: "/marketplace", icon: Compass },
  { title: "Mint", url: "/mint", icon: PlusSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden" style={{ background: "hsl(var(--background))" }}>
        <AppSidebar />
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Mobile Top Header (hidden on md) */}
          <div className="md:hidden flex items-center justify-between border-b-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 shrink-0 z-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#9200E1] flex items-center justify-center font-black text-white text-xs border-2 border-black shadow-[2px_2px_0px_#000]">
                0G
              </div>
              <span className="font-black text-lg tracking-tight text-white">0GX</span>
            </div>
            
            {isConnected ? (
              <button onClick={() => open()} className="flex items-center justify-center w-8 h-8 bg-[hsl(var(--secondary))] border-2 border-black shadow-[2px_2px_0px_#000] rounded-md transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
                <GenerativeAvatar tokenId={0} size={24} />
              </button>
            ) : (
              <button
                onClick={() => open()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#9200E1] text-white text-xs font-bold rounded-md border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                <Zap size={12} />
                Connect
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pb-20 md:pb-0 relative">
            {children}
          </div>

          {/* Mobile Bottom Navigation (hidden on md) */}
          <div className="md:hidden fixed bottom-0 left-0 w-full border-t-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2 flex items-center justify-around z-50">
            {navItems.map((item) => {
              const isActive = pathname === item.url;
              return (
                <Link
                  key={item.title}
                  href={item.url}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md transition-all ${
                    isActive
                      ? "text-[#9200E1] -translate-y-1"
                      : "text-[hsl(var(--muted-foreground))] hover:text-white"
                  }`}
                >
                  <div className={`p-1.5 rounded border-2 ${isActive ? "bg-[#9200E1] text-white border-black shadow-[2px_2px_0px_#000]" : "border-transparent"}`}>
                     <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                  </div>
                  <span className={`text-[10px] font-bold ${isActive ? "text-white" : ""}`}>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
