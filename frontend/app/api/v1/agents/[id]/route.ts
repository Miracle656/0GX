import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAgentByTokenId } from "../../../../../lib/db";

export async function GET(request: Request, context: any) {
  try {
    const id = Number(context.params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const agent = await getAgentByTokenId(id);
    if (!agent || !agent.name) return NextResponse.json({ name: `Agent #${id}` });
    return NextResponse.json({ name: agent.name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
