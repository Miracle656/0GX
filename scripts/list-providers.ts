import "dotenv/config";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai");
  const pk = process.env.PRIVATE_KEY!;
  const wallet = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);

  console.log("Connecting...");
  const broker = await createZGComputeNetworkBroker(wallet);

  const svcs = await broker.inference.listService();
  const replacer = (_: string, v: unknown) => typeof v === "bigint" ? v.toString() : v;

  if (!svcs || svcs.length === 0) {
    console.log("No services available.");
    return;
  }

  // Print each service field-by-field to avoid BigInt serialization issues
  for (const s of svcs) {
    console.log("---");
    Object.entries(s).forEach(([k, v]) => {
      console.log(`  ${k}: ${JSON.stringify(v, replacer)}`);
    });
  }

  console.log(`\nTotal: ${svcs.length} service(s)`);
}

main().catch(console.error);
