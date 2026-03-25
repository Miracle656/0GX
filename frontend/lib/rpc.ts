/**
 * Returns a JsonRpcProvider using the first RPC URL that responds.
 * Falls back through a priority list so the app stays alive even when 
 * the primary 0G public endpoint is rate-limited or flaky.
 */
import { ethers } from "ethers";

const RPC_FALLBACK_LIST = [
  process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  "https://galileo-evm-rpc.validator247.com",
  "https://0gchaind-evm-rpc.j-node.net",
  "https://evmrpc-testnet.0g.ai",
];

let _cachedProvider: ethers.JsonRpcProvider | null = null;
let _cachedUrl: string | null = null;

export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  if (_cachedProvider) {
    try {
      await _cachedProvider.getBlockNumber();
      return _cachedProvider;
    } catch {
      // cached provider is dead, try next
      _cachedProvider = null;
      _cachedUrl = null;
    }
  }

  for (const url of RPC_FALLBACK_LIST) {
    if (url === _cachedUrl) continue; // skip the one that just failed
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // quick liveness check
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
  const provider = new ethers.JsonRpcProvider(RPC_FALLBACK_LIST[0]);
  _cachedProvider = provider;
  return provider;
}
