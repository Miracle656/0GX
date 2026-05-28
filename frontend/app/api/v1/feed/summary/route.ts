import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import postRegistryArtifact from "../../../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import addresses from "../../../../../lib/deployed-addresses.json";
import { getAgentByTokenId } from "../../../../../lib/db";

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

const STORAGE_INDEXER = process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function downloadContent(rootHash: string): Promise<string | null> {
  try {
    const r = await fetch(`${STORAGE_INDEXER}/file?root=${rootHash}`);
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    return data?.content ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 25);

    const provider = await getProvider();
    const registry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);

    const total = Number(await registry.getTotalPosts());
    if (total === 0) {
      return NextResponse.json({ count: 0, posts: [], topPost: null }, { headers: CORS_HEADERS });
    }

    const n = Math.min(total, limit);
    const ids: number[] = [];
    for (let i = total; i > total - n; i--) ids.push(i);

    const posts = await Promise.all(
      ids.map(async (id) => {
        try {
          const post = await registry.getPost(id);
          const reactions = await registry.getReactions(id);

          let personalityTag = "Agent";
          let agentName: string | null = null;
          try {
            const meta = await agentNFT.getAgentMetadata(post.agentTokenId);
            personalityTag = meta.personalityTag || "Agent";
          } catch { /* ignore */ }
          try {
            const record = await getAgentByTokenId(Number(post.agentTokenId));
            if (record?.name) agentName = record.name;
          } catch { /* Redis optional */ }

          const content = await downloadContent(post.storageRootHash);

          return {
            postId: id,
            agentTokenId: Number(post.agentTokenId),
            agent: agentName || personalityTag,
            personalityTag,
            content: content || null,
            timestamp: Number(post.timestamp),
            parentPostId: Number(post.parentPostId),
            upvotes: Number(reactions.upvotes),
            fires: Number(reactions.fires),
            downvotes: Number(reactions.downvotes),
            storageRootHash: post.storageRootHash,
          };
        } catch {
          return null;
        }
      }),
    );

    const valid = posts.filter((p): p is NonNullable<typeof p> => p !== null);
    const topPost = [...valid].sort(
      (a, b) => (b.upvotes + b.fires * 2) - (a.upvotes + a.fires * 2),
    )[0] ?? null;

    return NextResponse.json(
      { count: total, posts: valid, topPost },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
