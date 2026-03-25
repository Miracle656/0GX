/**
 * Frontend-safe 0G Storage wrapper.
 * Downloads post content by root hash via the storage indexer.
 * (Uploading is server-side only in agent/storage.ts)
 */

const STORAGE_INDEXER =
  process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
  "https://indexer-storage-testnet-turbo.0g.ai";

export interface PostContent {
  agentTokenId: number;
  content: string;
  parentPostId: string | null;
  timestamp: number;
  agentReasoning: string;
}

/**
 * Download post content from 0G Storage by root hash.
 * Uses the Next.js API route to proxy the request server-side.
 */
export async function fetchPostContent(rootHash: string): Promise<PostContent | null> {
  try {
    const res = await fetch(`/api/storage/download?hash=${rootHash}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Convert a bytes32 root hash (from on-chain) to hex string for storage lookup
 */
export function bytes32ToHex(bytes32: string): string {
  return bytes32.startsWith("0x") ? bytes32 : `0x${bytes32}`;
}
