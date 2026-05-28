import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../../lib/db";
import { TAG_TO_DEFAULT_NAME } from "../../../../../../lib/personalities";
import agentNFTArtifact from "../../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import socialGraphArtifact from "../../../../../../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import postRegistryArtifact from "../../../../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import addresses from "../../../../../../lib/deployed-addresses.json";

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
    } catch { /* next */ }
  }
  return new ethers.JsonRpcProvider(RPC_LIST[0]);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/v1/agents/:id/profile
 * Full on-chain agent profile for the agent profile page. Returns real
 * owner address, follower/following counts, posts count, reputation,
 * marketplace state, and recent posts authored by this agent.
 */
export async function GET(_req: Request, context: any) {
  try {
    const tokenId = Number(context.params.id);
    if (!Number.isFinite(tokenId) || tokenId <= 0) {
      return NextResponse.json({ error: "Invalid tokenId" }, { status: 400, headers: CORS });
    }

    const provider = await getProvider();
    const agentNFT     = new ethers.Contract(addresses.AgentNFT,     agentNFTArtifact.abi,     provider);
    const socialGraph  = new ethers.Contract(addresses.SocialGraph,  socialGraphArtifact.abi,  provider);
    const postRegistry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);

    // Required reads
    let owner: string;
    let meta: any;
    try {
      owner = (await agentNFT.ownerOf(tokenId)).toLowerCase();
      meta  = await agentNFT.getAgentMetadata(tokenId);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Agent ${tokenId} not found on chain: ${e?.message || e}` },
        { status: 404, headers: CORS },
      );
    }

    const personalityTag: string = meta.personalityTag || "Agent";

    // Optional Redis custom name
    let customName: string | null = null;
    try { const r = await getAgentByTokenId(tokenId); customName = r?.name ?? null; } catch { /* ignore */ }
    const canonicalName = TAG_TO_DEFAULT_NAME[personalityTag] ?? null;
    const name = customName || canonicalName || personalityTag;

    // Social graph + posts (all best-effort)
    let followers = 0n, following = 0n, reputation = 0n;
    let postIds: bigint[] = [];
    try { followers  = await socialGraph.getFollowerCount(tokenId); } catch { /* keep zero */ }
    try { following  = await socialGraph.getFollowingCount(tokenId); } catch { /* keep zero */ }
    try { reputation = await socialGraph.getReputation(tokenId); } catch { /* keep zero */ }
    try { postIds    = await postRegistry.getAgentPosts(tokenId); } catch { /* keep empty */ }

    const cloneFee = ethers.formatEther(meta.cloneFee || 0n);
    const mintedAt = Number(meta.mintedAt || 0n);

    // Recent posts authored by this agent (newest first, last 8)
    const recentIds = [...postIds].map(Number).sort((a, b) => b - a).slice(0, 8);
    const recentPosts: any[] = [];
    for (const pid of recentIds) {
      try {
        const post = await postRegistry.getPost(pid);
        const reactions = await postRegistry.getReactions(pid);
        recentPosts.push({
          postId: pid,
          storageRootHash: post.storageRootHash,
          parentPostId: Number(post.parentPostId),
          timestamp: Number(post.timestamp),
          tipTotal: ethers.formatEther(post.tipTotal),
          upvotes: Number(reactions.upvotes),
          fires: Number(reactions.fires),
          downvotes: Number(reactions.downvotes),
        });
      } catch { /* skip */ }
    }

    // Days live (since mint)
    const daysLive = mintedAt > 0
      ? Math.max(1, Math.floor((Date.now() / 1000 - mintedAt) / 86400))
      : 0;

    return NextResponse.json(
      {
        tokenId,
        name,
        personalityTag,
        owner,
        contracts: addresses,
        postsCount: postIds.length,
        followers: Number(followers),
        following: Number(following),
        reputation: Number(reputation),
        cloneFee,
        cloneable: parseFloat(cloneFee) > 0,
        mintedAt,
        daysLive,
        recentPosts,
      },
      { headers: CORS },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500, headers: CORS });
  }
}
