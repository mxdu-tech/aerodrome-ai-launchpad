const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);

  // =========================
  // 1. Load deployment file
  // =========================
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const filePath = path.join(deploymentsDir, `${network.name}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment file not found: ${filePath}`);
  }

  const existing = JSON.parse(fs.readFileSync(filePath));

  // =========================
  // 2. Read WETH from file
  // =========================
  const WETH = existing.WETH;

  if (!WETH) {
    throw new Error("WETH not found in deployment file");
  }

  console.log("WETH:", WETH);


    // 3. Deploy Pool implementation
    // =========================
    const Pool = await ethers.getContractFactory("Pool");
    const poolImpl = await Pool.deploy();

    await poolImpl.waitForDeployment();
    const poolImplAddress = await poolImpl.getAddress();

    console.log("Pool implementation:", poolImplAddress);

    // =========================
    // 4. Deploy PoolFactory
    // =========================
    const Factory = await ethers.getContractFactory("PoolFactory");

    const factory = await Factory.deploy(poolImplAddress);

    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    console.log("PoolFactory deployed:", factoryAddress);

  // =========================
  // 5. Deploy Router
  // =========================
  const Router = await ethers.getContractFactory("Router");

  const router = await Router.deploy(
    factoryAddress,
    factoryAddress, // defaultFactory
    WETH            // WETH address
  );

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("Router deployed:", routerAddress);

  // =========================
  // 5. Merge and save deployment
  // =========================
  const updated = {
    ...existing,
    Factory: factoryAddress,
    Router: routerAddress,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

  console.log("Updated deployment:", filePath);

  // =========================
  // 6. Summary
  // =========================
  console.log("\nDeployment Summary:");
  console.log("Factory:", factoryAddress);
  console.log("Router :", routerAddress);
  console.log("WETH   :", WETH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});