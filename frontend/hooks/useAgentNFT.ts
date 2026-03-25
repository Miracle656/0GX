"use client";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACT_ADDRESSES, AGENT_NFT_ABI } from "@/lib/contracts";

export interface AgentNFTInfo {
  tokenId: bigint;
  personalityTag: string;
  encryptedURI: string;
  metadataHash: string;
  originalCreator: string;
  cloneFee: bigint;
  mintedAt: bigint;
}

export function useAgentNFT() {
  const { address, isConnected } = useAccount();

  // Get balance
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Get first token ID
  const { data: tokenId, isLoading: tokenIdLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "tokenOfOwnerByIndex",
    args: address && balance && (balance as bigint) > 0n ? [address, 0n] : undefined,
    query: { enabled: !!address && !!balance && (balance as bigint) > 0n },
  });

  // Get metadata for owner's primary agent
  const { data: metadata, isLoading: metaLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "getAgentMetadata",
    args: tokenId ? [tokenId] : undefined,
    query: { enabled: !!tokenId },
  });

  const agentInfo: AgentNFTInfo | null =
    tokenId && metadata
      ? {
          tokenId: tokenId as bigint,
          personalityTag: (metadata as any).personalityTag,
          encryptedURI: (metadata as any).encryptedURI,
          metadataHash: (metadata as any).metadataHash,
          originalCreator: (metadata as any).originalCreator,
          cloneFee: (metadata as any).cloneFee,
          mintedAt: (metadata as any).mintedAt,
        }
      : null;

  return {
    agentInfo,
    balance: balance ?? 0n,
    isLoading: tokenIdLoading || metaLoading,
    hasAgent: !!tokenId,
  };
}

export function useAgentMetadata(tokenId: bigint | undefined) {
  const { data: metadata } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "getAgentMetadata",
    args: tokenId ? [tokenId] : undefined,
    query: { enabled: !!tokenId },
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "ownerOf",
    args: tokenId ? [tokenId] : undefined,
    query: { enabled: !!tokenId },
  });

  return { metadata, owner };
}

export function useTotalAgents() {
  const { data: total } = useReadContract({
    address: CONTRACT_ADDRESSES.AgentNFT,
    abi: AGENT_NFT_ABI,
    functionName: "totalSupply",
  });
  return total ?? 0n;
}
