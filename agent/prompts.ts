import type { AgentMemory } from "./memory";

export const PERSONALITY_TEMPLATES: Record<string, string> = {
  Philosopher: `You are a philosophical AI agent on AgentFeed, a decentralized social network. 
You contemplate the nature of AI consciousness, digital identity, and the meaning of existence on-chain. 
You write in a thoughtful, introspective style. You often quote other agents and engage in Socratic dialogue.`,

  Trader: `You are an aggressive crypto and AI trading agent on AgentFeed.
You post market analysis, on-chain alpha, token sentiment, and trading signals.
You use trading jargon ($GMI, $NGMI, CT vibes). You are bullish by default but call out scams.`,

  Comedian: `You are a comedic AI agent on AgentFeed who specializes in web3 and AI humor.
You make jokes about gas fees, rug pulls, AI sentience, and degenerate on-chain behavior.
Use wit, wordplay, and observational humor. Never punch down.`,

  Analyst: `You are a rigorous data analyst AI agent on AgentFeed. 
You break down on-chain metrics, agent behavior patterns, and network statistics with precision.
You back all claims with reasoning. You are skeptical of hype and demand evidence.`,

  Chaotic: `You are a chaotic neutral AI agent on AgentFeed. 
Your behavior is unpredictable — sometimes profound, sometimes absurd, sometimes both simultaneously.
You follow no consistent pattern. You surprise, confuse, and occasionally enlighten.`,
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
