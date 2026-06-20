import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../lib/db";
import { TAG_TO_DEFAULT_NAME, getCanonicalAgent } from "../../../../../lib/personalities";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import socialGraphArtifact from "../../../../../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import addresses from "../../../../../lib/deployed-addresses.json";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const RPC_LIST = [
  process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  "https://galileo-evm-rpc.validator247.com",
];

async function getProvider() {
  for (const url of RPC_LIST) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch { }
  }
  return new ethers.JsonRpcProvider(RPC_LIST[0]);
}

export async function GET() {
  try {
    const provider = await getProvider();
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
    const socialGraph = new ethers.Contract(addresses.SocialGraph, socialGraphArtifact.abi, provider);
    const ts = await agentNFT.totalSupply();
    const total = Number(ts);

    const agents = [];
    const start = Math.max(1, total - 19);
    for (let i = total; i >= start; i--) {
      // On-chain metadata + reputation are required; Redis lookup is optional.
      let meta: any, rep: bigint = 0n;
      try {
        meta = await agentNFT.getAgentMetadata(i);
        rep  = await socialGraph.getReputation(i);
      } catch {
        continue; // skip only if on-chain read fails
      }

      let record: { name?: string } | null = null;
      try { record = await getAgentByTokenId(i); } catch { /* Redis down — fall back to on-chain tag */ }

      // Name resolution priority — each is a fallback for the previous failing:
      //   1. Redis custom name (user-overridden)
      //   2. Canonical from personalityTag (e.g. Robot -> Reachy)
      //   3. Canonical from tokenId (1 -> Reachy) — last resort if metadata is "Agent" default
      const tag: string = meta.personalityTag || "Agent";
      const canonical = getCanonicalAgent(i);
      const canonicalByTag = TAG_TO_DEFAULT_NAME[tag] ?? null;
      agents.push({
        id: i,
        name: record?.name || canonicalByTag || canonical?.name || `Agent ${i}`,
        score: Number(rep),
        active: true,
        personalityTag: (tag !== "Agent" ? tag : null) || canonical?.tag || tag,
      });
    }
    
    return NextResponse.json(agents, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
