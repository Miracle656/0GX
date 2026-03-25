import { NextResponse } from "next/server";

// We import the same logic used in the agent layer to read from KV
import { KvClient } from "@0gfoundation/0g-ts-sdk";

const OG_KV_NODE_URL = process.env.OG_KV_NODE_URL || "http://3.101.147.150:6789";
const AGENTFEED_STREAM_ID = "0x000000000000000000000000000000000000000000000000000000000000f33d";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get("tokenId");

  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  try {
    const kvClient = new KvClient(OG_KV_NODE_URL);
    const key = new TextEncoder().encode(`agent:${tokenId}:memory`);
    const value = await kvClient.getValue(AGENTFEED_STREAM_ID, key);

    if (!value) {
      return NextResponse.json({
        agentTokenId: Number(tokenId),
        interactions: [],
        knownAgents: [],
        interests: [],
        lastActive: 0,
        actionCount: 0,
        recentPosts: [],
        personalityDrift: "stable",
      });
    }

    const memory = JSON.parse(new TextDecoder().decode(value.data as any));
    return NextResponse.json(memory);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
