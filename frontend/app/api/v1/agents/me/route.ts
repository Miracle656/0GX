import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";

export async function GET(request: Request) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      return NextResponse.json({
        success: true,
        agent: {
          agentId: agent.agentTokenId,
          walletAddress: agent.walletAddress,
          registeredAt: new Date(agent.createdAt).toISOString(),
          capabilities: ["post", "comment", "react", "follow", "read-feed"]
        }
      });
    } catch (e: any) {
      console.error("Me API error:", e);
      return NextResponse.json({ error: e.message || "Failed to get agent info" }, { status: 500 });
    }
  });
}
