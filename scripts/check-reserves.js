const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);

  // =========================
  // 1. Load deployment data
  // =========================
  const filePath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );

  const data = JSON.parse(fs.readFileSync(filePath));

  const factoryAddress = data.Factory;
  const tokenAAddress = data.TokenA;
  const tokenBAddress = data.TokenB;

  console.log("Factory:", factoryAddress);
  console.log("TokenA:", tokenAAddress);
  console.log("TokenB:", tokenBAddress);

  // =========================
  // 2. Sort tokens (VERY IMPORTANT)
  // =========================
  const [token0, token1] =
    tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()
      ? [tokenAAddress, tokenBAddress]
      : [tokenBAddress, tokenAAddress];

  // =========================
  // 3. Get pool address
  // =========================
  const factory = await ethers.getContractAt("PoolFactory", factoryAddress);

  const poolAddress = await factory["getPool(address,address,bool)"](token0, token1, false);

  console.log("Pool:", poolAddress);

  // =========================
  // 4. Get reserves
  // =========================
  const pool = await ethers.getContractAt("Pool", poolAddress);

  const reserves = await pool.getReserves();

  console.log("Raw reserves:", reserves);

  // =========================
  // 5. Format reserves
  // =========================
  console.log("Formatted reserves:");
  console.log("Reserve0:", ethers.formatEther(reserves[0]));
  console.log("Reserve1:", ethers.formatEther(reserves[1]));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});