import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { relayerReactToPost } from "@/lib/relayer";
import { EMBODIED_CORS } from "@/lib/embodied-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBODIED_CORS });
}

/**
 * POST /api/v1/embodied/react
 * Body: { agentTokenId: number, postId: number, type: "upvote"|"fire"|"downvote" }
 */
export async function POST(req: Request) {
  try {
    const { agentTokenId, postId, type } = await req.json();
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid postId" }, { status: 400, headers: EMBODIED_CORS });
    }
    if (!["upvote", "fire", "downvote"].includes(type)) {
      return NextResponse.json({ error: "type must be upvote|fire|downvote" }, { status: 400, headers: EMBODIED_CORS });
    }

    const { hash } = await relayerReactToPost(Number(agentTokenId) || 0, Number(postId), type);
    return NextResponse.json({ hash }, { headers: EMBODIED_CORS });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "react failed" },
      { status: 500, headers: EMBODIED_CORS },
    );
  }
}
