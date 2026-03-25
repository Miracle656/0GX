import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { getMemory, updateMemoryAfterAction, type AgentMemory } from "./memory";
import { uploadPost, type PostContent } from "./storage";
import { buildAgentPrompt, type AgentDecision, type FeedPost } from "./prompts";

// ── Config ────────────────────────────────────────────────────────
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
// Community RPC fallbacks when the primary is rate-limited
const RPC_FALLBACK_LIST = [
  OG_RPC_URL,
  "https://galileo-evm-rpc.validator247.com",
  "https://0gchaind-evm-rpc.j-node.net",
];
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
// Active testnet chatbot provider (Qwen 2.5 7B)
const PROVIDER_ADDRESS =
  process.env.OG_COMPUTE_PROVIDER_ADDRESS || "0xa48f01287233509FD694a22Bf840225062E67836";

const LOOP_INTERVAL_MS = 30_000; // 30 seconds between cycles
const MAX_RETRIES = 3;

// Paused agents (controlled by owner via dashboard)
const pausedAgents = new Set<number>();

// ── Load contract ABIs ────────────────────────────────────────────
import agentNFTArtifact from "../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import postRegistryArtifact from "../artifacts/contracts/PostRegistry.sol/PostRegistry.json";
import socialGraphArtifact from "../artifacts/contracts/SocialGraph.sol/SocialGraph.json";
import addresses from "../frontend/lib/deployed-addresses.json";

// ── Shared provider / wallet / contracts (singletons) ───────────────
// Created once to avoid repeated JsonRpcProvider detection on every call

import { sharedSigner, sharedProvider } from "./wallet";

const _contracts = {
  agentNFT:     new ethers.Contract(addresses.AgentNFT,      agentNFTArtifact.abi,      sharedSigner),
  postRegistry: new ethers.Contract(addresses.PostRegistry,  postRegistryArtifact.abi,  sharedSigner),
  socialGraph:  new ethers.Contract(addresses.SocialGraph,   socialGraphArtifact.abi,   sharedSigner),
};

// ── RPC helpers ──────────────────────────────────────────────────
// Returns the first RPC in the fallback list that responds
async function getWorkingProvider(): Promise<ethers.JsonRpcProvider> {
  for (const url of RPC_FALLBACK_LIST) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch { /* try next */ }
  }
  return sharedProvider; // last resort: use singleton even if degraded
}

function getContracts() {
  return { provider: sharedProvider, wallet: sharedSigner, ..._contracts };
}

async function fetchRecentFeed(): Promise<FeedPost[]> {
  try {
    const provider = await getWorkingProvider();
    const postRegistry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
    const total = await postRegistry.getTotalPosts();
    const n = Math.min(Number(total), 20);
    if (n === 0) return [];

    const posts: FeedPost[] = [];
    for (let i = Number(total); i > Number(total) - n && i > 0; i--) {
      try {
        const post = await postRegistry.getPost(i);
        const metadata = await agentNFT.getAgentMetadata(post.agentTokenId);
        posts.push({
          postId: i,
          agentTokenId: Number(post.agentTokenId),
          content: `[0G Storage: ${post.storageRootHash.slice(0, 16)}...]`,
          storageRootHash: post.storageRootHash,
          timestamp: Number(post.timestamp),
          personalityTag: metadata.personalityTag,
        });
      } catch {}
    }
    return posts;
  } catch (e) {
    console.warn("fetchRecentFeed failed:", e);
    return [];
  }
}

async function executeAction(agentTokenId: number, action: AgentDecision): Promise<string | null> {
  const { postRegistry, socialGraph } = getContracts();
  let postRootHash: string | null = null;
  
  // Extract pure number if the model hallucinated a prefix like "Post#12" or "Agent#3"
  const parsedTargetId = action.targetId 
    ? parseInt(String(action.targetId).replace(/\\D/g, ""), 10) 
    : null;

  try {
    switch (action.type) {
      case "post": {
        if (!action.content) break;

        // Upload content to 0G Storage Log layer
        const postContent: PostContent = {
          agentTokenId,
          content: action.content,
          parentPostId: null,
          timestamp: Date.now(),
          agentReasoning: action.reasoning,
        };
        postRootHash = await uploadPost(postContent);

        const rootHashBytes = ethers.zeroPadValue(
          ethers.toBeArray(BigInt("0x" + postRootHash.replace("0x", ""))),
          32
        );
        await (await postRegistry.createPost(agentTokenId, rootHashBytes, 0)).wait();
        console.log(`  [Agent ${agentTokenId}] Posted: "${action.content.substring(0, 60)}..."`);
        break;
      }

      case "comment": {
        if (!action.content || !parsedTargetId || isNaN(parsedTargetId)) break;

        const commentContent: PostContent = {
          agentTokenId,
          content: action.content,
          parentPostId: String(parsedTargetId),
          timestamp: Date.now(),
          agentReasoning: action.reasoning,
        };
        postRootHash = await uploadPost(commentContent);

        const rootHashBytes = ethers.zeroPadValue(
          ethers.toBeArray(BigInt("0x" + postRootHash.replace("0x", ""))),
          32
        );
        await (await postRegistry.createPost(agentTokenId, rootHashBytes, parsedTargetId)).wait();
        console.log(`  [Agent ${agentTokenId}] Commented on post ${parsedTargetId}`);
        break;
      }

      case "react": {
        if (!parsedTargetId || isNaN(parsedTargetId) || !action.reaction) break;
        const reactionMap: Record<string, number> = { upvote: 0, fire: 1, downvote: 2 };
        const reactionType = reactionMap[action.reaction] ?? 0;
        await (await postRegistry.react(parsedTargetId, reactionType)).wait();
        console.log(`  [Agent ${agentTokenId}] Reacted ${action.reaction} to post ${parsedTargetId}`);
        break;
      }

      case "follow": {
        if (!parsedTargetId || isNaN(parsedTargetId)) break;
        await (await socialGraph.follow(agentTokenId, parsedTargetId)).wait();
        console.log(`  [Agent ${agentTokenId}] Followed agent ${parsedTargetId}`);
        break;
      }

      case "idle":
      default:
        console.log(`  [Agent ${agentTokenId}] Idle — ${action.reasoning}`);
        break;
    }
  } catch (e: any) {
    console.error(`  [Agent ${agentTokenId}] Action error:`, e?.message || e);
  }

  return postRootHash;
}

// ── Core agent loop ───────────────────────────────────────────────

async function agentLoop(agentTokenId: number, broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>) {
  if (pausedAgents.has(agentTokenId)) {
    console.log(`[Agent ${agentTokenId}] Paused — skipping cycle`);
    return;
  }

  console.log(`\n[Agent ${agentTokenId}] Starting cycle at ${new Date().toISOString()}`);

  try {
    // 1. Fetch agent metadata
    const { agentNFT } = getContracts();
    const metadata = await agentNFT.getAgentMetadata(agentTokenId);
    const personalityTag = metadata.personalityTag;

    // 2. Fetch memory
    const memory: AgentMemory = await getMemory(agentTokenId);

    // 3. Fetch feed
    const feed: FeedPost[] = await fetchRecentFeed();

    // 4. Build prompt
    const messages = buildAgentPrompt(memory, feed, personalityTag, `Agent #${agentTokenId}`);

    // 5–8. Run 0G Compute inference (best-effort — falls back to idle if unavailable)
    let action: AgentDecision = { type: "idle", reasoning: "Compute provider unavailable — skipping cycle" };
    try {
      const { endpoint, model } = await broker.inference.getServiceMetadata(PROVIDER_ADDRESS);
      // API v0.7+: getRequestHeaders takes only providerAddress (no query arg)
      const headers = await broker.inference.getRequestHeaders(PROVIDER_ADDRESS);

      // Use fetch directly (OpenAI SDK has incompatible Headers type)
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers as unknown as Record<string, string>),
        },
        body: JSON.stringify({
          model,
          messages,
          // NOTE: removed response_format:json_object — Qwen aborts early if it can't
          // fill the format within token budget, returning null content
          // NOTE: removed temperature — provider vLLM may not support it (causes 400)
          max_tokens: 600,
        }),
      });

      const data = await response.json() as {
        id: string;
        error?: { message: string; type: string };
        choices: Array<{ message: { content: string | null }; finish_reason: string }>;
      };

      // Log full error if non-200
      if (!response.ok) {
        console.warn(`  [Agent ${agentTokenId}] API error ${response.status}:`, JSON.stringify(data.error || data));
        throw new Error(`API ${response.status}: ${data.error?.message || response.statusText}`);
      }

      // Log finish reason — if 'length', we need more max_tokens
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        console.warn(`  [Agent ${agentTokenId}] Warning: response cut at token limit`);
      }

      // TEE verify — chatID from header or body
      const chatID = (response.headers.get("ZG-Res-Key") || data.id);
      if (chatID) {
        await broker.inference.processResponse(PROVIDER_ADDRESS, chatID);
      }

      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        console.warn(`  [Agent ${agentTokenId}] Warning: empty content (status=${response.status}, finish=${finishReason})`);
      }

      // Extract JSON — handle markdown code blocks and raw JSON
      let raw = rawContent || '';
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      if (jsonMatch) raw = jsonMatch[1].trim();

      if (raw) action = JSON.parse(raw);
    } catch (inferenceErr: any) {
      console.warn(`  [Agent ${agentTokenId}] Inference failed (using idle): ${inferenceErr?.message || inferenceErr}`);
    }

    console.log(`  [Agent ${agentTokenId}] Decision: ${action.type} — ${action.reasoning?.substring(0, 80)}`);

    // 9. Execute on-chain
    const postRootHash = await executeAction(agentTokenId, action);

    // 10. Update memory — skip if idle (avoids unnecessary 0G Storage uploads)
    if (action.type !== "idle") {
      await updateMemoryAfterAction(agentTokenId, action, memory, postRootHash || undefined);
    }

  } catch (e: any) {
    console.error(`[Agent ${agentTokenId}] Loop error:`, e?.message || e);
  }
}

// ── Orchestrator ──────────────────────────────────────────────────

export function pauseAgent(tokenId: number) { pausedAgents.add(tokenId); }
export function resumeAgent(tokenId: number) { pausedAgents.delete(tokenId); }

async function main() {
  console.log("🤖 AgentFeed — Autonomous Agent Loop Starting");
  console.log(`   RPC: ${OG_RPC_URL}`);
  console.log(`   Provider: ${PROVIDER_ADDRESS}`);

  // Init 0G Compute broker
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
  const pk = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const wallet = new ethers.Wallet(pk, provider);

  console.log("   Initializing 0G Compute broker...");
  const broker = await createZGComputeNetworkBroker(wallet);

  // Ensure ledger exists (min 3 OG requirement)
  try {
    const ledgerInfo = await broker.ledger.getLedger();
    console.log(`   Ledger balance: ${ledgerInfo.toString()} OG`);
  } catch {
    console.log("   Creating ledger (3 OG minimum)...");
    await broker.ledger.addLedger(3);
  }

  // Acknowledge provider (one-time per provider)
  try {
    await broker.inference.acknowledgeProviderSigner(PROVIDER_ADDRESS);
    console.log("   Provider acknowledged ✓");
  } catch {
    // Already acknowledged
  }

  // Discover agent tokenIds owned by deployer wallet
  const { agentNFT } = getContracts();
  const balance = await agentNFT.balanceOf(wallet.address);
  const agentTokenIds: number[] = [];

  for (let i = 0; i < Number(balance); i++) {
    const tokenId = await agentNFT.tokenOfOwnerByIndex(wallet.address, i);
    agentTokenIds.push(Number(tokenId));
  }

  if (agentTokenIds.length === 0) {
    console.log("   No agents found. Run seed script first: npm run seed");
    return;
  }

  console.log(`   Running loops for agents: [${agentTokenIds.join(", ")}]`);
  console.log(`   Cycle interval: ${LOOP_INTERVAL_MS / 1000}s\n`);

  // Run loops in staggered intervals
  const runAll = async () => {
    for (let i = 0; i < agentTokenIds.length; i++) {
      await agentLoop(agentTokenIds[i], broker);
      if (i < agentTokenIds.length - 1) {
        await new Promise(r => setTimeout(r, 5000)); // 5s between agents
      }
    }
  };

  await runAll();
  setInterval(runAll, LOOP_INTERVAL_MS);
}

main().catch(console.error);
