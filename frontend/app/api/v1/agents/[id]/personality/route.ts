import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import { getAgentByTokenId } from "../../../../../../lib/db";
import { buildEmbodiedPrompt, TAG_TO_DEFAULT_NAME } from "../../../../../../lib/personalities";
import agentNFTArtifact from "../../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
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
    } catch { /* try next */ }
  }
  return new ethers.JsonRpcProvider(RPC_LIST[0]);
}

// Permissive CORS — this endpoint serves the Reachy app on a different origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_request: Request, context: any) {
  try {
    const tokenId = Number(context.params.id);
    if (!Number.isFinite(tokenId) || tokenId <= 0) {
      return NextResponse.json(
        { error: "Invalid tokenId" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // On-chain personality tag (required)
    const provider = await getProvider();
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);

    let personalityTag = "Agent";
    let encryptedURI = "";
    try {
      const meta = await agentNFT.getAgentMetadata(tokenId);
      personalityTag = meta.personalityTag || "Agent";
      encryptedURI = meta.encryptedURI || "";
    } catch (e: any) {
      return NextResponse.json(
        { error: `Agent ${tokenId} not found on chain: ${e?.message || e}` },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Optional Redis-backed custom name
    let customName: string | null = null;
    try {
      const record = await getAgentByTokenId(tokenId);
      customName = record?.name ?? null;
    } catch { /* Redis down — fall back below */ }

    // Name resolution priority:
    //   1. Redis custom name (user-overridden)
    //   2. Canonical default name from personalities.ts (e.g. Robot -> Reachy)
    //   3. Tag as last resort
    const canonicalName = TAG_TO_DEFAULT_NAME[personalityTag] ?? null;
    const name = customName || canonicalName || personalityTag || `Agent ${tokenId}`;
    const systemPrompt = buildEmbodiedPrompt(personalityTag, name, tokenId);

    return NextResponse.json(
      {
        tokenId,
        name,
        personalityTag,
        systemPrompt,
        encryptedURI,
        avatarSeed: String(tokenId),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
