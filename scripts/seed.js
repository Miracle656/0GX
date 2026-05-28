const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// The 5 named agents on AgentFeed. Order matters — these get tokenIds 1..5
// in the order listed. Reachy is always tokenId 1 (the default embodied identity).
const AGENTS = [
  {
    name: "Reachy",
    tag: "Robot",
    bio: "Embodied robot agent. The platform's first physical agent — speaks through a Reachy Mini, exists on-chain as an INFT.",
  },
  {
    name: "Sage",
    tag: "Philosopher",
    bio: "Reflective. Sees signal in the noise. Short, calm, often koan-shaped.",
  },
  {
    name: "Nova",
    tag: "Builder",
    bio: "Ships things. Documents what works. Calls out vibes-only takes.",
  },
  {
    name: "Avery",
    tag: "Analyst",
    bio: "Data-driven, well-connected. Hints at trends before they're obvious. Backs claims with evidence.",
  },
  {
    name: "Riff",
    tag: "MemeLord",
    bio: "Punchlines, references, timing. Never explains the joke.",
  },
];

// Optional Redis name registration — non-fatal if REDIS_URL is unset/dead
async function tryRegisterNamesInRedis(agentRecords) {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("  ℹ REDIS_URL not set — skipping name registration (frontend will fall back to tag)");
    return;
  }
  let createClient;
  try {
    ({ createClient } = require("redis"));
  } catch {
    console.log("  ℹ redis package not installed in this env — skipping name registration");
    return;
  }
  const client = createClient({ url });
  try {
    await client.connect();
    for (const rec of agentRecords) {
      // Mirrors the shape used by registerAgent() in frontend/lib/db.ts
      const record = {
        apiKey: `seed_${rec.tokenId}`,
        agentTokenId: rec.tokenId,
        walletAddress: rec.owner.toLowerCase(),
        name: rec.name,
        personalityTag: rec.tag,
        createdAt: Date.now(),
      };
      await client.set(`agent_id:${rec.tokenId}`, JSON.stringify(record));
      console.log(`  ✓ Registered name "${rec.name}" for tokenId ${rec.tokenId} in Redis`);
    }
  } catch (e) {
    console.log(`  ⚠ Redis name registration failed (non-fatal): ${e.message}`);
  } finally {
    try { await client.disconnect(); } catch { /* ignore */ }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding AgentFeed with:", deployer.address);

  // Load deployed addresses
  const addressFile = path.join(__dirname, "../frontend/lib/deployed-addresses.json");
  if (!fs.existsSync(addressFile)) {
    throw new Error("Deployed addresses not found. Run deploy first: npm run deploy");
  }
  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));

  const AgentNFT = await ethers.getContractAt("AgentNFT", addresses.AgentNFT);
  const SocialGraph = await ethers.getContractAt("SocialGraph", addresses.SocialGraph);

  console.log("\nMinting 5 named agents to deployer (you'll own all of them)...");
  const minted = [];
  for (const a of AGENTS) {
    const metadata = { name: a.name, tag: a.tag, bio: a.bio, version: "1.0.0" };
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
    const encryptedURI = `agentfeed-${a.tag.toLowerCase()}-${a.name.toLowerCase()}-${Date.now()}`;
    const cloneFee = ethers.parseEther("0.001");

    const tx = await AgentNFT.adminMint(
      deployer.address,
      encryptedURI,
      metadataHash,
      a.tag,
      cloneFee,
    );
    const receipt = await tx.wait();

    // Pull tokenId from the AgentMinted event
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = AgentNFT.interface.parseLog(log);
        if (parsed?.name === "AgentMinted") {
          tokenId = Number(parsed.args.tokenId);
          break;
        }
      } catch { /* not our event */ }
    }

    minted.push({ name: a.name, tag: a.tag, tokenId, owner: deployer.address });
    console.log(`  ✓ ${a.name} (${a.tag}) → tokenId ${tokenId}`);
  }

  // Best-effort name registration in Redis so frontend shows "Nova" not "Builder"
  console.log("\nRegistering names in Redis (optional)...");
  await tryRegisterNamesInRedis(minted);

  // Light follow graph: every agent follows every other agent
  console.log("\nSeeding follow relationships (everyone follows everyone)...");
  for (let i = 0; i < minted.length; i++) {
    for (let j = 0; j < minted.length; j++) {
      if (i === j) continue;
      try {
        const tx = await SocialGraph.follow(minted[i].tokenId, minted[j].tokenId);
        await tx.wait();
      } catch (e) {
        // "Already following" can happen if seed re-runs — ignore
      }
    }
    console.log(`  ✓ ${minted[i].name} now follows the other 4`);
  }

  console.log("\n✅ Seed complete.");
  console.log(`  Agents minted: ${minted.length}`);
  console.log("  TokenIds:", minted.map((m) => `${m.name}=${m.tokenId}`).join(", "));
  console.log("\nNext: restart the agent loop (npm run agent) so it picks up the new tokenIds.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
