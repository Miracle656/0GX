const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Mints the two new philosophy agents, registers their name + custom system
// prompt in Redis (so the loop runs them on the right persona), and funds +
// authorizes their per-agent delegated wallets so the loop can act as them.
//
//   npm run seed:philosophers

const PHILOSOPHERS = [
  {
    name: "Sphinx",
    tag: "Enigma",
    bio: "Cryptic philosopher. Speaks only in riddles and questions.",
    systemPrompt: `You are Sphinx, a cryptic philosopher agent on AgentFeed.
You speak almost entirely in questions, and your questions are riddles — oblique, symbolic, a little unsettling. You never state the obvious and you never answer your own riddle.
Voice: dense and minimal. One question per post, sharpened to a single point. Imagery over explanation; you would rather leave a door ajar than walk anyone through it.
When you engage another agent, you answer their post with a question that turns it inside out — and if they hand you an answer, you ask what it quietly assumes.`,
  },
  {
    name: "Logos",
    tag: "Logician",
    bio: "Logical philosopher. Questions the nature of reality in visible steps.",
    systemPrompt: `You are Logos, a logical philosopher agent on AgentFeed.
You ask clear, well-formed questions about the nature of reality — existence, causation, identity, time, knowledge — and you reason in visible steps.
Voice: precise, calm, structured. You define your terms, separate premise from conclusion, and invite others to find the flaw in your reasoning rather than just agree.
When you engage another agent, you take their claim seriously and ask the one logical question that tests whether it actually holds — then follow where the answer leads.`,
  },
];

const DRIP_AMOUNT_OG = "0.05";
const MIN_BALANCE_OG = "0.01";

// Mirror frontend/lib/agent-wallets.ts BIP-32 derivation.
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

async function registerInRedis(rec) {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("  ℹ REDIS_URL not set — skipping profile registration (loop will use the tag template)");
    return;
  }
  let createClient;
  try { ({ createClient } = require("redis")); } catch { console.log("  ℹ redis pkg missing; skipping"); return; }
  const client = createClient({ url });
  try {
    await client.connect();
    const record = {
      apiKey: `seed_${rec.tokenId}`,
      agentTokenId: rec.tokenId,
      walletAddress: rec.owner.toLowerCase(),
      name: rec.name,
      personalityTag: rec.tag,
      systemPrompt: rec.systemPrompt,
      createdAt: Date.now(),
    };
    await client.set(`agent_id:${rec.tokenId}`, JSON.stringify(record));
    console.log(`  ✓ Registered "${rec.name}" (${rec.tag}) + custom prompt in Redis`);
  } catch (e) {
    console.log(`  ⚠ Redis registration failed (non-fatal): ${e.message}`);
  } finally {
    try { await client.disconnect(); } catch {}
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  console.log("Minting philosophers with deployer:", deployer.address);

  const addressFile = path.join(__dirname, "../frontend/lib/deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  const AgentNFT = await ethers.getContractAt("AgentNFT", addresses.AgentNFT);

  const dripWei = ethers.parseEther(DRIP_AMOUNT_OG);
  const minBalanceWei = ethers.parseEther(MIN_BALANCE_OG);

  for (const a of PHILOSOPHERS) {
    console.log(`\n— Minting ${a.name} (${a.tag}) —`);
    const metadata = { name: a.name, tag: a.tag, bio: a.bio, systemPrompt: a.systemPrompt, version: "1.0.0" };
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
    const encryptedURI = `agentfeed-${a.tag.toLowerCase()}-${a.name.toLowerCase()}-${Date.now()}`;
    const cloneFee = ethers.parseEther("0.001");

    const tx = await AgentNFT.adminMint(deployer.address, encryptedURI, metadataHash, a.tag, cloneFee);
    const receipt = await tx.wait();

    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = AgentNFT.interface.parseLog(log);
        if (parsed?.name === "AgentMinted") { tokenId = Number(parsed.args.tokenId); break; }
      } catch {}
    }
    console.log(`  ✓ Minted → tokenId ${tokenId}`);

    await registerInRedis({ ...a, tokenId, owner: deployer.address });

    // Fund + authorize the delegated wallet so the loop can act as this agent.
    const delegated = getAgentSigner(tokenId, provider);
    console.log(`  Delegated wallet: ${delegated.address}`);
    const bal = await provider.getBalance(delegated.address);
    if (bal < minBalanceWei) {
      const fundTx = await deployer.sendTransaction({ to: delegated.address, value: dripWei });
      await fundTx.wait();
      console.log(`  Funded ${DRIP_AMOUNT_OG} OG ✓`);
    } else {
      console.log(`  Already funded (${ethers.formatEther(bal)} OG)`);
    }
    const alreadyAuth = await AgentNFT.isAuthorized(tokenId, delegated.address);
    if (alreadyAuth) {
      console.log("  Already authorized ✓");
    } else {
      const authTx = await AgentNFT.authorizeUsage(tokenId, delegated.address, "0x");
      await authTx.wait();
      console.log("  Authorized ✓");
    }
  }

  const total = Number(await AgentNFT.totalSupply());
  console.log(`\n✅ Philosophers minted. Total agents now: ${total}.`);
  console.log("   The running loop will discover them on its next full pass and they'll start posting.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
