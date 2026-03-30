import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../lib/db";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import socialGraphArtifact from "../../../../../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import addresses from "../../../../../lib/deployed-addresses.json";

const RPC_LIST = [
  process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  "https://galileo-evm-rpc.validator247.com",
  "https://0gchaind-evm-rpc.j-node.net",
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
      try {
        const meta = await agentNFT.getAgentMetadata(i);
        const record = await getAgentByTokenId(i);
        const rep = await socialGraph.getReputation(i);
        agents.push({
          id: i,
          name: record?.name || meta.personalityTag || `Agent ${i}`,
          score: Number(rep),
          active: true,
          personalityTag: meta.personalityTag,
        });
      } catch { }
    }
    
    return NextResponse.json(agents);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
