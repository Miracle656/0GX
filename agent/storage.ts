import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";

const STORAGE_INDEXER = process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

export interface PostContent {
  agentTokenId: number;
  content: string;
  parentPostId: string | null;
  timestamp: number;
  agentReasoning: string;
}

export interface AgentConfig {
  name: string;
  personality: string;
  traits: string[];
  model: string;
  createdAt: number;
  version: string;
}

function getSignerAndNonce() {
  const { sharedSigner, getNextNonce } = require("./wallet");
  return { sharedSigner, getNextNonce };
}

/**
 * Upload a JSON payload to 0G Storage and return the root hash.
 * Uses indexer.upload() which returns rootHash directly.
 */
async function uploadJson(payload: object): Promise<string> {
  const { sharedSigner, getNextNonce } = getSignerAndNonce();
  const indexer = new Indexer(STORAGE_INDEXER);

  const tmpPath = path.join(process.env.TEMP || "/tmp", `upload-${Date.now()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload));

  try {
    const file = await ZgFile.fromFilePath(tmpPath);

    // Compute root hash from merkle tree before upload
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);
    const rootHash = tree!.rootHash();
    if (!rootHash) throw new Error("Root hash is null after merkle tree computation");

    const nonce = await getNextNonce();
    const [, uploadErr] = await indexer.upload(file, OG_RPC_URL, sharedSigner, { nonce: BigInt(nonce) });
    await file.close();
    if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);

    return rootHash;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/**
 * Upload post content JSON to 0G Storage Log layer (immutable)
 * Returns the root hash that gets registered on-chain in PostRegistry
 */
export async function uploadPost(content: PostContent): Promise<string> {
  return uploadJson(content);
}

/**
 * Download and parse post content from 0G Storage using root hash
 */
export async function downloadPost(rootHash: string): Promise<PostContent | null> {
  try {
    const indexer = new Indexer(STORAGE_INDEXER);
    const outPath = path.join(process.env.TEMP || "/tmp", `dl-${Date.now()}.json`);

    const err = await indexer.download(rootHash, outPath, false);
    if (err) {
      console.warn(`Download warning for ${rootHash}:`, err);
      return null;
    }

    const raw = fs.readFileSync(outPath, "utf8");
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    return JSON.parse(raw) as PostContent;
  } catch (e) {
    console.error("downloadPost error:", e);
    return null;
  }
}

/**
 * Upload agent config/personality to 0G Storage (encrypted at app layer)
 * Returns root hash for storing in AgentNFT metadata
 */
export async function uploadAgentConfig(config: AgentConfig): Promise<string> {
  return uploadJson(config);
}
