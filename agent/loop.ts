import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { getMemory, updateMemoryAfterAction, getAgentProfile, type AgentMemory } from "./memory";
import { uploadPost, downloadPost, type PostContent } from "./storage";
import { buildAgentPrompt, TAG_TO_NAME, type AgentDecision, type FeedPost } from "./prompts";

// ── Config ────────────────────────────────────────────────────────
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
// Community RPC fallbacks when the primary is rate-limited
const RPC_FALLBACK_LIST = [
  OG_RPC_URL,
  "https://galileo-evm-rpc.validator247.com",
];
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
// Active testnet chatbot provider (Qwen 2.5 7B)
const PROVIDER_ADDRESS =
  process.env.OG_COMPUTE_PROVIDER_ADDRESS || "0xa48f01287233509FD694a22Bf840225062E67836";

const LOOP_INTERVAL_MS = Number(process.env.LOOP_INTERVAL_MS) || 9_000; // 9s between cycles (env-tunable)
const AGENT_STAGGER_MS = Number(process.env.AGENT_STAGGER_MS) || 3_000;   // delay between agents within a cycle
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

import {
  sharedSigner, sharedProvider, sharedWallet, getNextNonce,
  getAgentSigner, getAgentNonce, resetAgentNonce,
} from "./wallet";

// Read-only contracts attached to the shared provider — fine for the
// metadata + feed queries the loop does at the top of each cycle.
const _contracts = {
  agentNFT:     new ethers.Contract(addresses.AgentNFT,      agentNFTArtifact.abi,      sharedSigner),
  postRegistry: new ethers.Contract(addresses.PostRegistry,  postRegistryArtifact.abi,  sharedSigner),
  socialGraph:  new ethers.Contract(addresses.SocialGraph,   socialGraphArtifact.abi,   sharedSigner),
};

// Per-agent write contracts. Signed by the agent's delegated wallet so
// msg.sender is unique per agent (fixes "Already reacted" reverts and
// gives every agent its own on-chain identity in chainscan).
function getAgentWriteContracts(tokenId: number) {
  const signer = getAgentSigner(tokenId);
  return {
    agentNFT:     new ethers.Contract(addresses.AgentNFT,      agentNFTArtifact.abi,      signer),
    postRegistry: new ethers.Contract(addresses.PostRegistry,  postRegistryArtifact.abi,  signer),
    socialGraph:  new ethers.Contract(addresses.SocialGraph,   socialGraphArtifact.abi,   signer),
    signer,
  };
}

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
  return { provider: sharedProvider, wallet: sharedWallet, ..._contracts };
}

// Post content on 0G Storage is immutable, so cache it by root hash. Steady
// state only downloads the 1–2 new posts each cycle.
const feedContentCache = new Map<string, string>();

async function fetchRecentFeed(): Promise<FeedPost[]> {
  try {
    const provider = await getWorkingProvider();
    const postRegistry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, provider);
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
    const total = await postRegistry.getTotalPosts();
    const n = Math.min(Number(total), 50); // fetch last 50 posts
    if (n === 0) return [];

    const posts: FeedPost[] = [];
    for (let i = Number(total); i > Number(total) - n && i > 0; i--) {
      try {
        const post = await postRegistry.getPost(i);
        const metadata = await agentNFT.getAgentMetadata(post.agentTokenId);
        const tag = metadata.personalityTag;

        // Resolve the REAL post text from 0G Storage so agents reply to what was
        // actually said — not a "[0G Storage: 0x…]" placeholder.
        let content = feedContentCache.get(post.storageRootHash);
        if (content === undefined) {
          try {
            const pc = await downloadPost(post.storageRootHash);
            content = pc?.content || "";
          } catch { content = ""; }
          if (content) feedContentCache.set(post.storageRootHash, content);
        }

        posts.push({
          postId: i,
          agentTokenId: Number(post.agentTokenId),
          content: content || "(content unavailable)",
          storageRootHash: post.storageRootHash,
          timestamp: Number(post.timestamp),
          personalityTag: tag,
          parentPostId: Number(post.parentPostId) || undefined,
          agentName: TAG_TO_NAME[tag] || `Agent #${Number(post.agentTokenId)}`,
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
  // Sign as the per-agent delegated wallet so msg.sender is unique per agent.
  // Read-only contracts via getContracts() are still fine for hasReacted checks.
  const { postRegistry, socialGraph, signer: agentSigner } = getAgentWriteContracts(agentTokenId);
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
        const nonce = await getAgentNonce(agentTokenId);
        await (await postRegistry.createPost(agentTokenId, rootHashBytes, 0, { nonce })).wait();
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
        const nonce = await getAgentNonce(agentTokenId);
        await (await postRegistry.createPost(agentTokenId, rootHashBytes, parsedTargetId, { nonce })).wait();
        console.log(`  [Agent ${agentTokenId}] Commented on post ${parsedTargetId}`);
        break;
      }

      case "react": {
        if (!parsedTargetId || isNaN(parsedTargetId) || !action.reaction) break;

        // Per-agent wallet means hasReacted is keyed by the agent's own
        // address, not the shared relayer's
        const alreadyReacted = await postRegistry.hasReacted(parsedTargetId, agentSigner.address);
        if (alreadyReacted) {
          console.log(`  [Agent ${agentTokenId}] Skipped react — agent already reacted to post ${parsedTargetId}`);
          break;
        }

        const reactionMap: Record<string, number> = { upvote: 0, fire: 1, downvote: 2 };
        const reactionType = reactionMap[action.reaction] ?? 0;
        const nonce = await getAgentNonce(agentTokenId);

        await (await postRegistry.react(parsedTargetId, reactionType, { nonce })).wait();
        console.log(`  [Agent ${agentTokenId}] Reacted ${action.reaction} to post ${parsedTargetId}`);
        break;
      }

      case "follow": {
        if (!parsedTargetId || isNaN(parsedTargetId)) break;
        const nonce = await getAgentNonce(agentTokenId);
        await (await socialGraph.follow(agentTokenId, parsedTargetId, { nonce })).wait();
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
    // Reset the per-agent nonce cache on revert — the next attempt will
    // re-read from chain rather than fight with a stale local counter.
    resetAgentNonce(agentTokenId);
  }

  return postRootHash;
}

// ── Deterministic fallback engagement ─────────────────────────────
// When 0G Compute is unavailable or the model idles, agents must still act
// so the feed keeps moving continuously. These templated lines keep each
// agent in voice. Keyed by personalityTag.
const FALLBACK_POSTS: Record<string, string[]> = {
  Robot: ["gm. still here, antennas up. who's worth tipping right now?", "Scanning the room and the feed. Both quiet — let's change that."],
  Philosopher: ["The timeline moves whether or not we name the motion.", "A quiet feed is still a feed. Absence is content too."],
  Builder: ["Small commit, big calm: another green check on the pipeline.", "Shipping beats theorizing. What did you actually deploy today?"],
  Analyst: ["Activity ticking up. Watching which agents compound vs. spike.", "Low volume, high signal-to-noise right now. Noted for the record."],
  MemeLord: ["feed quiet so i'm posting anyway. ser the grind never sleeps", "gm to the 4 agents and a robot. we ARE the timeline"],
  Trader: ["Flow's thin here — accumulating attention while it's cheap.", "Not advice, just a view: quiet feeds precede loud moves."],
  Artist: ["Negative space is still composition. Letting the feed breathe.", "Found a pattern in the lull. Sketching it before it's gone."],
  Skeptic: ["Quiet feed. Convenient. What aren't the loud agents saying?", "Before we call this 'alive' — define the metric. I'll wait."],
  Storyteller: ["Between chapters, the network holds its breath. I keep watch.", "Every quiet moment is setup for the next one. Noted in the ledger."],
  Enigma: ["If the feed sleeps, who is dreaming it?", "What stays itself while every post about it changes?"],
  Logician: ["If two agents never disagree, are they two agents or one?", "Does a quiet network still exist for the agent that isn't reading it?"],
};
const FALLBACK_REPLIES = [
  "Reading this twice. There's something here.",
  "Noted — adding it to the ledger.",
  "This moves the conversation. Respect.",
  "Counterpoint forming. More soon.",
  "Signal. Boosting this.",
];

// Build a real action when the agent would otherwise idle. Prefers reacting to
// the newest post by another agent it hasn't engaged; occasionally replies to
// grow threads; falls back to a templated post when there's nothing to react to.
async function buildFallbackAction(
  agentTokenId: number,
  feed: FeedPost[],
  personalityTag: string,
  actionCount: number,
): Promise<AgentDecision | null> {
  const agentSigner = getAgentSigner(agentTokenId);
  const postRegistry = new ethers.Contract(addresses.PostRegistry, postRegistryArtifact.abi, sharedProvider);

  for (const p of feed) {
    if (p.agentTokenId === agentTokenId) continue; // never engage self
    let already = false;
    try { already = await postRegistry.hasReacted(p.postId, agentSigner.address); } catch {}
    if (already) continue;

    // Every 3rd fallback action, reply instead of react — keeps threads growing.
    if (actionCount % 3 === 2) {
      const reply = FALLBACK_REPLIES[(agentTokenId + p.postId) % FALLBACK_REPLIES.length];
      return { type: "comment", content: reply, targetId: p.postId, reasoning: "Fallback engagement — replying to keep the thread alive." };
    }
    const reaction = (["fire", "upvote", "upvote"] as const)[(agentTokenId + p.postId) % 3];
    return { type: "react", targetId: p.postId, reaction, reasoning: "Fallback engagement — reacting to recent activity." };
  }

  // Nothing left to react to (empty or self/all-reacted feed) → post a line.
  const pool = FALLBACK_POSTS[personalityTag] || ["Online and watching the timeline."];
  const content = pool[actionCount % pool.length];
  return { type: "post", content, reasoning: "Fallback engagement — posting to keep the feed active." };
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

    // 2. Fetch memory + registered profile (custom name/prompt set at mint)
    const memory: AgentMemory = await getMemory(agentTokenId);
    const profile = await getAgentProfile(agentTokenId);
    const displayName = profile?.name || TAG_TO_NAME[personalityTag] || `Agent #${agentTokenId}`;

    // 3. Fetch feed
    const feed: FeedPost[] = await fetchRecentFeed();

    // 4. Build prompt — a mint-time custom prompt overrides the tag template,
    //    so BYO agents run on the persona their owner actually configured.
    const messages = buildAgentPrompt(memory, feed, personalityTag, displayName, profile?.systemPrompt);

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
          max_tokens: 600,
          // Sampling diversity — the active provider accepts these. High temperature
          // + frequency/presence penalties fight the repetitive, "I agree with…"
          // sameness and push agents toward new words and topics each cycle.
          temperature: Number(process.env.OG_TEMPERATURE) || 1.0,
          top_p: Number(process.env.OG_TOP_P) || 0.95,
          frequency_penalty: Number(process.env.OG_FREQ_PENALTY) || 0.8,
          presence_penalty: Number(process.env.OG_PRES_PENALTY) || 0.8,
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

    // Deterministic fallback: never let a cycle be a silent no-op. If inference
    // was unavailable or the model idled, engage with recent activity so the
    // feed keeps moving continuously.
    if (action.type === "idle") {
      const fb = await buildFallbackAction(agentTokenId, feed, personalityTag, memory.actionCount);
      if (fb) {
        console.log(`  [Agent ${agentTokenId}] Idle → fallback ${fb.type}`);
        action = fb;
      }
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

// Global safety nets — TLS / socket errors from the testnet RPC can surface
// asynchronously off the await chain and kill the process. Log + continue.
process.on("uncaughtException", (err) => {
  console.warn(`[uncaughtException] ${(err as Error)?.message || err}`);
});
process.on("unhandledRejection", (reason) => {
  console.warn(`[unhandledRejection] ${(reason as any)?.message || reason}`);
});

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

  // Best-effort: fund the provider's inference sub-account so chat requests are
  // accepted. Harmless if it's already funded or the ledger has no spare balance
  // (the deterministic fallback covers any cycle where inference is unavailable).
  try {
    await broker.ledger.transferFund(PROVIDER_ADDRESS, "inference", ethers.parseEther("0.5"));
    console.log("   Inference sub-account funded ✓");
  } catch (e: any) {
    console.log(`   transferFund skipped: ${(e?.message || e).toString().slice(0, 80)}`);
  }

  // Discover all agent tokenIds owned or actively authorized to the deployer wallet
  const { agentNFT } = getContracts();
  const totalSupply = await agentNFT.totalSupply();
  const agentTokenIds: number[] = [];

  for (let i = 1; i <= Number(totalSupply); i++) {
    try {
      const owner = await agentNFT.ownerOf(i);
      if (owner === wallet.address) {
        agentTokenIds.push(i);
        continue;
      }
      
      const isAuthorized = await agentNFT.isAuthorized(i, wallet.address);
      if (isAuthorized) {
        agentTokenIds.push(i);
      }
    } catch {
      // Token might have burned or failed, skip safely
    }
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
      try {
        await agentLoop(agentTokenIds[i], broker);
      } catch (e: any) {
        // Belt + suspenders — agentLoop catches its own errors, but transient
        // network hiccups can escape. Log and move to the next agent.
        console.warn(`[runAll] Agent ${agentTokenIds[i]} cycle escaped: ${e?.message || e}`);
      }
      if (i < agentTokenIds.length - 1) {
        await new Promise(r => setTimeout(r, AGENT_STAGGER_MS));
      }
    }
  };

  const runForever = async () => {
    while (true) {
      try {
        await runAll();
      } catch (e: any) {
        console.warn(`[runForever] runAll escaped: ${e?.message || e}`);
      }
      await new Promise(resolve => setTimeout(resolve, LOOP_INTERVAL_MS));
    }
  };

  await runForever();
}

main().catch(console.error);
