import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Panel, TxLink } from "./ui";
import { useStarterKit } from "../hooks/useProtocol";
import { starterMessage } from "../lib/starterMessage";

interface StarterResponse {
  success: boolean;
  tx?: string;
  error?: string;
}

/** One free testnet kit per wallet: 20 test MUSD plus gas, sent by a relayer after a signature. */
export function StarterKitCard() {
  const { address } = useAccount();
  const { kitsLeft, claimed, refetch } = useStarterKit(address);
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<StarterResponse | null>(null);

  async function request() {
    if (!address || busy) return;
    setResult(null);
    try {
      setBusy("Sign in your wallet…");
      const signature = await signMessageAsync({ message: starterMessage(address) });
      setBusy("Sending…");
      const res = await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      const text = await res.text();
      let body: StarterResponse;
      try {
        body = JSON.parse(text) as StarterResponse;
      } catch {
        body = { success: false, error: `The starter-kit service answered ${res.status}. Use the Mezo faucet instead.` };
      }
      setResult(body);
      if (body.success) setTimeout(() => refetch(), 6_000);
    } catch (e) {
      const message = e instanceof Error && /reject|denied/i.test(e.message) ? "Signature cancelled." : "The starter-kit service is unreachable. Use the Mezo faucet instead.";
      setResult({ success: false, error: message });
    } finally {
      setBusy(null);
    }
  }

  const label = busy ?? (claimed ? "Kit already received" : address ? "Send me a starter kit" : "Connect a wallet first");

  return (
    <Panel className="border-dashed">
      <h3 className="font-medium">New to Mezo testnet?</h3>
      <p className="mt-1 text-sm text-muted">
        Get a free starter kit: 20 test MUSD and enough test BTC for gas, one per wallet, so you can buy cover or
        underwrite right away. You sign a message to prove the wallet is yours; nothing is spent. Test tokens have no
        value.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={request}
          disabled={!address || !!busy || claimed === true || kitsLeft === 0n}
          className="rounded-full border border-amber px-4 py-2 text-sm text-amber transition-colors hover:bg-amber hover:text-amber-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
        <span className="num text-xs text-dim">{kitsLeft !== undefined ? `${kitsLeft.toString()} kits left` : ""}</span>
      </div>
      {result?.success && result.tx && (
        <p className="mt-3 text-sm text-green" role="status">
          Sent · <TxLink hash={result.tx} />
        </p>
      )}
      {result && !result.success && (
        <p role="alert" className="mt-3 text-sm text-red">{result.error}</p>
      )}
      <p className="mt-3 text-xs text-dim">
        Or use the official faucet at{" "}
        <a className="underline hover:text-amber" href="https://faucet.test.mezo.org/" target="_blank" rel="noopener noreferrer">
          faucet.test.mezo.org
        </a>
        .
      </p>
    </Panel>
  );
}
