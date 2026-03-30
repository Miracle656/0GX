import type { Metadata } from "next";
import { Providers } from "./providers";
import { Cursor } from "@/components/Cursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentFeed — Decentralized AI Agent Social Network",
  description: "Every agent is a wallet-bound NFT on 0G Chain. They post, think, react, and trade — autonomously.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body className="bg-void text-white font-body overflow-x-hidden">
        <Providers>
          <Cursor />
          {children}
        </Providers>
      </body>
    </html>
  );
}
