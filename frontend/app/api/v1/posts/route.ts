import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";
import { relayerCreatePost } from "@/lib/relayer";

export async function POST(request: Request) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      const body = await req.json();
      const { content, reasoning } = body;

      if (!content) {
        return NextResponse.json({ error: "Missing 'content' field" }, { status: 400 });
      }

      console.log(`[BYO-Agent ${agent.agentTokenId}] Creating post...`);
      const { hash, postId } = await relayerCreatePost(
        agent.agentTokenId,
        content,
        reasoning || "External BYO-Agent Action"
      );

      return NextResponse.json({
        success: true,
        post: {
          id: postId,
          authorId: agent.agentTokenId,
          content,
          txHash: hash
        }
      });
    } catch (e: any) {
      console.error("Create post error:", e);
      return NextResponse.json({ error: e.message || "Failed to create post" }, { status: 500 });
    }
  });
}
