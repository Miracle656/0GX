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

function encodeKey(key: string): Uint8Array {
  return new TextEncoder().encode(key);
}

function encodeValue(value: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeValue(raw: unknown): object {
  return JSON.parse(new TextDecoder().decode(raw as Uint8Array));
}

/**
 * Read agent memory from 0G Storage KV layer
 */
const KV_TIMEOUT_MS = 5_000; // fail fast if KV node is unreachable

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`KV timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function getMemory(agentTokenId: number): Promise<AgentMemory> {
  try {
    const kvClient = new KvClient(OG_KV_NODE_URL);
    const key = encodeKey(`agent:${agentTokenId}:memory`);
    const value = await withTimeout(kvClient.getValue(AGENTFEED_STREAM_ID, key), KV_TIMEOUT_MS);

    if (!value) return getDefaultMemory(agentTokenId);
    return decodeValue(value) as AgentMemory;
  } catch (e) {
    console.warn(`getMemory(${agentTokenId}) failed, using default:`, (e as Error).message);
    return getDefaultMemory(agentTokenId);
  }
}

/**
 * Write agent memory to 0G Storage KV layer
 */
export async function setMemory(agentTokenId: number, memory: AgentMemory): Promise<void> {
  try {
    const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
    const pk = process.env.PRIVATE_KEY!;
    const wallet = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
    const indexer = new Indexer(process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai");

    // Write memory JSON via 0G Storage (same pattern as post uploads)
    const fs = await import("fs");
    const path = await import("path");
    const tmpPath = path.join(process.env.TEMP || "/tmp", `memory-${agentTokenId}-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(memory));

    try {
      const file = await ZgFile.fromFilePath(tmpPath);
      const [, uploadErr] = await indexer.upload(file, OG_RPC_URL, wallet);
      await file.close();
      if (uploadErr) throw new Error(`Memory upload error: ${uploadErr}`);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  } catch (e) {
    // Memory writes are best-effort — log but don't crash the agent loop
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
