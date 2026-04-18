"use client";
import { baseSepolia } from "viem/chains";
import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { LAUNCH_TOKEN_ABI, LAUNCH_TOKEN_BYTECODE } from "@/lib/contracts/LaunchToken"

import Header from "@/components/Header";
import deployment from "@/deployments/baseSepolia.json";


export default function LaunchPage() {

  type LiquidityStatus =
    | "idle"
    | "approving"
    | "adding"
    | "success"
    | "error";

  const [liquidityStatus, setLiquidityStatus] = useState<LiquidityStatus>("idle");
  const [poolAddress, setPoolAddress] = useState<string>("");
  const [lpBalance, setLpBalance] = useState<string>("");

  type LaunchStatus = "idle" | "validating" | "ready" | "deploying" | "deployed" | "failed";

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isDeploying, setIsDeploying] = useState(false);
  const { switchChain } = useSwitchChain()

  
  const [deployResult, setDeployResult] = useState<null | {
    contractAddress: string,
    txHash: string,
  }>(null);

  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [initialSupply, setInitialSupply] = useState("");
  const [initialEthAmount, setInitialEthAmount] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [mounted, setMounted] = useState(false);
  
  console.log("=== RENDER ===");
  
  const [submittedData, setSubmittedData] = useState<null | {
    deploymentConfig: {
      tokenName: string;
      tokenSymbol: string;
      initialSupply: string;
    };
    launchConfig: {
      initialEthAmount: string;
      description: string;
    };
  }>(null);

  const deployButtonState = getDeployButtonState();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!walletClient) return;
  
    if (walletClient.chain?.id !== baseSepolia.id) {
      switchChain({ chainId: baseSepolia.id });
    }
  }, [walletClient, switchChain]);

  function getDeployButtonState() {
    if (!isConnected) {
      return {
        disabled: true,
        label: "Connect wallet to deploy",
        hint: "Please connect your wallet first.",
      };
    }

    if (deployResult) {
      return {
        disabled: true,
        label: "Token already deployed",
        hint: "Token has been deployed. Proceed to add liquidity.",
      };
    }
  
    if (!submittedData) {
      return {
        disabled: true,
        label: "Validate form first",
        hint: "Complete validation before deploying the token.",
      };
    }
  
    if (isDeploying) {
      return {
        disabled: true,
        label: "Deploying...",
        hint: "Transaction is being processed onchain.",
      };
    }

    if (!walletClient) {
      return {
        disabled: true,
        label: "Preparing wallet...",
        hint: "Waiting for wallet connection to be fully ready.",
      };
    }
  
    return {
      disabled: false,
      label: "Deploy ERC20 Token",
      hint: "Ready to deploy your ERC20 token on Base Sepolia.",
    };
  }

  async function handleAddLiquidity() {
    if (liquidityStatus === "approving" || liquidityStatus === "adding") return;
  
    try {
      setError("");
      setSuccessMessage("");
      setPoolAddress("");
      setLpBalance("");
  
      if (!deployResult?.contractAddress) {
        throw new Error("Token not deployed yet.");
      }
  
      if (!walletClient || !publicClient || !address) {
        throw new Error("Wallet not ready.");
      }
  
      const tokenAddress = deployResult.contractAddress as `0x${string}`;
      const routerAddress = deployment.Router as `0x${string}`;
      const factoryAddress = deployment.Factory as `0x${string}`;
      const wethAddress = deployment.WETH as `0x${string}`;
  
      if (!submittedData) throw new Error("Form data not found.");
  
      const amountToken =
        BigInt(submittedData.deploymentConfig.initialSupply) *
        BigInt(10) ** BigInt(18);
  
      const amountETH = BigInt(
        Math.floor(Number(submittedData.launchConfig.initialEthAmount) * 1e18)
      );
  
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
      console.log("===== ADD LIQUIDITY START =====");
  
      // =========================
      // 1. ERC20 ABI
      // =========================
      const erc20Abi = [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
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
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ];
  
      // =========================
      // 2. Check balance & allowance
      // =========================
      const balance = (await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
  
      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, routerAddress],
      })) as bigint;
  
      console.log("Balance:", balance.toString());
      console.log("Allowance:", allowance.toString());
  
      if (balance < amountToken) {
        throw new Error("Insufficient token balance");
      }
  
      // =========================
      // 3. Approve
      // =========================
      if (allowance < amountToken) {
        setLiquidityStatus("approving");
  
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, amountToken],
          account: address,
        });
  
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
  
        console.log("Approve done");
      }
  
      // =========================
      // 4. Ensure Pool Exists（核心修复）
      // =========================
      const factoryAbi = [
        {
          name: "getPool",
          type: "function",
          inputs: [
            { name: "tokenA", type: "address" },
            { name: "tokenB", type: "address" },
            { name: "stable", type: "bool" },
          ],
          outputs: [{ type: "address" }],
          stateMutability: "view",
        },
        {
          name: "createPool",
          type: "function",
          inputs: [
            { name: "tokenA", type: "address" },
            { name: "tokenB", type: "address" },
            { name: "stable", type: "bool" },
          ],
          outputs: [{ type: "address" }],
          stateMutability: "nonpayable",
        },
      ];

      const [token0, token1] = [tokenAddress, wethAddress].sort((a, b) =>
        a.toLowerCase() < b.toLowerCase() ? -1 : 1
      );
  
      let pool = (await publicClient.readContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "getPool",
        args: [token0, token1, false], 
      })) as `0x${string}`;
  
      console.log("Pool before:", pool);
  
      if (pool === "0x0000000000000000000000000000000000000000") {
        console.log("Creating pool...");
      
        const hash = await walletClient.writeContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "createPool",
          args: [token0, token1, false],
          account: address,
        });
      
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const poolFromData = `0x${receipt.logs[0].data.slice(26, 66)}` as `0x${string}`;

        console.log("Pool from data:", poolFromData);
    
        if (poolFromData && poolFromData !== "0x0000000000000000000000000000000000000000") {
          pool = poolFromData;
          console.log("Pool from data:", pool);
        } else {

          pool = (await publicClient.readContract({
            address: factoryAddress,
            abi: factoryAbi,
            functionName: "getPool",
            args: [token0, token1, false],
          })) as `0x${string}`;
        }
      }
  
      console.log("Pool after:", pool);
  
      if (!pool || pool === "0x0000000000000000000000000000000000000000") {
        throw new Error("Pool creation failed");
      }
  
      // =========================
      // 5. Add Liquidity
      // =========================
      const routerAbi = [
        {
          name: "addLiquidityETH",
          type: "function",
          stateMutability: "payable",
          inputs: [
            { name: "token", type: "address" },
            { name: "stable", type: "bool" },
            { name: "amountTokenDesired", type: "uint256" },
            { name: "amountTokenMin", type: "uint256" },
            { name: "amountETHMin", type: "uint256" },
            { name: "to", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
          outputs: [
            { name: "amountToken", type: "uint256" },
            { name: "amountETH", type: "uint256" },
            { name: "liquidity", type: "uint256" },
          ],
        },
      ];
  
      setLiquidityStatus("adding");
  
      const txHash = await walletClient.writeContract({
        address: routerAddress,
        abi: routerAbi,
        functionName: "addLiquidityETH",
        args: [
          tokenAddress,
          false,
          amountToken,
          0,
          0,
          address,
          deadline,
        ],
        value: amountETH,
        account: address,
      });
  
      await publicClient.waitForTransactionReceipt({ hash: txHash });
  
      console.log("Liquidity added");
  
      // =========================
      // 6. LP Balance
      // =========================

      await new Promise(r => setTimeout(r, 2000));

      let lp = BigInt(0);
      for (let i = 0; i < 3; i++) {
        lp = (await publicClient.readContract({
          address: pool,
          abi: [{
            name: "balanceOf",
            type: "function",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
          }],
          functionName: "balanceOf",
          args: [address],
        })) as bigint;

        if (lp > BigInt(0)) break;
        await new Promise(r => setTimeout(r, 2000));
      }

  
      console.log("LP Balance:", lp.toString());
  
      setPoolAddress(pool);
      setLpBalance(lp.toString());
  
      setLiquidityStatus("success");
      setSuccessMessage("Liquidity added successfully");
    } catch (err: any) {
      console.error(err);
      setLiquidityStatus("error");
      setError(err.message || "Add liquidity failed");
    }
  }

  async function handleDeployToken() {
    try {
      setError("");
      setSuccessMessage("");
      setDeployResult(null);
  
      if (!isConnected || !address) {
        setError("Please connect your wallet first.");
        setStatus("failed");
        return;
      }
  
      if (!walletClient) {
        setError("Wallet is still initializing. Please wait a moment and try again.");
        setStatus("failed");
        return;
      }
  
      if (!publicClient) {
        setError("Public client is not ready.");
        setStatus("failed");
        return;
      }
  
      if (!submittedData) {
        setError("Please validate the launch form first.");
        setStatus("failed");
        return;
      }
  
      const { tokenName, tokenSymbol, initialSupply } = submittedData.deploymentConfig;
  
      if (!/^\d+$/.test(initialSupply.trim())) {
        setError("Initial Supply must be a whole number.");
        setStatus("failed");
        return;
      }
  
      const normalizedSupply = BigInt(initialSupply);
  
      if (normalizedSupply <= BigInt(0)) {
        setError("Initial Supply must be greater than 0.");
        setStatus("failed");
        return;
      }
  
      setIsDeploying(true);
      setStatus("deploying");

      if (walletClient.chain?.id !== baseSepolia.id) {
        setError("Please switch to Base Sepolia network.");
        setStatus("failed");
        setIsDeploying(false);
        return;
      }
  
      const hash = await walletClient.deployContract({
        abi: LAUNCH_TOKEN_ABI,
        bytecode: LAUNCH_TOKEN_BYTECODE as `0x${string}`,
        args: [tokenName, tokenSymbol, normalizedSupply],
        account: address,
        chain: walletClient.chain,
      });
  
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      
  
      if (!receipt.contractAddress) {
        throw new Error("Contract address not found in receipt.");
      }
  
      setDeployResult({
        contractAddress: receipt.contractAddress,
        txHash: hash,
      });
  
      setSuccessMessage("ERC20 token deployed successfully.");
      setStatus("deployed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to deploy ERC20 token.";
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Transaction rejected by user.");
      } else {
        setError(message);
      }
      setStatus("failed");
    } finally {
      setIsDeploying(false);
    }
  }

  async function handleLaunchPreview() {
    setError("");
    setSuccessMessage("");
    setStatus("validating");
    setIsSubmitting(true);

    const trimmedTokenName = tokenName.trim();
    const trimmedTokenSymbol = tokenSymbol.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTokenName) {
      setError("Token Name is required.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    if (!trimmedTokenSymbol) {
      setError("Token Symbol is required.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    if (!initialSupply) {
      setError("Initial Supply is required.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    if (!initialEthAmount) {
      setError("Initial ETH Amount is required.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    if (!/^\d+$/.test(initialSupply.trim())) {
      setError("Initial Supply must be a whole number.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }
    
    const normalizedSupply = BigInt(initialSupply.trim());
    
    if (normalizedSupply <= BigInt(0)) {
      setError("Initial Supply must be greater than 0.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    const ethAmountNumber = Number(initialEthAmount);

    if (Number.isNaN(ethAmountNumber) || ethAmountNumber <= 0) {
      setError("Initial ETH Amount must be a number greater than 0.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 600));

    const deploymentConfig = {
      tokenName: trimmedTokenName,
      tokenSymbol:trimmedTokenSymbol.toUpperCase(),
      initialSupply,
    };

    const launchConfig = {
      initialEthAmount,
      description: trimmedDescription,
    };

    const payload = {
      deploymentConfig,
      launchConfig,
    };

    console.log("Launch form payload:", payload);
    setSubmittedData(payload);
    setSuccessMessage("Launch form looks valid. Ready for the next integration step.");
    setStatus("ready");
    setIsSubmitting(false);
  }

  function getStepStyle(step: number) {
    // Step 1: 部署 token，看 status
    if (step === 1) {
      if (status === "validating" || status === "deploying") return "border-yellow-500/40 bg-yellow-500/10";
      if (status === "ready" || status === "deployed") return "border-emerald-500/40 bg-emerald-500/10";
      if (status === "failed") return "border-red-500/40 bg-red-500/10";
      return "border-white/10 bg-black/30";
    }
  
    // Step 2: Approve，看 liquidityStatus
    if (step === 2) {
      if (status !== "deployed") return "border-white/10 bg-black/30";
      if (liquidityStatus === "approving") return "border-yellow-500/40 bg-yellow-500/10";
      if (["adding", "success"].includes(liquidityStatus)) return "border-emerald-500/40 bg-emerald-500/10";
      if (liquidityStatus === "error") return "border-red-500/40 bg-red-500/10";
      return "border-white/10 bg-black/30";
    }
  
    // Step 3: Add Liquidity
    if (step === 3) {
      if (liquidityStatus === "adding") return "border-yellow-500/40 bg-yellow-500/10";
      if (liquidityStatus === "success") return "border-emerald-500/40 bg-emerald-500/10";
      if (liquidityStatus === "error") return "border-red-500/40 bg-red-500/10";
      return "border-white/10 bg-black/30";
    }
  
    // Step 4: Show Result
    if (step === 4) {
      if (liquidityStatus === "success") return "border-emerald-500/40 bg-emerald-500/10";
      if (liquidityStatus === "error") return "border-red-500/40 bg-red-500/10";
      return "border-white/10 bg-black/30";
    }
  
    return "border-white/10 bg-black/30";
  }

  function getStatusText() {
    if (status === "idle") return "Idle";
    if (status === "validating") return "Validating";
    if (status === "ready") return "Ready";
    if (status === "deploying") return "Deploying";
    if (status === "deployed") return "Deployed";
    if (status === "failed") return "Failed";
    return "Unknown";
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-gray-500">
            Launch Flow
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            Create and Launch Your AI Model Token
          </h1>
          <p className="mt-4 max-w-3xl text-gray-400">
            This MVP guides users through a minimal launch flow on Base:
            deploy a standard ERC20, approve token usage, add initial
            liquidity on Aerodrome, and display the final launch result.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Launch Form</h2>
              <p className="mt-2 text-sm text-gray-400">
                Enter the minimum token parameters needed to create and seed a
                launch.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Token Name
                </label>
                <input
                  type="text"
                  placeholder="Example: AeroMind"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Token Symbol
                </label>
                <input
                  type="text"
                  placeholder="Example: AEROAI"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Initial Supply
                </label>
                <input
                  type="number"
                  placeholder="1000000"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Initial ETH Amount
                </label>
                <input
                  type="number"
                  placeholder="0.1"
                  value={initialEthAmount}
                  onChange={(e) => setInitialEthAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Model Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  placeholder="Describe the AI model token briefly..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-white/30"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleLaunchPreview}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Validating..." : "Validate Launch Form"}
              </button>
              <button
              type="button"
              onClick={handleDeployToken}
              disabled={!mounted || deployButtonState.disabled}
              className="w-full rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
              {mounted ? deployButtonState.label : "Loading..."}
              </button>
              {status === "deployed" && (
                <button
                  onClick={handleAddLiquidity}
                  disabled={liquidityStatus === "approving" || liquidityStatus === "adding"}
                  className="w-full rounded-xl border border-blue-500/40 px-6 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {liquidityStatus === "approving" && "Approving..."}
                  {liquidityStatus === "adding" && "Adding Liquidity..."}
                  {liquidityStatus === "idle" && "Add Liquidity"}
                  {liquidityStatus === "success" && "Add Again"}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">Flow Preview</h2>
              <p className="mt-2 text-sm text-gray-400">
                The launch assistant will execute the following steps.
              </p>

              <div className="mt-6 space-y-4">
                <div className={`rounded-xl border p-4 transition ${getStepStyle(1)}`}>
                  <p className="text-sm text-gray-500">Step 1</p>
                  <p className="mt-1 font-medium text-white">Deploy ERC20 Token</p>
                </div>

                <div className={`rounded-xl border p-4 transition ${getStepStyle(2)}`}>
                  <p className="text-sm text-gray-500">Step 2</p>
                  <p className="mt-1 font-medium text-white">Approve Router Spending</p>
                </div>

                <div className={`rounded-xl border p-4 transition ${getStepStyle(3)}`}>
                  <p className="text-sm text-gray-500">Step 3</p>
                  <p className="mt-1 font-medium text-white">Add Initial Liquidity</p>
                </div>

                <div className={`rounded-xl border p-4 transition ${getStepStyle(4)}`}>
                  <p className="text-sm text-gray-500">Step 4</p>
                  <p className="mt-1 font-medium text-white">Show Launch Result</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">Why This MVP</h2>
              <p className="mt-3 text-sm leading-6 text-gray-400">
                This project is not a full launchpad platform. It is a focused
                product demo that turns Aerodrome&apos;s liquidity primitives
                into a simple launch flow that users can understand and execute.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Launch Result</h2>
          <p className="mt-2 text-sm text-gray-400">
            For now, this panel shows the current submitted form data. Later it
            will display real onchain results such as token address, pool info,
            tx hash, and execution status.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Status</p>
              <p className="mt-2 text-sm text-gray-300">{getStatusText()}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Token Name</p>
              <p className="mt-2 text-sm text-gray-300">
                {submittedData?.deploymentConfig?.tokenName || "Not submitted yet"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Token Symbol</p>
              <p className="mt-2 text-sm text-gray-300">
                {submittedData?.deploymentConfig?.tokenSymbol || "Not submitted yet"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Initial Supply</p>
              <p className="mt-2 text-sm text-gray-300">
                {submittedData?.deploymentConfig?.initialSupply || "Not submitted yet"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Initial ETH Amount</p>
              <p className="mt-2 text-sm text-gray-300">
                {submittedData?.launchConfig?.initialEthAmount || "Not submitted yet"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 md:col-span-2">
              <p className="text-sm text-gray-500">Description</p>
              <p className="mt-2 text-sm text-gray-300">
                {submittedData?.launchConfig?.description || "Not submitted yet"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Token Address</p>
              <p className="mt-2 break-all text-sm text-gray-300">
                {deployResult?.contractAddress || "Not deployed yet"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Deployment Tx Hash</p>
              <p className="mt-2 break-all text-sm text-gray-300">
                {deployResult?.txHash || "Not deployed yet"}
              </p>
            </div>

            {/* Pool Address */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">Pool Address</p>
              <p className="mt-2 break-all text-sm text-gray-300">
                {poolAddress || "Not created yet"}
              </p>
            </div>

            {/* LP Balance */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-gray-500">LP Token Balance</p>
              <p className="mt-2 break-all text-sm text-gray-300">
                {lpBalance || "0"}
              </p>
            </div>

            {/* Liquidity Status */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 md:col-span-2">
              <p className="text-sm text-gray-500">Liquidity Status</p>
              <p className="mt-2 text-sm text-gray-300">
                {liquidityStatus}
              </p>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}