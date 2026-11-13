import { createPublicClient, createWalletClient, defineChain, http, isAddress, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * POST /api/starter  { address }
 * Sends one StarterKit (20 test MUSD + test BTC gas) to a new wallet on Mezo testnet.
 * The StarterKit contract enforces one kit per address; this function only pays the gas.
 */

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
});

const KIT = "0xDE8515faffD1e41b74F0e9DDa7EF116b8219E7D6" as const;
const kitAbi = [
  { type: "function", name: "send", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [] },
  { type: "function", name: "claimed", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "kitsLeft", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (k: string, v: string) => void;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Use POST" });

  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return res.status(503).json({ success: false, error: "Starter kits are not configured on this deployment." });
  }

  const body = (typeof req.body === "string" ? safeJson(req.body) : req.body) as { address?: unknown } | null;
  const raw = body?.address;
  if (typeof raw !== "string" || !isAddress(raw)) {
    return res.status(400).json({ success: false, error: "Send a valid wallet address." });
  }
  const to = getAddress(raw);

  const publicClient = createPublicClient({ chain: mezoTestnet, transport: http() });
  try {
    const [claimed, left] = await Promise.all([
      publicClient.readContract({ address: KIT, abi: kitAbi, functionName: "claimed", args: [to] }),
      publicClient.readContract({ address: KIT, abi: kitAbi, functionName: "kitsLeft" }),
    ]);
    if (claimed) return res.status(409).json({ success: false, error: "This wallet already received a kit." });
    if (left === 0n) return res.status(410).json({ success: false, error: "All kits are gone. Use faucet.test.mezo.org." });

    const account = privateKeyToAccount(key as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mezoTestnet, transport: http() });
    const hash = await wallet.writeContract({ address: KIT, abi: kitAbi, functionName: "send", args: [to] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
    if (receipt.status !== "success") return res.status(502).json({ success: false, error: "The kit transaction reverted." });
    return res.status(200).json({ success: true, tx: hash });
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0] : "Unexpected error";
    return res.status(502).json({ success: false, error: `Could not send the kit: ${message}` });
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
