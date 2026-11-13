import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { mezoTestnet as base } from "../config";

/** Mezo testnet with Multicall3 (canonical address, verified deployed on chain 31611). */
export const mezoTestnet = defineChain({
  ...base,
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

export const wagmiConfig = createConfig({
  chains: [mezoTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [mezoTestnet.id]: http("https://rpc.test.mezo.org", { batch: true }) },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
