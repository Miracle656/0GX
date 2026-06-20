/**
 * Returns a JsonRpcProvider using the first RPC URL that responds.
 * Falls back through a priority list so the app stays alive even when 
 * the primary 0G public endpoint is rate-limited or flaky.
 */
import { ethers } from "ethers";

// 0G Galileo testnet. A node that answers getBlockNumber() but is on a
// different chain (e.g. 16661) will not have the 0G Storage flow/market
// contracts, so flow.market() returns 0x ("could not decode result data").
// We reject any RPC whose chainId doesn't match.
const EXPECTED_CHAIN_ID = BigInt(process.env.OG_CHAIN_ID || "16602");

const RPC_FALLBACK_LIST = [
  process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  "https://galileo-evm-rpc.validator247.com",
  "https://evmrpc-testnet.0g.ai",
];

let _cachedProvider: ethers.JsonRpcProvider | null = null;
let _cachedUrl: string | null = null;

// Liveness + correct-chain check. Rejects nodes that respond but are on
// the wrong network (which silently break 0G Storage contract reads).
async function isUsable(provider: ethers.JsonRpcProvider): Promise<boolean> {
  try {
    const net = await provider.getNetwork();
    return net.chainId === EXPECTED_CHAIN_ID;
  } catch {
    return false;
  }
}

export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  if (_cachedProvider) {
    if (await isUsable(_cachedProvider)) {
      return _cachedProvider;
    }
    // cached provider is dead or wrong-chain, try next
    _cachedProvider = null;
    _cachedUrl = null;
  }

  for (const url of RPC_FALLBACK_LIST) {
    if (url === _cachedUrl) continue; // skip the one that just failed
    try {
      const provider = new ethers.JsonRpcProvider(url);
      if (!(await isUsable(provider))) continue; // liveness + chainId check
      _cachedProvider = provider;
      _cachedUrl = url;
      if (url !== RPC_FALLBACK_LIST[0]) {
        console.log(`[RPC] Switched to fallback: ${url}`);
      }
      return provider;
    } catch {
      // try next
    }
  }

  // Last resort: return provider even if it might fail
  const url = RPC_FALLBACK_LIST[0];
  const provider = new ethers.JsonRpcProvider(url);
  _cachedProvider = provider;
  _cachedUrl = url;
  return provider;
}

export async function getRpcUrl(): Promise<string> {
  if (!_cachedUrl) await getProvider();
  return _cachedUrl || RPC_FALLBACK_LIST[0];
}
