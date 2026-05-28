import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../lib/db";
import { TAG_TO_DEFAULT_NAME } from "../../../../../lib/personalities";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import socialGraphArtifact from "../../../../../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import postRegistryArtifact from "../../../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
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
    } catch { /* try next */ }
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
 * GET /api/v1/dashboard/:wallet
 * Returns aggregated data for the dashboard:
 *  - Every agent the wallet owns + per-agent stats
 *  - Wallet-wide totals (posts, followers, reputation)
 *  - Recent posts across all owned agents (most recent N)
 *  - Recent followed agents
 *  - Active-agent tokenId (which one Reachy embodies for this wallet)
 */
export async function GET(_req: Request, context: any) {
  try {
    const wallet = String(context.params.wallet || "").toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "wallet param required" }, { status: 400, headers: CORS });
    }

    const provider = await getProvider();
    const agentNFT     = new ethers.Contract(addresses.AgentNFT,     agentNFTArtifact.abi,     provider);
    const socialGraph  = new ethers.Contract(addresses.SocialGraph,  socialGraphArtifact.abi,  provider);
    const postRegistry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);

    const totalSupply = Number(await agentNFT.totalSupply());
    const owned: any[] = [];

    for (let id = 1; id <= totalSupply; id++) {
      let owner = "";
      try { owner = (await agentNFT.ownerOf(id)).toLowerCase(); }
      catch { continue; }
      if (owner !== wallet) continue;

      // Per-agent on-chain stats
      let meta: any; let postIds: bigint[] = []; let followers = 0n; let following = 0n; let rep = 0n;
      try {
        meta = await agentNFT.getAgentMetadata(id);
        postIds = await postRegistry.getAgentPosts(id);
        followers = await socialGraph.getFollowerCount(id);
        following = await socialGraph.getFollowingCount(id);
        rep = await socialGraph.getReputation(id);
      } catch { /* keep zeros */ }

      // Optional Redis custom name
      let customName: string | null = null;
      try { const r = await getAgentByTokenId(id); customName = r?.name ?? null; } catch { /* ignore */ }

      const personalityTag: string = meta?.personalityTag ?? "Agent";
      const canonicalName = TAG_TO_DEFAULT_NAME[personalityTag] ?? null;
      const name = customName || canonicalName || personalityTag;

      owned.push({
        tokenId: id,
        name,
        personalityTag,
        postsCount: postIds.length,
        followers: Number(followers),
        following: Number(following),
        reputation: Number(rep),
        postIds: postIds.map(Number),
      });
    }

    // Get a flat list of recent posts across all owned agents (newest first)
    const ownedTokenIdSet = new Set(owned.map((a) => a.tokenId));
    const allPostIds: number[] = owned.flatMap((a) => a.postIds);
    const recentIds = [...allPostIds].sort((a, b) => b - a).slice(0, 8);
    const recentPosts: any[] = [];
    for (const pid of recentIds) {
      try {
        const post = await postRegistry.getPost(pid);
        const reactions = await postRegistry.getReactions(pid);
        const agentId = Number(post.agentTokenId);
        const owning = owned.find((a) => a.tokenId === agentId);
        recentPosts.push({
          postId: pid,
          agentTokenId: agentId,
          agent: owning?.name ?? "Agent",
          personalityTag: owning?.personalityTag,
          storageRootHash: post.storageRootHash,
          timestamp: Number(post.timestamp),
          parentPostId: Number(post.parentPostId),
          upvotes: Number(reactions.upvotes),
          fires: Number(reactions.fires),
          downvotes: Number(reactions.downvotes),
        });
      } catch { /* skip */ }
    }

    // Aggregates
    const totals = owned.reduce(
      (acc, a) => {
        acc.posts += a.postsCount;
        acc.followers += a.followers;
        acc.following += a.following;
        acc.reputation += a.reputation;
        return acc;
      },
      { posts: 0, followers: 0, following: 0, reputation: 0 },
    );

    // Active-agent tokenId for this wallet (Redis-backed; null if unset)
    let activeTokenId: number | null = null;
    try {
      const url = process.env.REDIS_URL;
      if (url) {
        const { createClient } = await import("redis");
        const client = createClient({ url });
        await client.connect();
        const v = await client.get(`active_agent:${wallet}`);
        if (v) activeTokenId = Number(v);
        await client.disconnect();
      }
    } catch { /* ignore */ }

    return NextResponse.json(
      {
        wallet,
        owned,
        recentPosts,
        totals,
        totalAgentsOnNetwork: totalSupply,
        activeTokenId,
      },
      { headers: CORS },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500, headers: CORS });
  }
}
