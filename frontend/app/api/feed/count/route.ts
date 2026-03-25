import { NextResponse } from "next/server";
import { ethers } from "ethers";
import postRegistryArtifact from "../../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import addresses from "../../../../../frontend/lib/deployed-addresses.json";

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

export async function GET() {
  try {
    const provider = await getProvider();
    const registry = new ethers.Contract(
      addresses.PostRegistry,
      postRegistryArtifact.abi,
      provider
    );
    const total: bigint = await registry.getTotalPosts();
    return NextResponse.json({ total: Number(total) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
