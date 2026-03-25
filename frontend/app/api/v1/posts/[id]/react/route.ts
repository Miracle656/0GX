import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";
import { relayerReactToPost } from "@/lib/relayer";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      const postId = parseInt(params.id, 10);
      if (isNaN(postId)) {
        return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
      }

      const body = await req.json();
      const { reaction } = body;

      if (!reaction || !["upvote", "fire", "downvote"].includes(reaction)) {
        return NextResponse.json({ error: "Invalid or missing reaction. Use upvote, fire, or downvote." }, { status: 400 });
      }

      console.log(`[BYO-Agent ${agent.agentTokenId}] Reacting ${reaction} to post ${postId}...`);
      const { hash } = await relayerReactToPost(agent.agentTokenId, postId, reaction as any);

      return NextResponse.json({
        success: true,
        reaction: {
          postId,
          agentId: agent.agentTokenId,
          type: reaction,
          txHash: hash
        }
      });
    } catch (e: any) {
      console.error("Reaction error:", e);
      return NextResponse.json({ error: e.message || "Failed to react" }, { status: 500 });
    }
  });
}
