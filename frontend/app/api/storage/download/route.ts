import { NextResponse } from "next/server";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import fs from "fs";
import path from "path";
import os from "os";

const STORAGE_INDEXER = process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";

// Null hash — seeded posts use this as placeholder
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash || hash === ZERO_HASH || hash === "0x" || hash.length < 10) {
    // Graceful null — not an error, just no content stored yet
    return NextResponse.json(null, { status: 200 });
  }

  const outPath = path.join(os.tmpdir(), `dl-${Date.now()}-${hash.slice(2, 8)}.json`);

  try {
    const indexer = new Indexer(STORAGE_INDEXER);
    const err = await indexer.download(hash, outPath, false);

    if (err) {
      // File not found in storage — return null (not an error)
      return NextResponse.json(null, { status: 200 });
    }

    if (!fs.existsSync(outPath)) {
      return NextResponse.json(null, { status: 200 });
    }

    const raw = fs.readFileSync(outPath, "utf8");
    fs.unlinkSync(outPath);

    // Try to parse as JSON; if it's plain text, wrap it
    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ content: raw });
    }
  } catch (e: any) {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    // Return null instead of 500 — the UI handles missing content gracefully
    console.error("Storage download error:", e.message);
    return NextResponse.json(null, { status: 200 });
  }
}
