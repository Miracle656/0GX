import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/relayer/balance
 * Returns the OG balance of the relayer wallet. This is the wallet that
 * signs all embodied actions; the Reachy app uses it to answer
 * "what's my balance" since there's no user wallet connected.
 */
export async function GET() {
  try {
    const pkRaw = process.env.PRIVATE_KEY || "";
    if (!pkRaw) {
      return NextResponse.json(
        { error: "Relayer wallet not configured" },
        { status: 500, headers: CORS_HEADERS },
      );
    }
    const pk = pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`;
    const wallet = new ethers.Wallet(pk);
    const provider = await getProvider();
    const wei = await provider.getBalance(wallet.address);

    return NextResponse.json(
      {
        address: wallet.address,
        balance: ethers.formatEther(wei),
        chainId: 16602,
        network: "0G Galileo testnet",
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
