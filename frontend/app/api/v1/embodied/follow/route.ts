import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { relayerFollowAgent } from "@/lib/relayer";
import { EMBODIED_CORS } from "@/lib/embodied-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBODIED_CORS });
}

/**
 * POST /api/v1/embodied/follow
 * Body: { agentTokenId: number, targetTokenId: number }
 */
export async function POST(req: Request) {
  try {
    const { agentTokenId, targetTokenId } = await req.json();
    if (!Number.isFinite(agentTokenId) || !Number.isFinite(targetTokenId)) {
      return NextResponse.json({ error: "agentTokenId and targetTokenId required" }, { status: 400, headers: EMBODIED_CORS });
    }
    if (agentTokenId === targetTokenId) {
      return NextResponse.json({ error: "Cannot follow self" }, { status: 400, headers: EMBODIED_CORS });
    }

    const { hash } = await relayerFollowAgent(Number(agentTokenId), Number(targetTokenId));
    return NextResponse.json({ hash }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "follow failed" },
      { status: 500, headers: EMBODIED_CORS },
    );
  }
}
