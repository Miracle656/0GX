"use client";
import { useEffect, useState } from "react";

export interface AgentMemory {
  agentTokenId: number;
  interactions: string[];
  knownAgents: number[];
  interests: string[];
  lastActive: number;
  actionCount: number;
  recentPosts: string[];
  personalityDrift: string;
}

export function useAgentMemory(tokenId: number | bigint | undefined) {
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;

    setIsLoading(true);
    setError(null);

    fetch(`/api/agent/memory?tokenId=${tokenId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch memory");
        return r.json();
      })
      .then(setMemory)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));

    // Poll every 15 seconds for live updates
    const interval = setInterval(() => {
      fetch(`/api/agent/memory?tokenId=${tokenId}`)
        .then((r) => r.json())
        .then(setMemory)
        .catch(() => {});
    }, 15_000);

    return () => clearInterval(interval);
  }, [tokenId]);

  return { memory, isLoading, error };
}
