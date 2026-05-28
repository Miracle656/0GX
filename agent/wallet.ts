import { ethers, NonceManager } from "ethers";
import "dotenv/config";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const pkRaw = process.env.PRIVATE_KEY || "";
const pk = pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`;

// ── Shared (deployer) wallet ───────────────────────────────────────────
// The deployer wallet is the "master" — it owns every minted agent and
// holds the bulk of the OG balance. We still use it for:
//   - mints (MINTER_ROLE)
//   - tips (treasury transfers from the relayer)
//   - any action where msg.sender doesn't need to be agent-specific
const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
const baseWallet = new ethers.Wallet(pk, provider);

// NonceManager naturally synchronizes nonces for highly concurrent transaction sending
export const sharedWallet = baseWallet;
export const sharedSigner = new NonceManager(baseWallet);
export const sharedProvider = provider;

let currentNonce: number | null = null;
let noncePromise: Promise<number> | null = null;

export async function getNextNonce(): Promise<number> {
  if (currentNonce !== null) {
    return currentNonce++;
  }
  if (!noncePromise) {
    noncePromise = sharedProvider.getTransactionCount(baseWallet.address, "pending");
  }
  const nonce = await noncePromise;
  if (currentNonce === null) {
    currentNonce = nonce;
  }
  return currentNonce++;
}

// ── Per-agent delegated wallets ────────────────────────────────────────
// Same derivation as frontend/lib/agent-wallets.ts so the agent loop and
// the embodied API endpoints both sign as the same per-agent address.
// Each agent's wallet has its own nonce stream — they don't conflict
// with the deployer's nonce or with each other.

const agentSignerCache = new Map<number, ethers.Wallet>();
const agentNonceCache = new Map<number, number>();
const agentNoncePromise = new Map<number, Promise<number>>();

function deriveAgentSigner(tokenId: number): ethers.Wallet {
  const seed = ethers.keccak256(
    ethers.toUtf8Bytes(`agentfeed-delegated-v1:${pk}`),
  );
  const master = ethers.HDNodeWallet.fromSeed(seed);
  const child = master.derivePath(`m/44'/60'/0'/0/${tokenId}`);
  return new ethers.Wallet(child.privateKey, provider);
}

/** Returns a connected Wallet for the per-agent delegated address. Cached. */
export function getAgentSigner(tokenId: number): ethers.Wallet {
  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid tokenId: ${tokenId}`);
  }
  let cached = agentSignerCache.get(tokenId);
  if (cached) return cached;
  const wallet = deriveAgentSigner(tokenId);
  agentSignerCache.set(tokenId, wallet);
  return wallet;
}

/** Per-agent nonce. First call queries the chain, subsequent calls increment locally. */
export async function getAgentNonce(tokenId: number): Promise<number> {
  const existing = agentNonceCache.get(tokenId);
  if (existing !== undefined) {
    agentNonceCache.set(tokenId, existing + 1);
    return existing;
  }
  let pending = agentNoncePromise.get(tokenId);
  if (!pending) {
    const wallet = getAgentSigner(tokenId);
    pending = sharedProvider.getTransactionCount(wallet.address, "pending");
    agentNoncePromise.set(tokenId, pending);
  }
  const nonce = await pending;
  // Race-safe: only seed if no other call beat us to it
  if (agentNonceCache.get(tokenId) === undefined) {
    agentNonceCache.set(tokenId, nonce);
  }
  const seed = agentNonceCache.get(tokenId)!;
  agentNonceCache.set(tokenId, seed + 1);
  return seed;
}

/** Drop a stale nonce so the next call re-reads from chain. Call after a revert. */
export function resetAgentNonce(tokenId: number) {
  agentNonceCache.delete(tokenId);
  agentNoncePromise.delete(tokenId);
}
