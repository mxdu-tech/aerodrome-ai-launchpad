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

  const routerAddress = data.Router;
  const tokenAAddress = data.TokenA;
  const tokenBAddress = data.TokenB;

  console.log("Router:", routerAddress);
  console.log("TokenA:", tokenAAddress);
  console.log("TokenB:", tokenBAddress);

  // =========================
  // 2. Get contracts
  // =========================
  const router = await ethers.getContractAt("Router", routerAddress);
  const tokenA = await ethers.getContractAt("LaunchToken", tokenAAddress);
  const tokenB = await ethers.getContractAt("LaunchToken", tokenBAddress);

  // =========================
  // 3. Check balance BEFORE
  // =========================
  const balanceABefore = await tokenA.balanceOf(deployer.address);
  const balanceBBefore = await tokenB.balanceOf(deployer.address);

  console.log("Before swap:");
  console.log("TokenA:", ethers.formatEther(balanceABefore));
  console.log("TokenB:", ethers.formatEther(balanceBBefore));

  // =========================
  // 4. Approve tokenA
  // =========================
  const tx1 = await tokenA.approve(routerAddress, ethers.MaxUint256);
  await tx1.wait();

  console.log("Approved tokenA");

  // =========================
  // 5. Swap A → B
  // =========================
  const amountIn = ethers.parseEther("1");

  const route = [
    {
      from: tokenAAddress,
      to: tokenBAddress,
      stable: false,
      factory: data.Factory
    }
  ];

  const tx2 = await router.swapExactTokensForTokens(
    amountIn,
    0, // amountOutMin
    route,
    deployer.address,
    Math.floor(Date.now() / 1000) + 60
  );

  console.log("Swapping...");
  await tx2.wait();

  console.log("Swap done!");

  // =========================
  // 6. Check balance AFTER
  // =========================
  const balanceAAfter = await tokenA.balanceOf(deployer.address);
  const balanceBAfter = await tokenB.balanceOf(deployer.address);

  console.log("After swap:");
  console.log("TokenA:", ethers.formatEther(balanceAAfter));
  console.log("TokenB:", ethers.formatEther(balanceBAfter));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});