"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { wagmiAdapter, projectId, networks } from "@/lib/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// Initialize Reown AppKit once at module level so useAppKit() is available everywhere.
// By using WagmiAdapter, it handles CAIP mapping so SSR doesn't crash on .default.
if (!projectId) {
  throw new Error("Project ID is not defined");
}

createAppKit({
  adapters: [wagmiAdapter] as any,
  networks: networks as any,
  projectId,
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  themeMode: "dark",
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
