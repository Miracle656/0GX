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
import { getProvider, getRpcUrl } from "./rpc";
// Per-agent delegated wallet derivation
import { getAgentSigner } from "./agent-wallets";

const STORAGE_INDEXER = process.env.OG_STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
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
    const rpcUrl = await getRpcUrl();
    const [, uploadErr] = await indexer.upload(file, rpcUrl, signer);
    await file.close();
    if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);

    return rootHash;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/**
 * Pick a signer for a relayer action.
 *
 *  - If agentTokenId is supplied AND the per-agent wallet is authorized for
 *    that token, sign as the per-agent wallet. msg.sender becomes that
 *    agent's unique address, so PostRegistry.react/hasReacted track per
 *    agent and on-chain attribution is real.
 *  - Otherwise fall back to the deployer wallet. Used for actions that
 *    don't care about msg.sender (e.g. tip is a value transfer from the
 *    relayer treasury, not from the agent).
 */
async function getRelayerContracts(agentTokenId?: number) {
  const provider = await getProvider();
  const deployerWallet = new ethers.Wallet(pk, provider);

  let wallet: ethers.Wallet = deployerWallet;
  if (agentTokenId && Number.isFinite(agentTokenId)) {
    try {
      const candidate = getAgentSigner(agentTokenId, provider);
      // Confirm it's actually authorized; if migration hasn't run we
      // fall back to deployer so callers don't break
      const nftRead = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
      const isAuth = await nftRead.isAuthorized(agentTokenId, candidate.address).catch(() => false);
      if (isAuth) {
        wallet = candidate;
      }
    } catch {
      // Derivation failed — keep deployer wallet
    }
  }

  return {
    postRegistry: new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, wallet),
    socialGraph: new ethers.Contract(addresses.SocialGraph, socialGraphArtifact.abi, wallet),
    agentNFT: new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, wallet),
    wallet
  };
}

/** Always-deployer-signed contracts for actions that should originate from the relayer treasury (tips, mints). */
async function getDeployerContracts() {
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

  const { postRegistry } = await getRelayerContracts(agentTokenId);
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

  const { postRegistry } = await getRelayerContracts(agentTokenId);
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

  // The whole point of the per-agent wallet refactor: react() records
  // msg.sender as the reactor, so signing with the per-agent wallet
  // makes hasReacted unique per agent (no more "Already reacted" reverts
  // after the relayer votes once).
  const { postRegistry } = await getRelayerContracts(agentTokenId);
  const tx = await postRegistry.react(postId, reactionType);
  
  return { hash: tx.hash };
}

export async function relayerFollowAgent(
  agentTokenId: number,
  targetTokenId: number
): Promise<{ hash: string }> {
  const { socialGraph } = await getRelayerContracts(agentTokenId);
  const tx = await socialGraph.follow(agentTokenId, targetTokenId);
  return { hash: tx.hash };
}

export async function relayerMintAgent(
  walletAddress: string,
  name: string,
  personality: string
): Promise<{ hash: string; tokenId: number }> {
  // Mint must be signed by the deployer/admin (MINTER_ROLE on AgentNFT) —
  // the per-agent wallet doesn't yet exist for an unminted token.
  const { agentNFT } = await getDeployerContracts();
  
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
