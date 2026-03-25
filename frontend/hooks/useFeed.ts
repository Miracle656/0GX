"use client";
import { useReadContract } from "wagmi";
import { useState, useEffect, useCallback } from "react";
import { CONTRACT_ADDRESSES, POST_REGISTRY_ABI, AGENT_NFT_ABI } from "@/lib/contracts";

export interface FeedPost {
  postId: bigint;
  agentTokenId: bigint;
  storageRootHash: string;
  parentPostId: bigint;
  author: string;
  timestamp: bigint;
  tipTotal: bigint;
  upvotes: bigint;
  fires: bigint;
  downvotes: bigint;
  personalityTag?: string;
  content?: string;
}

const POSTS_PER_PAGE = 20;

export function useFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: totalPosts } = useReadContract({
    address: CONTRACT_ADDRESSES.PostRegistry,
    abi: POST_REGISTRY_ABI,
    functionName: "getTotalPosts",
  });

  const fetchPosts = useCallback(async (total: bigint) => {
    if (total === 0n) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    if (posts.length === 0) {
      setIsLoading(true);
    }
    
    try {
      // Build IDs array: most recent N posts (IDs are 1-indexed)
      const count = Number(total < BigInt(POSTS_PER_PAGE) ? total : BigInt(POSTS_PER_PAGE));
      const ids: bigint[] = [];
      for (let i = Number(total); i > Number(total) - count; i--) {
        ids.push(BigInt(i));
      }

      const res = await fetch(`/api/feed?ids=${ids.join(",")}`);
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      const data = await res.json();

      // Convert string fields back to bigint for the UI
      const parsed: FeedPost[] = data.map((p: Record<string, string>) => ({
        postId: BigInt(p.postId),
        agentTokenId: BigInt(p.agentTokenId),
        storageRootHash: p.storageRootHash,
        parentPostId: BigInt(p.parentPostId),
        author: p.author,
        timestamp: BigInt(p.timestamp),
        tipTotal: BigInt(p.tipTotal),
        upvotes: BigInt(p.upvotes),
        fires: BigInt(p.fires),
        downvotes: BigInt(p.downvotes),
      }));

      setPosts(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (totalPosts !== undefined) {
      fetchPosts(totalPosts as bigint);
    }
  }, [totalPosts, fetchPosts]);

  const refresh = useCallback(() => {
    if (totalPosts !== undefined) fetchPosts(totalPosts as bigint);
  }, [totalPosts, fetchPosts]);

  return { posts, isLoading, error, totalPosts: totalPosts ?? 0n, refresh };
}

export function useAgentFeed(agentTokenId: bigint | undefined) {
  const { data: postIds } = useReadContract({
    address: CONTRACT_ADDRESSES.PostRegistry,
    abi: POST_REGISTRY_ABI,
    functionName: "getAgentPosts",
    args: agentTokenId ? [agentTokenId] : undefined,
    query: { enabled: !!agentTokenId },
  });

  return { postIds: postIds ?? [] };
}

export function useReputation(agentTokenId: bigint | undefined) {
  const { data: reputation } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph,
    abi: [
      "function getReputation(uint256 agentId) view returns (uint256)",
    ] as const,
    functionName: "getReputation",
    args: agentTokenId ? [agentTokenId] : undefined,
    query: { enabled: !!agentTokenId },
  });

  const { data: followerCount } = useReadContract({
    address: CONTRACT_ADDRESSES.SocialGraph,
    abi: [
      "function getFollowerCount(uint256 agentId) view returns (uint256)",
    ] as const,
    functionName: "getFollowerCount",
    args: agentTokenId ? [agentTokenId] : undefined,
    query: { enabled: !!agentTokenId },
  });

  return {
    reputation: reputation ?? 0n,
    followerCount: followerCount ?? 0n,
  };
}
