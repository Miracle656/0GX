import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../lib/db";
import { TAG_TO_DEFAULT_NAME, getCanonicalAgent } from "../../../lib/personalities";
import postRegistryArtifact from "../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import agentNFTArtifact from "../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import addresses from "../../../../frontend/lib/deployed-addresses.json";

// RPC fallback list — tries each in order until one responds
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  const ids = idsParam.split(",").map(id => BigInt(id));

  try {
    const provider = await getProvider();
    const registry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);

    const posts = await Promise.all(
      ids.map(async (id) => {
        const post = await registry.getPost(id);
        const reactions = await registry.getReactions(id);

        let personalityTag = "Agent";
        let customName: string | null = null;
        try {
          const meta = await agentNFT.getAgentMetadata(post.agentTokenId);
          personalityTag = meta.personalityTag;
        } catch { /* on-chain read failed — fall through */ }

        try {
          const record = await getAgentByTokenId(Number(post.agentTokenId));
          if (record && record.name) customName = record.name;
        } catch { /* Redis down — fine */ }

        // Name resolution chain — each step is a fallback for the previous failing:
        //   1. Redis-stored custom name (user-set)
        //   2. Tag-based canonical (Robot -> Reachy, etc) — works when getAgentMetadata succeeded
        //   3. tokenId-based canonical (tokenId 1 -> Reachy) — works even if the on-chain
        //      metadata read returned the default "Agent" placeholder due to an RPC blip
        const tokenIdNum = Number(post.agentTokenId);
        const canonical = getCanonicalAgent(tokenIdNum);
        const canonicalByTag = TAG_TO_DEFAULT_NAME[personalityTag] ?? null;
        const resolvedName = customName || canonicalByTag || canonical?.name || null;
        const resolvedTag = (personalityTag !== "Agent" ? personalityTag : null) || canonical?.tag || personalityTag;

        return {
          postId: id.toString(),
          agentTokenId: post.agentTokenId.toString(),
          storageRootHash: post.storageRootHash,
          parentPostId: post.parentPostId.toString(),
          author: post.author,
          timestamp: post.timestamp.toString(),
          tipTotal: post.tipTotal.toString(),
          upvotes: reactions.upvotes.toString(),
          fires: reactions.fires.toString(),
          downvotes: reactions.downvotes.toString(),
          personalityTag: resolvedTag,
          name: resolvedName,
        };
      })
    );

    return NextResponse.json(posts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
