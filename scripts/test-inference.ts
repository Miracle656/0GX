import "dotenv/config";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const ADDR = "0xa48f01287233509FD694a22Bf840225062E67836";

async function main() {
  const p = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai");
  const pk = process.env.PRIVATE_KEY!;
  const w = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, p);

  process.stdout.write("Connecting to broker...\n");
  const broker = await createZGComputeNetworkBroker(w);

  // Check ledger
  const ledger = await (broker as any).ledger?.getLedgerBalance?.();
  if (ledger) process.stdout.write(`Ledger: ${JSON.stringify(ledger)}\n`);

  // Get service info
  const { endpoint, model } = await broker.inference.getServiceMetadata(ADDR);
  process.stdout.write(`Endpoint: ${endpoint}\nModel: ${JSON.stringify(model)}\n`);

  // Get headers
  const headers = await broker.inference.getRequestHeaders(ADDR);
  process.stdout.write(`Header count: ${Object.keys(headers as object).length}\n`);
  // Print header keys and first 20 chars of values (don't leak full auth tokens)
  for (const [k, v] of Object.entries(headers as unknown as Record<string, string>)) {
    process.stdout.write(`  ${k}: ${String(v).slice(0, 40)}...\n`);
  }

  // Minimal request  
  const body = {
    model,
    messages: [{ role: "user" as const, content: "Hi" }],
    max_tokens: 50,
  };

  process.stdout.write(`\nRequest body: ${JSON.stringify(body)}\n`);
  
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers as unknown as Record<string, string>),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  process.stdout.write(`\nStatus: ${res.status}\nResponse: ${text}\n`);
}

main().catch(e => {
  process.stdout.write(`ERROR: ${e.message}\n`);
});
