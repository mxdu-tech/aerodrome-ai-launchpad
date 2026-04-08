import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [
        injected()],
    transports: {
        [baseSepolia.id]: http(),
    },
});