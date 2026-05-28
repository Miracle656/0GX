// ─────────────────────────────────────────────────────────────────────
// Per-agent delegated wallet setup.
//
// For each minted AgentNFT, derive its delegated wallet, drip a small
// gas allowance from the deployer, and authorize the wallet as an
// executor via AgentNFT.authorizeUsage.
//
// Idempotent. Run after `npm run deploy && npm run seed` or anytime
// new agents are minted.
//
//   npx hardhat run scripts/setup-delegated-wallets.js --network og-testnet
// ─────────────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DRIP_AMOUNT_OG = "0.05";     // top-up per agent
const MIN_BALANCE_OG = "0.01";     // only top up if below this

// ── Inline BIP-32 derivation (mirrors frontend/lib/agent-wallets.ts) ──
function getMasterNode() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY env var required");
  const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
  const seed = ethers.keccak256(
    ethers.toUtf8Bytes(`agentfeed-delegated-v1:${normalized}`),
  );
  return ethers.HDNodeWallet.fromSeed(seed);
}

function getAgentSigner(tokenId, provider) {
  const master = getMasterNode();
  const child = master.derivePath(`m/44'/60'/0'/0/${tokenId}`);
  return new ethers.Wallet(child.privateKey, provider);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("Setting up delegated wallets with deployer:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await provider.getBalance(deployer.address)),
    "OG",
  );

  // Load deployed addresses
  const addressFile = path.join(
    __dirname,
    "../frontend/lib/deployed-addresses.json",
  );
  if (!fs.existsSync(addressFile)) {
    throw new Error("Deployed addresses missing. Run npm run deploy first.");
  }
  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));

  const AgentNFT = await ethers.getContractAt("AgentNFT", addresses.AgentNFT);
  const totalSupply = Number(await AgentNFT.totalSupply());
  console.log(`Found ${totalSupply} minted agents.\n`);

  const dripWei = ethers.parseEther(DRIP_AMOUNT_OG);
  const minBalanceWei = ethers.parseEther(MIN_BALANCE_OG);

  for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
    let ownerAddr;
    try {
      ownerAddr = await AgentNFT.ownerOf(tokenId);
    } catch (e) {
      console.log(`  Agent #${tokenId}: not found (${e.message}); skipping`);
      continue;
    }
    if (ownerAddr.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(
        `  Agent #${tokenId}: owned by ${ownerAddr.slice(0, 10)}..., not deployer; skipping`,
      );
      continue;
    }

    const delegated = getAgentSigner(tokenId, provider);
    const meta = await AgentNFT.getAgentMetadata(tokenId).catch(() => null);
    const tagLabel = meta?.personalityTag || "Agent";

    console.log(
      `\nAgent #${tokenId} (${tagLabel}) → delegated wallet ${delegated.address}`,
    );

    // 1. Top up if balance below threshold
    const balance = await provider.getBalance(delegated.address);
    if (balance < minBalanceWei) {
      console.log(
        `  Funding: balance ${ethers.formatEther(balance)} OG < ${MIN_BALANCE_OG} OG; sending ${DRIP_AMOUNT_OG} OG`,
      );
      const fundTx = await deployer.sendTransaction({
        to: delegated.address,
        value: dripWei,
      });
      await fundTx.wait();
      console.log(`  Funded ✓ tx ${fundTx.hash.slice(0, 16)}...`);
    } else {
      console.log(
        `  Funding: already has ${ethers.formatEther(balance)} OG; skipping`,
      );
    }

    // 2. Authorize the delegated wallet as an executor for this token
    const alreadyAuth = await AgentNFT.isAuthorized(
      tokenId,
      delegated.address,
    );
    if (alreadyAuth) {
      console.log("  Authorization: already authorized; skipping");
    } else {
      const authTx = await AgentNFT.authorizeUsage(
        tokenId,
        delegated.address,
        "0x", // empty permissions blob
      );
      await authTx.wait();
      console.log(`  Authorized ✓ tx ${authTx.hash.slice(0, 16)}...`);
    }
  }

  console.log("\n✅ Per-agent wallet setup complete.");
  console.log(
    "   The relayer routes will sign as the per-agent wallet whenever an agentTokenId is supplied.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
