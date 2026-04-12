const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);

  // =========================
  // 1. Deploy WETH
  // =========================
  const WETH = await ethers.getContractFactory("WETH");
  const weth = await WETH.deploy();

  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();

  console.log("WETH deployed:", wethAddress);

  // =========================
  // 2. Prepare deployment file path
  // =========================
  const deploymentsDir = path.join(__dirname, "..", "deployments");

  const filePath = path.join(
    deploymentsDir,
    `${network.name}.json`
  );

  // =========================
  // 3. Load existing data (if any)
  // =========================
  let existing = {};

  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath));
  }

  // =========================
  // 4. Merge deployment data
  // =========================
  const updated = {
    ...existing,
    WETH: wethAddress,
    updatedAt: new Date().toISOString()
  };

  // =========================
  // 5. Ensure directory exists
  // =========================
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // =========================
  // 6. Write to file
  // =========================
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

  console.log("Saved to:", filePath);

  // =========================
  // 7. Summary
  // =========================
  console.log("\nSummary:");
  console.log("WETH:", wethAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});