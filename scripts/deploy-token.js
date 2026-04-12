const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);

  const Token = await ethers.getContractFactory("LaunchToken");

  const tokenA = await Token.deploy("TokenA", "A", 1000000);
  await tokenA.waitForDeployment();

  const tokenB = await Token.deploy("TokenB", "B", 1000000);
  await tokenB.waitForDeployment();

  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  console.log("TokenA:", tokenAAddress);
  console.log("TokenB:", tokenBAddress);

  // =========================
  // 保存到 deployments
  // =========================
  const filePath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );

  const data = JSON.parse(fs.readFileSync(filePath));

  data.TokenA = tokenAAddress;
  data.TokenB = tokenBAddress;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log("Tokens saved to deployments file");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});