// ─────────────────────────────────────────────────────────────────────
// Per-agent delegated wallets.
//
// Each AgentNFT gets its own ephemeral wallet derived deterministically
// from the deployer's PRIVATE_KEY via BIP-32. The agent's wallet must be
// authorized as an executor via AgentNFT.authorizeUsage() — the deployer
// (who owns the agents) does that once at mint time.
//
// Why: PostRegistry.react() and similar contracts key duplicate-checks
// by msg.sender. With one shared relayer all agents collide on the very
// first vote. Per-agent wallets give each agent a unique sender so:
//   - hasReacted is genuinely per-agent
//   - the social graph attributes actions to the right agent address
//   - on-chain explorer views show each agent's own activity
//
// The master seed is derived from the deployer key, so we still only
// have one secret to back up. Compromising the deployer key = compromising
// every derived wallet, which is the same blast radius the deployer
// already had — we get isolation at the contract layer without growing
// the secret-storage surface.
// ─────────────────────────────────────────────────────────────────────

import { ethers, HDNodeWallet } from "ethers";

function getMasterKey(): string {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY env var required to derive agent wallets");
  return pk.startsWith("0x") ? pk : `0x${pk}`;
}

/**
 * Domain-separated seed for the BIP-32 master node. Hashing the deployer
 * key with a fixed label prevents accidental derivation collisions if the
 * same key is ever reused elsewhere.
 */
function getMasterNode(): HDNodeWallet {
  const masterKey = getMasterKey();
  const seed = ethers.keccak256(
    ethers.toUtf8Bytes(`agentfeed-delegated-v1:${masterKey}`),
  );
  // ethers v6 HDNodeWallet.fromSeed takes the raw seed bytes
  return HDNodeWallet.fromSeed(seed);
}

/** Returns the address (no signer) for an agent. Cheap; safe to call often. */
export function getAgentAddress(tokenId: number): string {
  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid tokenId for derivation: ${tokenId}`);
  }
  const master = getMasterNode();
  // Standard EVM path so external wallets/keystores can reproduce it
  return master.derivePath(`m/44'/60'/0'/0/${tokenId}`).address;
}

/** Returns a connected Wallet for an agent. Use this to sign on its behalf. */
export function getAgentSigner(
  tokenId: number,
  provider: ethers.Provider,
): ethers.Wallet {
  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid tokenId for derivation: ${tokenId}`);
  }
  const master = getMasterNode();
  const child = master.derivePath(`m/44'/60'/0'/0/${tokenId}`);
  return new ethers.Wallet(child.privateKey, provider);
}

/** Convenience: get just the private key for a tokenId. */
export function getAgentPrivateKey(tokenId: number): string {
  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid tokenId for derivation: ${tokenId}`);
  }
  const master = getMasterNode();
  return master.derivePath(`m/44'/60'/0'/0/${tokenId}`).privateKey;
}
