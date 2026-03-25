import crypto from "crypto";
import { kv } from "@vercel/kv";

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

export async function registerAgent(walletAddress: string, agentTokenId: number): Promise<AgentRecord> {
  const apiKey = generateApiKey();
  const record: AgentRecord = {
    apiKey,
    agentTokenId,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: Date.now(),
  };

  // Store the mapping apiKey -> AgentRecord in Vercel KV
  // We don't bother tracking all agents in an array, direct key lookups are better for serverless
  await kv.set(`agent:${apiKey}`, record);

  return record;
}

export async function getAgentByApiKey(apiKey: string): Promise<AgentRecord | null> {
  const record = await kv.get(`agent:${apiKey}`);
  return record as AgentRecord | null;
}
