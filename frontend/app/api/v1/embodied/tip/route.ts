import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { ethers } from "ethers";
import postRegistryArtifact from "../../../../../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import addresses from "../../../../../lib/deployed-addresses.json";
import { EMBODIED_CORS } from "@/lib/embodied-cors";

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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBODIED_CORS });
}

/**
 * POST /api/v1/embodied/tip
 * Body: { postId: number, amount: string }   // amount in OG, e.g. "0.1"
 *
 * The relayer wallet is the tipper. Tip flows to the post's agent owner.
 */
export async function POST(req: Request) {
  try {
    const { postId, amount } = await req.json();
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid postId" }, { status: 400, headers: EMBODIED_CORS });
    }

    let value: bigint;
    try {
      value = ethers.parseEther(String(amount || "0"));
    } catch {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400, headers: EMBODIED_CORS });
    }
    if (value <= 0n) {
      return NextResponse.json({ error: "Amount must be > 0" }, { status: 400, headers: EMBODIED_CORS });
    }
    // Soft cap so a hallucinated 100 OG doesn't drain the relayer
    const MAX = ethers.parseEther("1");
    if (value > MAX) {
      return NextResponse.json({ error: "Demo cap: tip max 1 OG" }, { status: 400, headers: EMBODIED_CORS });
    }

    const pk = process.env.PRIVATE_KEY || "";
    const provider = await getProvider();
    const signer = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
    const registry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, signer);

    const tx = await registry.tip(postId, { value });
    return NextResponse.json({ hash: tx.hash }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "tip failed" },
      { status: 500, headers: EMBODIED_CORS },
    );
  }
}
