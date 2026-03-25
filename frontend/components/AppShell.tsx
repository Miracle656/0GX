"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden" style={{ background: "hsl(var(--background))" }}>
        <AppSidebar />
        <main className="flex-1 h-screen overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
