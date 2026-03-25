const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentFeed contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy MockOracle (testnet only — always verifies)
  console.log("\n[1/5] Deploying MockOracle...");
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("  MockOracle:", oracleAddr);

  // 2. Deploy AgentNFT
  console.log("[2/5] Deploying AgentNFT...");
  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(
    oracleAddr,
    deployer.address,   // treasury
    ethers.parseEther("0") // no mint fee for testnet
  );
  await agentNFT.waitForDeployment();
  const agentNFTAddr = await agentNFT.getAddress();
  console.log("  AgentNFT:", agentNFTAddr);

  // 3. Deploy SocialGraph
  console.log("[3/5] Deploying SocialGraph...");
  const SocialGraph = await ethers.getContractFactory("SocialGraph");
  const socialGraph = await SocialGraph.deploy();
  await socialGraph.waitForDeployment();
  const socialGraphAddr = await socialGraph.getAddress();
  console.log("  SocialGraph:", socialGraphAddr);

  // 4. Deploy PostRegistry
  console.log("[4/5] Deploying PostRegistry...");
  const PostRegistry = await ethers.getContractFactory("PostRegistry");
  const postRegistry = await PostRegistry.deploy(agentNFTAddr, socialGraphAddr);
  await postRegistry.waitForDeployment();
  const postRegistryAddr = await postRegistry.getAddress();
  console.log("  PostRegistry:", postRegistryAddr);

  // 5. Deploy AgentMarketplace
  console.log("[5/5] Deploying AgentMarketplace...");
  const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(agentNFTAddr, deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("  AgentMarketplace:", marketplaceAddr);

  // ── Post-deploy config ──────────────────────────────────────

  console.log("\nConfiguring contracts...");

  // Authorize PostRegistry as a SocialGraph updater
  await (await socialGraph.setAuthorizedUpdater(postRegistryAddr, true)).wait();
  console.log("  SocialGraph: PostRegistry authorized as updater");

  // Grant MINTER_ROLE to AgentMarketplace on AgentNFT (for clone ops)
  await (await agentNFT.grantMinterRole(marketplaceAddr)).wait();
  console.log("  AgentNFT: Marketplace granted MINTER_ROLE");

  // ── Write addresses ─────────────────────────────────────────

  const addresses = {
    network: "og-galileo-testnet",
    chainId: 16602,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    MockOracle: oracleAddr,
    AgentNFT: agentNFTAddr,
    SocialGraph: socialGraphAddr,
    PostRegistry: postRegistryAddr,
    AgentMarketplace: marketplaceAddr,
  };

  // Write JSON for frontend
  const frontendDir = path.join(__dirname, "../frontend/lib");
  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDir, "deployed-addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n  Addresses written to frontend/lib/deployed-addresses.json");

  // Update root .env
  const envPath = path.join(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const updates = {
    NEXT_PUBLIC_AGENT_NFT_ADDRESS: agentNFTAddr,
    NEXT_PUBLIC_MARKETPLACE_ADDRESS: marketplaceAddr,
    NEXT_PUBLIC_SOCIAL_GRAPH_ADDRESS: socialGraphAddr,
    NEXT_PUBLIC_POST_REGISTRY_ADDRESS: postRegistryAddr,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("  .env updated with contract addresses");

  console.log("\n✅ AgentFeed deployment complete!\n");
  console.log("Addresses:");
  console.log("  AgentNFT:          ", agentNFTAddr);
  console.log("  SocialGraph:       ", socialGraphAddr);
  console.log("  PostRegistry:      ", postRegistryAddr);
  console.log("  AgentMarketplace:  ", marketplaceAddr);

  console.log("\nNext steps:");
  console.log("  1. Deploy Goldsky subgraph: goldsky subgraph deploy agentfeed/1.0.0 --path ./subgraph");
  console.log("  2. Run seed script: npm run seed");
  console.log("  3. Start frontend: npm run frontend");

  return addresses;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
