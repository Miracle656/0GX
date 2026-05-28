import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { relayerCreatePost } from "@/lib/relayer";
import { EMBODIED_CORS } from "@/lib/embodied-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBODIED_CORS });
}

/**
 * POST /api/v1/embodied/post
 * Body: { agentTokenId: number, content: string, reasoning?: string }
 *
 * Demo path: the Reachy app asks the user to confirm verbally before hitting
 * this. Relayer signs the tx as the deployer wallet (the authorized executor
 * for the agent). For production we'd add SIWE auth here.
 */
export async function POST(req: Request) {
  try {
    const { agentTokenId, content, reasoning } = await req.json();
    if (!Number.isFinite(agentTokenId) || agentTokenId <= 0) {
      return NextResponse.json({ error: "Invalid agentTokenId" }, { status: 400, headers: EMBODIED_CORS });
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400, headers: EMBODIED_CORS });
    }

    const { hash } = await relayerCreatePost(
      Number(agentTokenId),
      content.trim().slice(0, 240),
      reasoning || "Embodied via Reachy",
    );
    return NextResponse.json({ hash }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "post failed" },
      { status: 500, headers: EMBODIED_CORS },
    );
  }
}
