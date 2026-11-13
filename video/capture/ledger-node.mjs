import { createPublicClient, http, parseAbiItem, defineChain } from "viem";
const chain = defineChain({ id: 31611, name: "Mezo", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } } });
const c = createPublicClient({ chain, transport: http("https://rpc.test.mezo.org", { batch: true }) });
const A = { pm: "0xB9DB90dE921118f1793D81242F571afd722DF05F", pool: "0xf8F5D150FE8A66C10eC786F37904a9FB82638B4C", court: "0xD50CF771E2d0F192CF2100F5Dab9bE0646904a50", kit: "0xDE8515faffD1e41b74F0e9DDa7EF116b8219E7D6" };
const ev = [
  ["PolicyBought", A.pm, "event PolicyBought(uint256 indexed policyId, address indexed holder, uint256 indexed productId, uint256 cover, uint256 premium, uint256 start, uint256 end, uint256 positionId)"],
  ["Deposit", A.pool, "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"],
  ["ClaimFiled", A.court, "event ClaimFiled(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant, uint256 amount, uint256 incidentAt, uint256 votingEnds, uint256 quorum, string evidenceURI)"],
  ["Voted", A.court, "event Voted(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, bool approve, uint256 weight)"],
  ["KitSent", A.kit, "event KitSent(address indexed to, uint256 musd, uint256 gas)"],
];
console.log("latest", await c.getBlockNumber());
for (const [n, a, e] of ev) {
  const t = Date.now();
  try { const logs = await c.getLogs({ address: a, event: parseAbiItem(e), fromBlock: 16747011n, toBlock: "latest" }); console.log(n, logs.length, "logs", Date.now() - t, "ms"); }
  catch (err) { console.log(n, "ERROR", err.shortMessage ?? err.message.split("\n")[0], err.details ?? ""); }
}
