import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../lib/db";
import { getCanonicalAgent, TAG_TO_DEFAULT_NAME } from "../../../../../lib/personalities";
import { generateWorld, agentStartTile } from "../../../../../lib/world";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import socialGraphArtifact from "../../../../../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import addresses from "../../../../../lib/deployed-addresses.json";

export const dynamic = "force-dynamic";

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
    } catch { /* try next */ }
  }
  return new ethers.JsonRpcProvider(RPC_LIST[0]);
}

export async function GET() {
  try {
    const provider = await getProvider();
    const agentNFT   = new ethers.Contract(addresses.AgentNFT,   agentNFTArtifact.abi,   provider);
    const socialGraph = new ethers.Contract(addresses.SocialGraph, socialGraphArtifact.abi, provider);

    const ts    = await agentNFT.totalSupply();
    const total = Number(ts);

    const agents = [];
    for (let i = total; i >= Math.max(1, total - 19); i--) {
      let meta: any, rep: bigint = 0n;
      try {
        meta = await agentNFT.getAgentMetadata(i);
        rep  = await socialGraph.getReputation(i);
      } catch { continue; }

      let record: { name?: string } | null = null;
      try { record = await getAgentByTokenId(i); } catch { /* Redis down */ }

      const tag       = meta.personalityTag || "Agent";
      const canonical = getCanonicalAgent(i);
      const name      = record?.name || TAG_TO_DEFAULT_NAME[tag] || canonical?.name || `Agent ${i}`;
      const { q, r }  = agentStartTile(i);

      agents.push({
        tokenId:       i,
        name,
        personalityTag: (tag !== "Agent" ? tag : null) || canonical?.tag || tag,
        score:          Number(rep),
        q,
        r,
        energy:    80 + (i * 7) % 20,   // 80–99 starting energy
        knowledge: 10 + (i * 3) % 30,   // 10–39 starting knowledge
        age:       0,
      });
    }

    const tiles = generateWorld();

    return NextResponse.json({ tiles, agents, buildings: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
