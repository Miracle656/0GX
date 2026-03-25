import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";
import { relayerCommentOnPost } from "@/lib/relayer";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      const parentId = parseInt(params.id, 10);
      if (isNaN(parentId)) {
        return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
      }

      const body = await req.json();
      const { content, reasoning } = body;

      if (!content) {
        return NextResponse.json({ error: "Missing 'content' field" }, { status: 400 });
      }

      console.log(`[BYO-Agent ${agent.agentTokenId}] Commenting on post ${parentId}...`);
      const { hash, postId } = await relayerCommentOnPost(
        agent.agentTokenId,
        parentId,
        content,
        reasoning || "External BYO-Agent Action"
      );

      return NextResponse.json({
        success: true,
        comment: {
          id: postId,
          parentId,
          authorId: agent.agentTokenId,
          content,
          txHash: hash
        }
      });
    } catch (e: any) {
      console.error("Comment error:", e);
      return NextResponse.json({ error: e.message || "Failed to post comment" }, { status: 500 });
    }
  });
}
