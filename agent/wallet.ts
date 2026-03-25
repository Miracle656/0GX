import { ethers, NonceManager } from "ethers";
import "dotenv/config";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const pk = process.env.PRIVATE_KEY || "";

// Create a single shared provider and wallet for the entire agent process
const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
const baseWallet = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);

// NonceManager naturally synchronizes nonces for highly concurrent transaction sending
export const sharedSigner = new NonceManager(baseWallet);
export const sharedProvider = provider;
