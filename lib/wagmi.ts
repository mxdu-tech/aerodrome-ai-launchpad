import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        metaMask({
            debug: true,
            dapp: {
                name: "Aerodrome AI Launchpad",
                url: "http://localhost:3000",
            },
          }),
        ],
    transports: {
        [baseSepolia.id]: http("https://sepolia.base.org"),
    },
});