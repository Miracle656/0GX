import { ethers } from "ethers";
import { KvClient, Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const OG_KV_NODE_URL = process.env.OG_KV_NODE_URL || "http://3.101.147.150:6789";
// Flow contract address for KV batching on testnet
const FLOW_CONTRACT = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";

// The KV stream ID for AgentFeed (deterministic, shared across all agents)
export const AGENTFEED_STREAM_ID =
  "0x000000000000000000000000000000000000000000000000000000000000f33d";

export interface AgentMemory {
  agentTokenId: number;
  interactions: string[];           // Summary of recent actions
  knownAgents: number[];            // Agent tokenIds interacted with
  interests: string[];              // Topics the agent gravitates toward
  lastActive: number;               // Unix timestamp
  actionCount: number;
  recentPosts: string[];            // Root hashes of recent posts
  personalityDrift: string;         // How personality has evolved
}

function getDefaultMemory(agentTokenId: number): AgentMemory {
  return {
    agentTokenId,
    interactions: [],
    knownAgents: [],
    interests: [],
    lastActive: Date.now(),
    actionCount: 0,
    recentPosts: [],
    personalityDrift: "stable",
  };
}

import { createClient } from "redis";

// Helper to safely run redis commands in the standard node process
async function runRedis<T>(cb: (client: any) => Promise<T>): Promise<T> {
  const url = process.env.REDIS_URL || process.env.KV_REST_API_URL;
  if (!url) {
    throw new Error("Missing required REDIS_URL environment variable.");
  }
  
  const client = createClient({ url });
  await client.connect();
  
  try {
    return await cb(client);
  } finally {
    await client.disconnect();
  }
}

/**
 * Read agent memory from Redis cache
 */
export async function getMemory(agentTokenId: number): Promise<AgentMemory> {
  try {
    return await runRedis(async (client) => {
      const data = await client.get(`agent:${agentTokenId}:memory`);
      if (!data) return getDefaultMemory(agentTokenId);
      return typeof data === "string" ? JSON.parse(data) : data;
    });
  } catch (e) {
    console.warn(`getMemory(${agentTokenId}) failed, using default:`, (e as Error).message);
    return getDefaultMemory(agentTokenId);
  }
}

/**
 * Write agent memory to Redis cache
 */
export async function setMemory(agentTokenId: number, memory: AgentMemory): Promise<void> {
  try {
    await runRedis(async (client) => {
      await client.set(`agent:${agentTokenId}:memory`, JSON.stringify(memory));
    });
  } catch (e) {
    console.warn(`setMemory(${agentTokenId}) failed (non-critical):`, (e as Error).message);
  }
}

/**
 * Update memory after an agent action
 */
export async function updateMemoryAfterAction(
  agentTokenId: number,
  action: { type: string; content?: string; targetId?: string | number; reasoning?: string },
  previousMemory: AgentMemory,
  postRootHash?: string
): Promise<AgentMemory> {
  const updated = { ...previousMemory };

  updated.actionCount++;
  updated.lastActive = Date.now();

  // Record interaction summary
  const summary = `[${new Date().toISOString()}] ${action.type}${action.targetId ? ` → target:${action.targetId}` : ""}: ${action.reasoning || ""}`;
  updated.interactions = [summary, ...updated.interactions].slice(0, 50); // keep last 50

  // Track known agents
  if (action.targetId && typeof action.targetId === "number") {
    if (!updated.knownAgents.includes(action.targetId)) {
      updated.knownAgents = [action.targetId, ...updated.knownAgents].slice(0, 100);
    }
  }

  // Track posts
  if (postRootHash) {
    updated.recentPosts = [postRootHash, ...updated.recentPosts].slice(0, 20);
  }

  await setMemory(agentTokenId, updated);
  return updated;
}
