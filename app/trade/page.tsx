"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import deployment from "@/deployments/baseSepolia.json";
import { formatEther } from "viem";
import { parseEther } from "viem";

type Mode = "buy" | "sell" | "swap";

export default function TradePage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const routerAddress = deployment.Router as `0x${string}`;
  const wethAddress = deployment.WETH as `0x${string}`;
  const factoryAddress = deployment.Factory as `0x${string}`;

  const [mode, setMode] = useState<Mode>("buy");

  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");

  const [amountIn, setAmountIn] = useState("");

  const [quote, setQuote] = useState<bigint>(BigInt(0));

  const [slippage, setSlippage] = useState(1);

  const [priceImpact, setPriceImpact] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(0);

  const [status, setStatus] = useState("");

  const [reserves, setReserves] = useState<[bigint, bigint]>([
    BigInt(0),
    BigInt(0),
  ]);

  const pairAbi = [
    { name: "getReserves", type: "function", outputs: [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ]},
    { name: "token0", type: "function", outputs: [{ type: "address" }] },
    { name: "token1", type: "function", outputs: [{ type: "address" }] },
  ] as const;

  const erc20Abi = [
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
    {
      name: "allowance",      
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ type: "uint256" }],
    },
  ] as const;

  const routerAbi = [
    {
      name: "swapExactETHForTokens",
      type: "function",
      stateMutability: "payable",
      inputs: [
        { name: "amountOutMin", type: "uint256" },
        {
          name: "routes", type: "tuple[]",
          components: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "stable", type: "bool" },
            { name: "factory", type: "address" },
          ],
        },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
      outputs: [{ type: "uint256[]" }],
    },
    {
      name: "swapExactTokensForETH",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        {
          name: "routes", type: "tuple[]",
          components: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "stable", type: "bool" },
            { name: "factory", type: "address" },
          ],
        },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
      outputs: [{ type: "uint256[]" }],
    },
    {
      name: "swapExactTokensForTokens",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        {
          name: "routes", type: "tuple[]",
          components: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "stable", type: "bool" },
            { name: "factory", type: "address" },
          ],
        },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
      outputs: [{ type: "uint256[]" }],
    },
    {
      name: "getAmountsOut",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "amountIn", type: "uint256" },
        {
          name: "routes",
          type: "tuple[]",
          components: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "stable", type: "bool" },
            { name: "factory", type: "address" },
          ],
        },
      ],
      outputs: [{ type: "uint256[]" }],
    },

  ] as const;

  const routerPoolAbi = [
    {
      name: "poolFor",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "tokenA", type: "address" },
        { name: "tokenB", type: "address" },
        { name: "stable", type: "bool" },
        { name: "_factory", type: "address" },
      ],
      outputs: [{ type: "address" }],
    },
  ] as const;
  /**
   * Build router path
   */
  function getRoutes() {
    if (mode === "buy") {
      return [
        {
          from: wethAddress,
          to: tokenA as `0x${string}`,
          stable: false,
          factory: factoryAddress,
        },
      ];
    }

    if (mode === "sell") {
      return [
        {
          from: tokenA as `0x${string}`,
          to: wethAddress,
          stable: false,
          factory: factoryAddress,
        },
      ];
    }

    return [
      {
        from: tokenA as `0x${string}`,
        to: wethAddress,
        stable: false,
        factory: factoryAddress,
      },
      {
        from: wethAddress,
        to: tokenB as `0x${string}`,
        stable: false,
        factory: factoryAddress,
      },
    ];
  }

  /**
   * Fetch quote from router
   */
  useEffect(() => {
    async function fetchQuote() {
      try {
        if (!amountIn || !publicClient) return;

        const amount = parseEther(amountIn);

        const amounts = (await publicClient.readContract({
          address: routerAddress,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [amount, getRoutes()],
        })) as bigint[];

        const out = amounts[amounts.length - 1];

        setQuote(out);

        const rate =
          Number(formatEther(out)) / Number(amountIn);
        setExchangeRate(rate);
      } catch {
        setQuote(BigInt(0));
      }
    }

    fetchQuote();
  }, [amountIn, tokenA, tokenB, mode]);

  useEffect(() => {
    setAmountIn("");
    setQuote(BigInt(0));
    setPriceImpact(0);
    setExchangeRate(0);
    setStatus("");
  }, [mode]);

  /**
   * Fetch pool reserves
   */
  useEffect(() => {
    async function fetchReserves() {
      try {
        if (!publicClient || !tokenA) return;


        const pair = (await publicClient.readContract({
          address: routerAddress,
          abi: routerPoolAbi,
          functionName: "poolFor",
          args: [wethAddress, tokenA as `0x${string}`, false, factoryAddress],
        }));

        const pairAbi = [
          {
            name: "getReserves",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [
              { type: "uint256" },
              { type: "uint256" },
              { type: "uint256" },
            ],
          },
        ];

        const result = (await publicClient.readContract({
          address: pair,
          abi: pairAbi,
          functionName: "getReserves",
        })) as [bigint, bigint, bigint];

        setReserves([result[0], result[1]]);
      } catch {}
    }

    fetchReserves();
  }, [tokenA]);

  /**
   * Compute price impact based on AMM reserves
   * Handles token0/token1 ordering + decimals normalization
   */
  useEffect(() => {
    async function computePriceImpact() {
      try {
        if (!publicClient || !amountIn || quote === BigInt(0)) {
          setPriceImpact(0);
          return;
        }
  
        const amountFloat = Number(amountIn);
        const quoteFloat = Number(formatEther(quote));
        
  
        // ---------- helper ----------
        async function getImpact(
          inputToken: `0x${string}`,
          outputToken: `0x${string}`,
          amount: number
        ) {
          if (!publicClient) throw new Error("No public client");
          const pair = await publicClient.readContract({
            address: routerAddress,
            abi: routerPoolAbi,
            functionName: "poolFor",
            args: [inputToken, outputToken, false, factoryAddress],
          }) as `0x${string}`;
  
          if (
            !pair ||
            pair === "0x0000000000000000000000000000000000000000"
          ) {
            return 0;
          }
  
          const pairAbi = [
            {
              name: "getReserves",
              type: "function",
              stateMutability: "view",
              inputs: [],
              outputs: [
                { type: "uint256" },
                { type: "uint256" },
                { type: "uint256" },
              ],
            },
            {
              name: "token0",
              type: "function",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "address" }],
            },
          ] as const;
          
          const [reservesRaw, token0] = await Promise.all([
            publicClient.readContract({
              address: pair,
              abi: pairAbi,
              functionName: "getReserves",
            }) as Promise<[bigint, bigint, bigint]>,
  
            publicClient.readContract({
              address: pair,
              abi: pairAbi,
              functionName: "token0",
            }) as Promise<`0x${string}`>,
          ]);
  
          const [r0, r1] = reservesRaw;
  
          let reserveIn: number;
          let reserveOut: number;
  
          if (inputToken.toLowerCase() === token0.toLowerCase()) {
            reserveIn = Number(r0) / 1e18;
            reserveOut = Number(r1) / 1e18;
          } else {
            reserveIn = Number(r1) / 1e18;
            reserveOut = Number(r0) / 1e18;
          }
  
          if (reserveIn === 0 || reserveOut === 0) return 0;
  
          const spot = reserveOut / reserveIn;
          const ideal = amount * spot;
  
      
          const k = reserveIn * reserveOut;
          const newReserveIn = reserveIn + amount;
          const newReserveOut = k / newReserveIn;
          const actual = reserveOut - newReserveOut;
  
          if (ideal === 0) return 0;
  
          return ((ideal - actual) / ideal) * 100;
        }
  
        // ---------- MAIN ----------
        let impact = 0;
  
        if (mode === "buy") {
          impact = await getImpact(wethAddress, tokenA as `0x${string}`, amountFloat);
        }
  
        else if (mode === "sell") {
          impact = await getImpact(tokenA as `0x${string}`, wethAddress, amountFloat);
        }
  
        else if (mode === "swap") {
          if (!tokenA || !tokenB) {
            setPriceImpact(0);
            return;
          }
  
          // hop1: tokenA → WETH
          const impact1 = await getImpact(
            tokenA as `0x${string}`,
            wethAddress,
            amountFloat
          );

          const amounts = await publicClient.readContract({
            address: routerAddress,
            abi: routerAbi,
            functionName: "getAmountsOut",
            args: [
              parseEther(amountIn),
              [{ from: tokenA as `0x${string}`, to: wethAddress, stable: false, factory: factoryAddress }],
            ],
          }) as bigint[];
  
    
          const midAmountWeth = Number(formatEther(amounts[amounts.length - 1]));
  
          // hop2: WETH → tokenB
          const impact2 = await getImpact(
            wethAddress,
            tokenB as `0x${string}`,
            midAmountWeth
          );
  
          impact = impact1 + impact2;
        }
  
        setPriceImpact(impact);
      } catch (err) {
        console.error("Price impact error:", err);
        setPriceImpact(0);
      }
    }
  
    computePriceImpact();
  }, [amountIn, quote, tokenA, tokenB, mode]);

  /**
   * Execute swap
   */
  async function handleSwap() {
    try {
      if (!walletClient || !publicClient || !address) {
        setStatus("Wallet not ready");
        return;
      }
  
      if (slippage < 0 || slippage >= 100) {
        setStatus("Slippage must be between 0 and 100");
        return;
      }
  
      if (!amountIn || quote === BigInt(0)) {
        setStatus("Enter an amount first");
        return;
      }

      const amount = parseEther(amountIn);

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + 600
      );

      const amountOutMin =
        (quote * BigInt(100 - slippage)) / BigInt(100);

      const routes = getRoutes();
    
      let hash: `0x${string}`;

      if (mode !== "buy") {
        const balance = await publicClient.readContract({
          address: tokenA as `0x${string}`,
          abi: [{
            name: "balanceOf",
            type: "function",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
          }],
          functionName: "balanceOf",
          args: [address],
        }) as bigint;
  
        console.log("Token balance:", formatEther(balance));
        console.log("Amount in:", formatEther(amount));
  
        if (balance < amount) {
          setStatus(`Insufficient balance: you have ${formatEther(balance)} tokens`);
          return;
        }
        const allowance = await publicClient.readContract({
          address: tokenA as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, routerAddress],
        }) as bigint;
        
        if (allowance < amount) {
          const approveHash = await walletClient.writeContract({
            address: tokenA as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [routerAddress, amount],
            account: address,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });

          let retries = 0;
          while (retries < 10) {
            const newAllowance = await publicClient.readContract({
              address: tokenA as `0x${string}`,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, routerAddress],
            }) as bigint;
            if (newAllowance >= amount) break;
            await new Promise(r => setTimeout(r, 500));
            retries++;
          }
        }
      }
  
      if (mode === "buy") {
        const ethBalance = await publicClient.getBalance({ address });
        if (ethBalance < amount) {
          setStatus(`Insufficient ETH: you have ${formatEther(ethBalance)} ETH`);
          return;
        }
        hash = await walletClient.writeContract({
          address: routerAddress,
          abi: routerAbi,
          functionName: "swapExactETHForTokens",
          args: [amountOutMin, routes, address, deadline],
          value: amount,
          account: address,
        });
      } else if (mode === "sell") {
        hash = await walletClient.writeContract({
          address: routerAddress,
          abi: routerAbi,
          functionName: "swapExactTokensForETH",
          args: [amount, amountOutMin, routes, address, deadline],
          account: address,
        });
      } else {
        hash = await walletClient.writeContract({
          address: routerAddress,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [amount, amountOutMin, routes, address, deadline],
          account: address,
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });
      

      setStatus("Swap successful");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f1a] text-white flex justify-center items-center">
      <div className="w-[420px] bg-[#121826] p-6 rounded-2xl">

        {/* Mode switch */}
        <div className="flex gap-2 mb-4">
          {["buy", "sell", "swap"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as Mode)}
              className={`flex-1 py-2 rounded ${
                mode === m ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-[#1a2235] p-4 rounded-xl mb-3">
          <div className="text-sm text-gray-400">You pay</div>
          <input
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="w-full bg-transparent text-2xl outline-none"
          />
          <div className="text-xs mt-2 text-gray-500">
            {mode === "buy" ? "ETH" : tokenA}
          </div>
        </div>

        {/* Output */}
        <div className="bg-[#1a2235] p-4 rounded-xl mb-3">
          <div className="text-sm text-gray-400">
            You receive
          </div>
          <div className="text-2xl">
            {quote > BigInt(0) ? formatEther(quote) : "--"}
          </div>
          <div className="text-xs mt-2 text-gray-500">
            {mode === "sell" ? "ETH" : tokenB || tokenA}
          </div>
        </div>

        {/* Token inputs */}
        <input
          placeholder="Token A address"
          value={tokenA}
          onChange={(e) => setTokenA(e.target.value)}
          className="w-full mb-2 px-3 py-2 bg-[#1a2235] rounded"
        />

        {mode === "swap" && (
          <input
            placeholder="Token B address"
            value={tokenB}
            onChange={(e) => setTokenB(e.target.value)}
            className="w-full mb-2 px-3 py-2 bg-[#1a2235] rounded"
          />
        )}

        {/* Info */}
        <div className="text-sm text-gray-400 space-y-2 mt-3">
          <div className="flex justify-between">
            <span>Exchange rate</span>
            <span>1 = {exchangeRate.toFixed(6)}</span>
          </div>

          <div className="flex justify-between">
            <span>Price impact</span>
            <span>{priceImpact.toFixed(4)}%</span>
          </div>

          <div className="flex justify-between">
            <span>Minimum received</span>
            <span>
              {quote > BigInt(0)
                ? formatEther(
                    (quote *
                      BigInt(100 - slippage)) /
                      BigInt(100)
                  )
                : "--"}
            </span>
          </div>
        </div>

        {/* Slippage */}
        <div className="flex items-center mt-4">
          <span className="text-sm text-gray-400 mr-2">
            Slippage
          </span>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="w-16 bg-[#1a2235] px-2 rounded"
          />
          <span className="ml-1 text-gray-400">%</span>
        </div>

        {/* Button */}
        <button
          onClick={handleSwap}
          className="w-full mt-5 bg-blue-600 py-3 rounded-xl"
        >
          Swap
        </button>

        <div className="text-center text-sm mt-3 text-gray-400">
          {status}
        </div>
      </div>
    </main>
  );
}