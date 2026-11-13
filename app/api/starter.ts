import { createPublicClient, createWalletClient, defineChain, getAddress, http, isAddress, isHex, verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * POST /api/starter  { address, signature }
 * Sends one StarterKit (20 test MUSD + test BTC gas) to a wallet on Mezo testnet.
 *
 * Abuse controls, in order:
 *  - the caller proves control of the wallet by signing starterMessage(address);
 *  - best-effort per-IP limit (per serverless instance) and a per-address lock that outlives the
 *    request (ADDRESS_LOCK_MS), so a double-click cannot send two transactions for one wallet;
 *  - sends are serialized per instance, so concurrent requests cannot race the relayer nonce;
 *  - the StarterKit contract enforces one kit per address on-chain;
 *  - the relayer refuses to send when its own gas balance is below a floor.
 * The relayer key only pays gas; it holds no kit funds. Errors are logged server-side in full and
 * returned to the caller as a single line.
 */

export const config = { maxDuration: 30 };

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
});

const KIT = "0xDE8515faffD1e41b74F0e9DDa7EF116b8219E7D6" as const;
const RELAYER_GAS_FLOOR = 10_000_000_000_000n; // 0.00001 BTC
const IP_LIMIT = 3;
const IP_WINDOW_MS = 60 * 60 * 1000;
/** How long an address stays locked after a send, so the on-chain `claimed` flag has time to turn. */
const ADDRESS_LOCK_MS = 90_000;
const RPC_TIMEOUT_MS = 8_000;

const kitAbi = [
  { type: "function", name: "send", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }], outputs: [] },
  { type: "function", name: "claimed", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "kitsLeft", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;


/** Must match src/lib/starterMessage.ts exactly (kept inline: Vercel runs this file as an ES module). */
function starterMessage(address: string): string {
  return `BACKSTOP starter kit for ${address.toLowerCase()} on Mezo testnet (chain 31611)`;
}

const ipHits = new Map<string, number[]>();
/** Address → time its kit was last sent or attempted. */
const addressLockedAt = new Map<string, number>();
/** Chains sends so two requests on one warm instance never fetch the same relayer nonce. */
let sendChain: Promise<unknown> = Promise.resolve();

function enqueueSend<T>(task: () => Promise<T>): Promise<T> {
  const next = sendChain.then(task, task);
  sendChain = next.catch(() => undefined);
  return next;
}

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (k: string, v: string) => void;
}

function clientIp(req: Req): string {
  for (const header of ["x-real-ip", "x-vercel-forwarded-for", "x-forwarded-for"]) {
    const value = req.headers?.[header];
    const first = (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function overIpLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_LIMIT) {
    ipHits.set(ip, recent);
    return true;
  }
  ipHits.set(ip, [...recent, now]);
  return false;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Use POST" });

  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return res.status(503).json({ success: false, error: "Starter kits are not configured on this deployment." });
  }

  const body = (typeof req.body === "string" ? safeJson(req.body) : req.body) as { address?: unknown; signature?: unknown } | null;
  const raw = body?.address;
  const signature = body?.signature;
  if (typeof raw !== "string" || !isAddress(raw)) {
    return res.status(400).json({ success: false, error: "Send a valid wallet address." });
  }
  if (typeof signature !== "string" || !isHex(signature)) {
    return res.status(400).json({ success: false, error: "Sign the request with your wallet first." });
  }
  const to = getAddress(raw);

  let valid = false;
  try {
    valid = await verifyMessage({ address: to, message: starterMessage(to), signature });
  } catch {
    valid = false;
  }
  if (!valid) return res.status(401).json({ success: false, error: "The signature does not match this wallet." });

  if (overIpLimit(clientIp(req))) {
    return res.status(429).json({ success: false, error: "Too many kits from this network. Try again in an hour." });
  }
  const lock = to.toLowerCase();
  const lockedAt = addressLockedAt.get(lock);
  if (lockedAt !== undefined && Date.now() - lockedAt < ADDRESS_LOCK_MS) {
    return res.status(409).json({ success: false, error: "A kit for this wallet is already on its way." });
  }
  addressLockedAt.set(lock, Date.now());
  let sent = false;

  try {
    const transport = http(undefined, { timeout: RPC_TIMEOUT_MS, retryCount: 1 });
    const publicClient = createPublicClient({ chain: mezoTestnet, transport });
    const account = privateKeyToAccount(key as `0x${string}`);
    const [claimed, left, gas] = await Promise.all([
      publicClient.readContract({ address: KIT, abi: kitAbi, functionName: "claimed", args: [to] }),
      publicClient.readContract({ address: KIT, abi: kitAbi, functionName: "kitsLeft" }),
      publicClient.getBalance({ address: account.address }),
    ]);
    if (claimed) return res.status(409).json({ success: false, error: "This wallet already received a kit." });
    if (left === 0n) return res.status(410).json({ success: false, error: "All kits are gone. Use faucet.test.mezo.org." });
    if (gas < RELAYER_GAS_FLOOR) return res.status(503).json({ success: false, error: "The kit relayer is out of gas. Use faucet.test.mezo.org." });

    const wallet = createWalletClient({ account, chain: mezoTestnet, transport });
    const hash = await enqueueSend(async () => {
      // Simulate first so a revert is reported instead of paying gas for it, then pin the nonce.
      const { request } = await publicClient.simulateContract({ account, address: KIT, abi: kitAbi, functionName: "send", args: [to] });
      const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
      return wallet.writeContract({ ...request, nonce });
    });
    sent = true;
    return res.status(200).json({ success: true, tx: hash });
  } catch (e) {
    console.error("starter kit send failed", { to, error: e });
    const message = e instanceof Error ? e.message.split("\n")[0] : "Unexpected error";
    return res.status(502).json({ success: false, error: `Could not send the kit: ${message}` });
  } finally {
    // Keep the lock after a send so a retry inside the window cannot submit a duplicate; release it
    // at once when nothing was sent so the user can simply try again.
    if (!sent) addressLockedAt.delete(lock);
  }
}
