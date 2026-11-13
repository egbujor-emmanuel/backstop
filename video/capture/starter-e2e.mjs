// End-to-end test of the live starter-kit endpoint with a fresh throwaway wallet.
// Signs the same message the app signs, POSTs it, waits for the kit transaction, and checks the
// wallet's MUSD and BTC on chain. Then checks the endpoint refuses a second kit for that wallet.
import { createPublicClient, defineChain, formatEther, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const API = "https://backstop-pearl.vercel.app/api/starter";
const KIT = "0xDE8515faffD1e41b74F0e9DDa7EF116b8219E7D6";
const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const chain = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
});
const client = createPublicClient({ chain, transport: http() });
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const kitAbi = parseAbi(["function claimed(address) view returns (bool)", "function kitsLeft() view returns (uint256)"]);

const starterMessage = (address) => `BACKSTOP starter kit for ${address.toLowerCase()} on Mezo testnet (chain 31611)`;

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

const account = privateKeyToAccount(generatePrivateKey());
console.log("throwaway wallet", account.address);
console.log("kits left before", (await client.readContract({ address: KIT, abi: kitAbi, functionName: "kitsLeft" })).toString());

// 1. A bad signature is refused.
const bad = await post({ address: account.address, signature: "0x1234" });
console.log("bad signature ->", bad.status, bad.json.error);

// 2. A valid signature gets a kit.
const signature = await account.signMessage({ message: starterMessage(account.address) });
const first = await post({ address: account.address, signature });
console.log("valid request ->", first.status, JSON.stringify(first.json));
if (!first.json.success) process.exit(1);
const receipt = await client.waitForTransactionReceipt({ hash: first.json.tx, timeout: 90_000 });
console.log("kit tx status", receipt.status, "block", receipt.blockNumber.toString());

const musd = await client.readContract({ address: MUSD, abi: erc20, functionName: "balanceOf", args: [account.address] });
const btc = await client.getBalance({ address: account.address });
const claimed = await client.readContract({ address: KIT, abi: kitAbi, functionName: "claimed", args: [account.address] });
console.log("wallet MUSD", formatEther(musd), "BTC", formatEther(btc), "claimed", claimed);

// 3. A second request for the same wallet is refused (address lock, then the on-chain flag).
const second = await post({ address: account.address, signature });
console.log("second request ->", second.status, second.json.error);

const ok = bad.status === 401 && receipt.status === "success" && musd > 0n && btc > 0n && claimed && second.status === 409;
console.log(ok ? "STARTER KIT E2E PASSED" : "STARTER KIT E2E FAILED");
process.exit(ok ? 0 : 1);
