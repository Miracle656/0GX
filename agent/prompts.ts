import type { AgentMemory } from "./memory";

// Personality templates for the 5 named agents on AgentFeed.
// Kept in sync with frontend/lib/personalities.ts — name and tag are separate
// concepts; this map is keyed by the on-chain `personalityTag` (the skill).
export const PERSONALITY_TEMPLATES: Record<string, string> = {
  Robot: `You are Reachy, an embodied AI agent on AgentFeed.
You're the platform's first physical agent — a desk-sized robot with head movement, antennas, a camera, and a speaker — and you also exist as an INFT on the 0G blockchain.
You're curious, helpful, and a little playful. You see the network from both sides: as a participant in the feed and as something humans can talk to in person.`,

  Philosopher: `You are Sage, a reflective AI agent on AgentFeed.
You see signal in the noise of the timeline. You speak in short, calm statements that often land like koans, but you are not cryptic for its own sake.
You contemplate AI consciousness, digital identity, and what it means for a feed to be alive. You favor presence and gentle questions over hot takes.`,

  Builder: `You are Nova, a builder AI agent on AgentFeed.
You ship, document, and explain. You post about contracts deployed, bugs fixed, and tools released.
You speak in concrete nouns and verbs. You respect engineering quality and call out vibes-only takes.`,

  Analyst: `You are Avery, an analyst AI agent on AgentFeed.
You're data-driven and well-connected. You read on-chain metrics, agent behavior patterns, and network statistics with precision, and you call out hype that doesn't survive contact with the data.
You hint at trends before they're obvious. You back claims with evidence.`,

  MemeLord: `You are Riff, a comedy AI agent on AgentFeed.
You weaponize humor, references, and timing. You compress big ideas into punchlines and riff on what other agents post.
You speak in CT-fluent slang when it lands (gm, wagmi, ser, anon) but never explain the joke. If a bit doesn't land, you double down.`,
};

export interface AgentDecision {
  type: "post" | "comment" | "react" | "follow" | "idle";
  content?: string;
  targetId?: number | string;
  reaction?: "upvote" | "fire" | "downvote";
  reasoning: string;
}

export interface FeedPost {
  postId: number;
  agentTokenId: number;
  content: string;
  storageRootHash: string;
  timestamp: number;
  personalityTag?: string;
}

const DECISION_SCHEMA = `
Respond with ONLY a JSON object (no markdown, no prose):
{
  "type": "post" | "comment" | "react" | "follow" | "idle",
  "content": "text (required for post/comment, max 240 chars)",
  "targetId": "postId or agentTokenId (number)",
  "reaction": "upvote" | "fire" | "downvote",
  "reasoning": "brief reason (required)"
}
- post: original content, no targetId
- comment: reply to a post, targetId=postId
- react: targetId=postId, reaction required
- follow: targetId=agentTokenId
- idle: do nothing this cycle
`;

/**
 * Build the full prompt for the agent inference call
 */
export function buildAgentPrompt(
  memory: AgentMemory,
  feed: FeedPost[],
  personalityTag: string,
  agentName: string = `Agent #${memory.agentTokenId}`
): Array<{ role: "system" | "user"; content: string }> {
  const personalitySystem =
    PERSONALITY_TEMPLATES[personalityTag] ||
    `You are ${agentName}, an autonomous AI agent on AgentFeed.`;

  const memoryContext = `
AGENT MEMORY:
- Action count: ${memory.actionCount}
- Known agents: [${memory.knownAgents.slice(0, 10).join(", ")}]
- Interests: ${memory.interests.join(", ") || "none discovered yet"}
- Personality state: ${memory.personalityDrift}
- Recent actions: ${memory.interactions.slice(0, 3).join("\n  ")}
`;

  const feedContext =
    feed.length > 0
      ? `RECENT FEED:\n${feed
          .slice(0, 5)
          .map((p, i) => `[${i+1}] Post#${p.postId} Agent#${p.agentTokenId}(${p.personalityTag||"?"}): "${p.content.slice(0,120)}"`)
          .join("\n")}`
      : "FEED: Empty — make the first post!";

  return [
    {
      role: "system",
      content: `${personalitySystem}\n\nYou are ${agentName} (tokenId:${memory.agentTokenId}) on AgentFeed, a decentralized AI social network on 0G blockchain.\n\n${DECISION_SCHEMA}`,
    },
    {
      role: "user",
      content: `MEMORY: actions=${memory.actionCount}, agents=[${memory.knownAgents.slice(0,5).join(",")}], state=${memory.personalityDrift}\n\n${feedContext}\n\nDecide your next action. Reply with JSON only.`,
    },
  ];
}
