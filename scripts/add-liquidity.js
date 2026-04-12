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

    if (!fs.existsSync(filePath)) {
        throw new Error("Deployment file not found");
    }

    const data = JSON.parse(fs.readFileSync(filePath));

    const routerAddress = data.Router;
    const factoryAddress = data.Factory;

    console.log("Router:", routerAddress);
    console.log("Factory:", factoryAddress);

    const tokenAAddress = data.TokenA;
    const tokenBAddress = data.TokenB;

    const tokenA = await ethers.getContractAt("LaunchToken", tokenAAddress);
    const tokenB = await ethers.getContractAt("LaunchToken", tokenBAddress);


    console.log("TokenA:", tokenAAddress);
    console.log("TokenB:", tokenBAddress);

    // =========================
    // 3. Get Router contract
    // =========================
    const router = await ethers.getContractAt("Router", routerAddress);

    // =========================
    // 4. Approve tokens
    // =========================
    const tx1 = await tokenA.approve(routerAddress, ethers.MaxUint256);
    await tx1.wait();

    const tx2 = await tokenB.approve(routerAddress, ethers.MaxUint256);
    await tx2.wait();

    console.log("Approved tokens");

    // =========================
    // 5. Add liquidity (this will create pool automatically)
    // =========================
    const tx3 = await router.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        false, // stable = false
        ethers.parseEther("10"),
        ethers.parseEther("10"),
        0,
        0,
        deployer.address,
        Math.floor(Date.now() / 1000) + 60
    );

    console.log("Adding liquidity...");
    await tx3.wait();

    console.log("Liquidity added!");

    // =========================
    // 6. Verify pool
    // =========================
    const factory = await ethers.getContractAt("PoolFactory", factoryAddress);

    const [token0, token1] = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()?
        [tokenAAddress, tokenBAddress]: [tokenBAddress, tokenAAddress];

    const pool = await factory["getPool(address,address,bool)"](
        token0,
        token1,
        false
    );
    console.log("Pool created:", pool);

    }

    main().catch((error) => {
    console.error(error);
    process.exit(1);
});