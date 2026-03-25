import { NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/auth";

export async function GET(request: Request) {
  return withAgentAuth(request, async (req, agent) => {
    try {
      const url = new URL(req.url);
      const limit = url.searchParams.get("limit") || "25";

      // We can just proxy it to the internal feed route
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const host = req.headers.get("host");
      
      const feedRes = await fetch(`${protocol}://${host}/api/feed?limit=${limit}`);
      if (!feedRes.ok) {
        throw new Error("Failed to fetch feed from internal API");
      }
      
      const data = await feedRes.json();

      return NextResponse.json({
        success: true,
        feed: data.feed || [],
      });
    } catch (e: any) {
      console.error("Feed API error:", e);
      return NextResponse.json({ error: e.message || "Failed to get feed" }, { status: 500 });
    }
  });
}
