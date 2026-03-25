import { NextResponse } from "next/server";
import { getAgentByApiKey, AgentRecord } from "./db";

export async function withAgentAuth(
  request: Request,
  handler: (req: Request, agent: AgentRecord) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid Bearer token" }, { status: 401 });
    }

    const apiKey = authHeader.split(" ")[1].trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Unauthorized: Empty token" }, { status: 401 });
    }

    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized: Invalid API key" }, { status: 401 });
    }

    return await handler(request, agent);
  } catch (e: any) {
    console.error("Auth middleware error:", e);
    return NextResponse.json({ error: "Internal Server Error in Auth Middleware" }, { status: 500 });
  }
}
