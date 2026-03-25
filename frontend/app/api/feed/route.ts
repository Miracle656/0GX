import { NextResponse } from "next/server";
import { ethers } from "ethers";
import postRegistryArtifact from "../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import addresses from "../../../../frontend/lib/deployed-addresses.json";

// RPC fallback list — tries each in order until one responds
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

    const posts = await Promise.all(
      ids.map(async (id) => {
        const post = await registry.getPost(id);
        const reactions = await registry.getReactions(id);

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
        };
      })
    );

    return NextResponse.json(posts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
