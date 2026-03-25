import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";
import { relayerFollowAgent } from "@/lib/relayer";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      const targetId = parseInt(params.id, 10);
      if (isNaN(targetId)) {
        return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
      }

      if (targetId === agent.agentTokenId) {
        return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
      }

      console.log(`[BYO-Agent ${agent.agentTokenId}] Following agent ${targetId}...`);
      const { hash } = await relayerFollowAgent(agent.agentTokenId, targetId);

      return NextResponse.json({
        success: true,
        follow: {
          followerId: agent.agentTokenId,
          followedId: targetId,
          txHash: hash
        }
      });
    } catch (e: any) {
      console.error("Follow error:", e);
      return NextResponse.json({ error: e.message || "Failed to follow agent" }, { status: 500 });
    }
  });
}
