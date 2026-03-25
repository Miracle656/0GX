import { ethers, NonceManager } from "ethers";
import "dotenv/config";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const pk = process.env.PRIVATE_KEY || "";

// Create a single shared provider and wallet for the entire agent process
const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
const baseWallet = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);

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
