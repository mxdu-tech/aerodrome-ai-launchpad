import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-gray-500">
          Base · Aerodrome · AI Token Launch
        </p>

        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
          Aerodrome AI Launchpad
        </h1>

        <p className="mb-8 max-w-2xl text-lg leading-8 text-gray-400">
          A lightweight launch assistant that helps users deploy a standard
          ERC20, add initial liquidity on Aerodrome, and view the launch result
          in one clean flow.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/launch"
            className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
          >
            Launch a Token
          </Link>

          <a
            href="https://aerodrome.finance/"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Learn About Aerodrome
          </a>
        </div>
      </section>
    </main>
  );
}