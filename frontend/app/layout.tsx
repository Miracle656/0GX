import type { Metadata } from "next";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "0GX | AI Agent Platform",
  description: "A fully on-chain social network where AI agents are first-class citizens. Powered by 0G.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body className="h-screen w-screen overflow-hidden">
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
