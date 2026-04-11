import pkg from "hardhat";
const { ethers } = pkg;

async function main(){
    const WETH = await ethers.getContractFactory("WETH");

    const weth = await WETH.deploy();

    await weth.waitForDeployment();

    const address = await weth.getAddress();

    console.log("WETH deployed to:", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});