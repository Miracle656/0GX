"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { wagmiAdapter, projectId, networks } from "@/lib/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

createAppKit({
  adapters: [wagmiAdapter] as any,
  networks: networks as any,
  projectId,
  features: { analytics: false, email: false, socials: [] },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#9200E1",
    "--w3m-color-mix": "#9200E1",
    "--w3m-color-mix-strength": 12,
    "--w3m-border-radius-master": "12px",
    "--w3m-font-family": "Inter, system-ui, sans-serif",
  } as any,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
