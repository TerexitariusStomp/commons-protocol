import { http, createConfig } from "wagmi";
import { base, baseSepolia, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia, sepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
  },
});

// Deployment addresses per chain — populated by the indexer/worker or env.
export const ADDRESSES = {
  factory: import.meta.env.VITE_FACTORY ?? "",
  router: import.meta.env.VITE_ROUTER ?? "",
  pot: import.meta.env.VITE_POT ?? "",
  stable: import.meta.env.VITE_STABLE ?? "",
} as const;
