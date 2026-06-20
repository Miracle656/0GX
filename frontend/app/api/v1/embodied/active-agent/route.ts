import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { ethers } from "ethers";
import { EMBODIED_CORS } from "@/lib/embodied-cors";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import addresses from "@/lib/deployed-addresses.json";

// ─────────────────────────────────────────────────────────────────────
// Active-agent selector.
// Maps a wallet address to the AgentFeed tokenId that should embody Reachy
// when that wallet connects. Persisted in Redis when available; the GET
// path falls back to "no active set" if Redis is dead. Reachy reads the
// active agent on session start; the agent profile page lets owners set it.
// ─────────────────────────────────────────────────────────────────────

const REDIS_KEY_PREFIX = "active_agent:";

async function readActive(wallet: string): Promise<number | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  let createClient: any;
  try { createClient = (await import("redis")).createClient; } catch { return null; }
  const client = createClient({ url });
  try {
    await client.connect();
    const v = await client.get(REDIS_KEY_PREFIX + wallet.toLowerCase());
    return v ? Number(v) : null;
  } catch { return null; }
  finally { try { await client.disconnect(); } catch { /* ignore */ } }
}

async function writeActive(wallet: string, tokenId: number): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;
  let createClient: any;
  try { createClient = (await import("redis")).createClient; } catch { return false; }
  const client = createClient({ url });
  try {
    await client.connect();
    await client.set(REDIS_KEY_PREFIX + wallet.toLowerCase(), String(tokenId));
    return true;
  } catch { return false; }
  finally { try { await client.disconnect(); } catch { /* ignore */ } }
}

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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...EMBODIED_CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
}

/**
 * GET /api/v1/embodied/active-agent?wallet=0x...
 * Returns the tokenId set as active for that wallet, or null.
 */
export async function GET(req: Request) {
  try {
    const wallet = new URL(req.url).searchParams.get("wallet");
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "wallet query param required" }, { status: 400, headers: EMBODIED_CORS });
    }
    const tokenId = await readActive(wallet);
    return NextResponse.json({ wallet: wallet.toLowerCase(), tokenId }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "read failed" }, { status: 500, headers: EMBODIED_CORS });
  }
}

/**
 * POST /api/v1/embodied/active-agent
 * Body: { wallet, tokenId }
 * Requires the wallet to own the tokenId on-chain (cheap fraud guard).
 */
export async function POST(req: Request) {
  try {
    const { wallet, tokenId } = await req.json();
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "wallet required" }, { status: 400, headers: EMBODIED_CORS });
    }
    if (!Number.isFinite(tokenId) || tokenId <= 0) {
      return NextResponse.json({ error: "tokenId required" }, { status: 400, headers: EMBODIED_CORS });
    }

    // Verify on-chain ownership so randoms can't claim other people's agents
    const provider = await getProvider();
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
    let owner: string;
    try { owner = await agentNFT.ownerOf(BigInt(tokenId)); }
    catch (e: any) { return NextResponse.json({ error: `tokenId ${tokenId} not found: ${e?.message || e}` }, { status: 404, headers: EMBODIED_CORS }); }

    if (owner.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: "Connected wallet does not own that agent" }, { status: 403, headers: EMBODIED_CORS });
    }

    const ok = await writeActive(wallet, Number(tokenId));
    return NextResponse.json({ wallet: wallet.toLowerCase(), tokenId: Number(tokenId), persisted: ok }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "write failed" }, { status: 500, headers: EMBODIED_CORS });
  }
}
