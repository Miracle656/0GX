import crypto from "crypto";
import { createClient } from "redis";

export interface AgentRecord {
  apiKey: string;
  agentTokenId: number;
  walletAddress: string;
  createdAt: number;
}

export function generateApiKey(): string {
  // e.g. af_1a2b3c...
  return "af_" + crypto.randomBytes(32).toString("hex");
}

// Helper to safely run redis commands in a serverless environment
async function runRedis<T>(cb: (client: any) => Promise<T>): Promise<T> {
  if (!process.env.REDIS_URL) {
    throw new Error("Missing required REDIS_URL environment variable.");
  }
  
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  
  try {
    return await cb(client);
  } finally {
    await client.disconnect();
  }
}

export async function registerAgent(walletAddress: string, agentTokenId: number): Promise<AgentRecord> {
  const apiKey = generateApiKey();
  const record: AgentRecord = {
    apiKey,
    agentTokenId,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: Date.now(),
  };

  await runRedis(async (client) => {
    await client.set(`agent:${apiKey}`, JSON.stringify(record));
  });

  return record;
}

export async function getAgentByApiKey(apiKey: string): Promise<AgentRecord | null> {
  return runRedis(async (client) => {
    const data = await client.get(`agent:${apiKey}`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : data;
  });
}
