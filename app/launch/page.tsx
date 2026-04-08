"use client";

import { useState } from "react";
import Header from "@/components/Header";

type LaunchStatus = "idle" | "validating" | "ready" | "deploying" | "deployed" | "failed";

export default function LaunchPage() {
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [initialSupply, setInitialSupply] = useState("");
  const [initialEthAmount, setInitialEthAmount] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<LaunchStatus>("idle");

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployTxHash, setDeployTxHash] = useState("");
  const [deployedTokenAddress, setDeployedTokenAddress] = useState("");

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

    const supplyNumber = Number(initialSupply);
    const ethAmountNumber = Number(initialEthAmount);

    if (Number.isNaN(supplyNumber) || supplyNumber <= 0) {
      setError("Initial Supply must be a number greater than 0.");
      setStatus("idle");
      setIsSubmitting(false);
      return;
    }

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
    if (status === "idle") {
      return "border-white/10 bg-black/30";
    }

    if (status === "validating") {
      if (step === 1) {
        return "border-yellow-500/40 bg-yellow-500/10";
      }
      return "border-white/10 bg-black/30";
    }

    if (status === "ready") {
      return "border-emerald-500/40 bg-emerald-500/10";
    }

    return "border-white/10 bg-black/30";
  }

  function getStatusText() {
    if (status === "idle") return "Idle";
    if (status === "validating") return "Validating";
    if (status === "ready") return "Ready";
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
              disabled={!submittedData || isDeploying}
              className="w-full rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
              {isDeploying ? "Deploying..." : "Deploy ERC20 Token"}
              </button>
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
          </div>
        </div>
      </section>
    </main>
  );
}