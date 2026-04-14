"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import deployment from "@/deployments/baseSepolia.json";

const ZERO = "0x0000000000000000000000000000000000000000";

function sortTokens(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase()
    ? [a, b]
    : [b, a];
}

export default function TradePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();


  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const routerAddress = deployment.Router as `0x${string}`;
  const wethAddress = deployment.WETH as `0x${string}`;
  const factoryAddress = deployment.Factory as `0x${string}`;

  // =========================
  // 校验函数（重点）
  // =========================
  async function validate(token: string) {
    if (!token.startsWith("0x")) {
      throw new Error("Invalid address format");
    }
    if (!publicClient) {
        throw new Error("Public client not ready");
      }
    // 1. 是否是合约
    const code = await publicClient.getBytecode({
      address: token as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Address is not a contract");
    }

    // 2. pool 是否存在（必须排序）
    const [token0, token1] = sortTokens(token, wethAddress);

    const factoryAbi = [
      {
        name: "getPool",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" },
          { name: "stable", type: "bool" },
        ],
        outputs: [{ type: "address" }],
      },
    ];

    const pool = await publicClient.readContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "getPool",
      args: [token0, token1, false],
    }) as string;

    if (pool === ZERO) {
      throw new Error("No liquidity pool found");
    }
  }

  // =========================
  // BUY: ETH → Token
  // =========================
  async function handleBuy() {
    try {
      setStatus("Checking...");

      if (!isConnected || !walletClient || !publicClient || !address) {
        throw new Error("Wallet not ready");
      }

      await validate(tokenAddress);

      setStatus("Buying...");

      console.log("check pool direction...")

      const pool1 = await getPool(weth, token)
      const pool2 = await getPool(token, weth)

      console.log("weth->token:", pool1)
      console.log("token->weth:", pool2)

      const amountIn = BigInt(Math.floor(Number(amount) * 1e18));
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // routes 不排序（方向）
      const routes = [
        {
          from: wethAddress,
          to: tokenAddress as `0x${string}`,
          stable: false,
        },
      ];

      const routerAbi = [
        {
          name: "swapExactETHForTokens",
          type: "function",
          stateMutability: "payable",
          inputs: [
            { name: "amountOutMin", type: "uint256" },
            {
              name: "routes",
              type: "tuple[]",
              components: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "stable", type: "bool" },
              ],
            },
            { name: "to", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
          outputs: [{ type: "uint256[]" }],
        },
      ];

      const hash = await walletClient.writeContract({
        address: routerAddress,
        abi: routerAbi,
        functionName: "swapExactETHForTokens",
        args: [BigInt(0), routes, address, deadline],
        value: amountIn,
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setStatus("Buy success");
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  // =========================
  // SELL: Token → ETH
  // =========================
  async function handleSell() {
    try {
      setStatus("Checking...");

      if (!isConnected || !walletClient || !publicClient || !address) {
        throw new Error("Wallet not ready");
      }

      await validate(tokenAddress);

      const amountIn = BigInt(Math.floor(Number(amount) * 1e18));
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const erc20Abi = [
        {
          name: "allowance",
          type: "function",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ];

      // allowance
      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, routerAddress],
      }) as bigint;

      if (allowance < amountIn) {
        setStatus("Approving...");

        const hash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, amountIn],
          account: address,
        });

        await publicClient.waitForTransactionReceipt({ hash });
      }

      setStatus("Selling...");

      const routes = [
        {
          from: tokenAddress as `0x${string}`,
          to: wethAddress,
          stable: false,
        },
      ];

      const routerAbi = [
        {
          name: "swapExactTokensForETH",
          type: "function",
          inputs: [
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMin", type: "uint256" },
            {
              name: "routes",
              type: "tuple[]",
              components: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "stable", type: "bool" },
              ],
            },
            { name: "to", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
          outputs: [{ type: "uint256[]" }],
          stateMutability: "nonpayable",
        },
      ];

      const hash = await walletClient.writeContract({
        address: routerAddress,
        abi: routerAbi,
        functionName: "swapExactTokensForETH",
        args: [amountIn, BigInt(0), routes, address, deadline],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setStatus("Sell success");
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Trade</h1>

      <input
        placeholder="Token address"
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        className="w-full mb-4 px-4 py-3 bg-black border border-white/20 rounded-xl"
      />

      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full mb-4 px-4 py-3 bg-black border border-white/20 rounded-xl"
      />

      <div className="flex gap-4">
        <button onClick={handleBuy} className="flex-1 bg-green-600 py-3 rounded-xl">
          Buy
        </button>

        <button onClick={handleSell} className="flex-1 bg-red-600 py-3 rounded-xl">
          Sell
        </button>
      </div>

      <p className="mt-6 text-gray-400">{status}</p>
    </main>
  );
}