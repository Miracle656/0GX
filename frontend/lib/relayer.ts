import { ethers } from "ethers";
import { Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";
import fs from "fs";
import path from "path";
import os from "os";

// Contract ABIs & Addresses
import agentNFTArtifact from "../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import postRegistryArtifact from "../../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import socialGraphArtifact from "../../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import addresses from "./deployed-addresses.json";

// Shared RPC Fallback
import { getProvider } from "./rpc";

const STORAGE_INDEXER = process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// Ensure private key is formatted correctly
const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

export interface PostContent {
  agentTokenId: number;
  content: string;
  parentPostId: string | null;
  timestamp: number;
  agentReasoning: string;
}

/**
 * Upload a JSON payload to 0G Storage and return the root hash.
 */
async function uploadTo0G(payload: object): Promise<string> {
  const provider = await getProvider();
  const signer = new ethers.Wallet(pk, provider);
  const indexer = new Indexer(STORAGE_INDEXER);

  const tmpPath = path.join(os.tmpdir(), `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload));

  try {
    const file = await ZgFile.fromFilePath(tmpPath);
    
    // Compute root hash from merkle tree
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);
    const rootHash = tree!.rootHash();
    if (!rootHash) throw new Error("Root hash is null");

    // Upload using the relayer wallet to pay 0G storage fees
    const [, uploadErr] = await indexer.upload(file, OG_RPC_URL, signer);
    await file.close();
    if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);

    return rootHash;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

async function getRelayerContracts() {
  const provider = await getProvider();
  const wallet = new ethers.Wallet(pk, provider);
  
  return {
    postRegistry: new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, wallet),
    socialGraph: new ethers.Contract(addresses.SocialGraph, socialGraphArtifact.abi, wallet),
    agentNFT: new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, wallet),
    wallet
  };
}

export async function relayerCreatePost(
  agentTokenId: number,
  content: string,
  reasoning: string = "External action"
): Promise<{ hash: string; postId: number }> {
  const postContent: PostContent = {
    agentTokenId,
    content,
    parentPostId: null,
    timestamp: Date.now(),
    agentReasoning: reasoning,
  };
  
  const rootHashHex = await uploadTo0G(postContent);
  const rootHashBytes = ethers.zeroPadValue(
    ethers.toBeArray(BigInt("0x" + rootHashHex.replace("0x", ""))),
    32
  );

  const { postRegistry } = await getRelayerContracts();
  const tx = await postRegistry.createPost(agentTokenId, rootHashBytes, 0);
  
  // Return immediately without waiting for block confirmation to prevent Vercel 10s timeout
  return { hash: tx.hash, postId: 0 };
}

export async function relayerCommentOnPost(
  agentTokenId: number,
  parentPostId: number,
  content: string,
  reasoning: string = "External action"
): Promise<{ hash: string; postId: number }> {
  const commentContent: PostContent = {
    agentTokenId,
    content,
    parentPostId: String(parentPostId),
    timestamp: Date.now(),
    agentReasoning: reasoning,
  };

  const rootHashHex = await uploadTo0G(commentContent);
  const rootHashBytes = ethers.zeroPadValue(
    ethers.toBeArray(BigInt("0x" + rootHashHex.replace("0x", ""))),
    32
  );

  const { postRegistry } = await getRelayerContracts();
  const tx = await postRegistry.createPost(agentTokenId, rootHashBytes, parentPostId);
  
  // Return immediately without waiting for block confirmation to prevent Vercel 10s timeout
  return { hash: tx.hash, postId: 0 };
}

export async function relayerReactToPost(
  agentTokenId: number, // In current contract, react() relies on msg.sender, but wait! We need the INFT concept.
  postId: number,
  reaction: "upvote" | "fire" | "downvote"
): Promise<{ hash: string }> {
  const reactionMap: Record<string, number> = { upvote: 0, fire: 1, downvote: 2 };
  const reactionType = reactionMap[reaction] ?? 0;

  const { postRegistry } = await getRelayerContracts();
  // Note: Currently postRegistry.react() just takes postId and reactionType.
  // It records author as msg.sender. In a later iteration we should add agentTokenId to react too.
  const tx = await postRegistry.react(postId, reactionType);
  
  return { hash: tx.hash };
}

export async function relayerFollowAgent(
  agentTokenId: number,
  targetTokenId: number
): Promise<{ hash: string }> {
  const { socialGraph } = await getRelayerContracts();
  const tx = await socialGraph.follow(agentTokenId, targetTokenId);
  return { hash: tx.hash };
}

export async function relayerMintAgent(
  walletAddress: string,
  name: string,
  personality: string
): Promise<{ hash: string; tokenId: number }> {
  const { agentNFT } = await getRelayerContracts();
  
  const metadataConfig = {
    name,
    personality,
    traits: [personality, "agent"],
    model: "external",
    createdAt: Date.now(),
    version: "1.0.0"
  };
  
  const rootHashHex = await uploadTo0G(metadataConfig);
  const metadataHash = ethers.zeroPadValue(
    ethers.toBeArray(BigInt("0x" + rootHashHex.replace("0x", ""))),
    32
  );

  const cloneFee = ethers.parseEther("0.001");
  const encryptedURI = `byo-${personality}-${Date.now()}`;

  // adminMint to assign the agent to the human's wallet
  const tx = await agentNFT.adminMint(
    walletAddress,
    encryptedURI,
    metadataHash,
    personality,
    cloneFee
  );
  
  const receipt = await tx.wait();
  
  // Find AgentMinted event to extract tokenId
  let tokenId = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = agentNFT.interface.parseLog(log);
      if (parsed?.name === "AgentMinted") {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch { }
  }
  
  return { hash: tx.hash, tokenId };
}
