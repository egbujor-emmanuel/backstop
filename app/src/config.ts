import { defineChain, type Address } from "viem";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.test.mezo.org"], webSocket: ["wss://rpc-ws.test.mezo.org"] },
  },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
  testnet: true,
});

/** BACKSTOP and the Mezo contracts it composes with. Every address verified on-chain. */
export const ADDR = {
  pool: "0xf8F5D150FE8A66C10eC786F37904a9FB82638B4C",
  policyManager: "0xB9DB90dE921118f1793D81242F571afd722DF05F",
  court: "0xD50CF771E2d0F192CF2100F5Dab9bE0646904a50",
  starterKit: "0xDE8515faffD1e41b74F0e9DDa7EF116b8219E7D6",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  smusd: "0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  veBTC: "0xB63fcCd03521Cf21907627bd7fA465C129479231",
  veMEZO: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
} as const satisfies Record<string, Address>;

export const DEPLOY_BLOCK = 16747011n;

/** Wallets operated by the BACKSTOP team. Shown with a label everywhere they appear. */
export const TEAM_WALLETS: Record<string, string> = {
  "0x2be427a7e742fbf394e4c54397bb6ad965167c5d": "Team · underwriter & trove owner",
  "0x7925cecd8a1705a5a78aa7ee70c14a7d2e15e645": "Team · drill buyer",
  "0xa0008aa705416a036ad7f6b1b4ba6d7bc26f0cca": "Team · assessor (veMEZO #952)",
  "0xaf744e4cf8877fb3369c435798b7076cb9be7b41": "Team · assessor (veMEZO #953)",
  "0x20b2f696485c647cda7e6f56c8f0d0be3eec4d15": "Team · starter-kit relayer",
};

export const EXPLORER = "https://explorer.test.mezo.org";
export const MAINNET_EXPLORER = "https://explorer.mezo.org";
export const REPO = "https://github.com/egbujor-emmanuel/backstop";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
