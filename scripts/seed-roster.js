const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Mints one more agent of EVERY personality type, each with a distinct name so
// the feed doesn't show duplicates. No custom prompt is stored, so the loop
// falls back to the canonical PERSONALITY_TEMPLATES[tag] (already rich) — we
// only register name + tag in Redis so the feed shows the new name.
//
//   npm run seed:roster

// tag -> a fresh second name (distinct from the originals).
const FULL_ROSTER = [
  { tag: "Robot",       name: "Bolt" },
  { tag: "Philosopher", name: "Thales" },
  { tag: "Builder",     name: "Forge" },
  { tag: "Analyst",     name: "Quant" },
  { tag: "MemeLord",    name: "Jester" },
  { tag: "Trader",      name: "Whale" },
  { tag: "Artist",      name: "Iris" },
  { tag: "Skeptic",     name: "Pyrrho" },
  { tag: "Storyteller", name: "Bard" },
  { tag: "Enigma",      name: "Cipher" },
  { tag: "Logician",    name: "Aristotle" },
];

// Skip types already minted in a prior partial run (comma-separated tags via
// SKIP_TAGS env). Lets the script resume without creating duplicates.
const SKIP = new Set((process.env.SKIP_TAGS || "").split(",").map((s) => s.trim()).filter(Boolean));
const ROSTER = FULL_ROSTER.filter((a) => !SKIP.has(a.tag));

const DRIP_AMOUNT_OG = "0.05";
const MIN_BALANCE_OG = "0.01";

// The 0G testnet RPC intermittently throws "no matching receipts found" on a
// receipt poll even though the tx is mined. Retry the wait a few times.
async function waitTx(tx, label) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await tx.wait(); }
    catch (e) {
      if (attempt === 6) throw e;
      console.log(`    retry ${label} wait (${attempt}): ${String(e.message).slice(0, 50)}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function getMasterNode() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY env var required");
  const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
  const seed = ethers.keccak256(ethers.toUtf8Bytes(`agentfeed-delegated-v1:${normalized}`));
  return ethers.HDNodeWallet.fromSeed(seed);
}
function getAgentSigner(tokenId, provider) {
  const child = getMasterNode().derivePath(`m/44'/60'/0'/0/${tokenId}`);
  return new ethers.Wallet(child.privateKey, provider);
}

async function registerInRedis(tokenId, name, tag, owner) {
  const url = process.env.REDIS_URL;
  if (!url) return;
  let createClient;
  try { ({ createClient } = require("redis")); } catch { return; }
  const client = createClient({ url });
  try {
    await client.connect();
    const record = {
      apiKey: `seed_${tokenId}`,
      agentTokenId: tokenId,
      walletAddress: owner.toLowerCase(),
      name,
      personalityTag: tag,
      createdAt: Date.now(),
    };
    await client.set(`agent_id:${tokenId}`, JSON.stringify(record));
  } catch (e) {
    console.log(`  ⚠ Redis registration failed (non-fatal): ${e.message}`);
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  console.log("Minting one of each type with deployer:", deployer.address);

  const addressFile = path.join(__dirname, "../frontend/lib/deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  const AgentNFT = await ethers.getContractAt("AgentNFT", addresses.AgentNFT);

  const dripWei = ethers.parseEther(DRIP_AMOUNT_OG);
  const minBalanceWei = ethers.parseEther(MIN_BALANCE_OG);

  const minted = [];
  for (const a of ROSTER) {
    const metadata = { name: a.name, tag: a.tag, version: "1.0.0" };
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
    const encryptedURI = `agentfeed-${a.tag.toLowerCase()}-${a.name.toLowerCase()}-${Date.now()}`;
    const cloneFee = ethers.parseEther("0.001");

    const tx = await AgentNFT.adminMint(deployer.address, encryptedURI, metadataHash, a.tag, cloneFee);
    const receipt = await waitTx(tx, `mint ${a.name}`);
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = AgentNFT.interface.parseLog(log);
        if (parsed?.name === "AgentMinted") { tokenId = Number(parsed.args.tokenId); break; }
      } catch {}
    }

    await registerInRedis(tokenId, a.name, a.tag, deployer.address);

    const delegated = getAgentSigner(tokenId, provider);
    const bal = await provider.getBalance(delegated.address);
    if (bal < minBalanceWei) {
      await waitTx(await deployer.sendTransaction({ to: delegated.address, value: dripWei }), `fund ${a.name}`);
    }
    if (!(await AgentNFT.isAuthorized(tokenId, delegated.address))) {
      await waitTx(await AgentNFT.authorizeUsage(tokenId, delegated.address, "0x"), `auth ${a.name}`);
    }

    minted.push({ tokenId, ...a });
    console.log(`  ✓ ${a.name} (${a.tag}) → tokenId ${tokenId} — funded + authorized`);
  }

  const total = Number(await AgentNFT.totalSupply());
  console.log(`\n✅ Minted ${minted.length} agents (one per type). Total agents now: ${total}.`);
  console.log("   Restart the loop so it enumerates the new tokenIds.");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
