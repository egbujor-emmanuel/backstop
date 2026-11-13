import { useState } from "react";
import { useAccount } from "wagmi";
import { Panel, TxLink } from "./ui";
import { useStarterKit } from "../hooks/useProtocol";

interface StarterResponse {
  success: boolean;
  tx?: string;
  error?: string;
}

/** One free testnet kit per wallet: 20 test MUSD plus gas, sent by a relayer. */
export function StarterKitCard() {
  const { address } = useAccount();
  const { kitsLeft, claimed, refetch } = useStarterKit(address);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StarterResponse | null>(null);

  async function request() {
    if (!address) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = (await res.json()) as StarterResponse;
      setResult(body);
      refetch();
    } catch {
      setResult({ success: false, error: "The starter-kit service is unreachable. Use the Mezo faucet instead." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="border-dashed">
      <h3 className="font-medium">New to Mezo testnet?</h3>
      <p className="mt-1 text-sm text-muted">
        Get a free starter kit: 20 test MUSD and enough test BTC for gas, one per wallet, so you can buy cover or
        underwrite right away. Test tokens have no value.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={request}
          disabled={!address || busy || claimed === true || kitsLeft === 0n}
          className="rounded-full border border-amber px-4 py-2 text-sm text-amber transition hover:bg-amber hover:text-amber-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Sending…" : claimed ? "Kit already received" : address ? "Send me a starter kit" : "Connect a wallet first"}
        </button>
        <span className="num text-xs text-dim">{kitsLeft !== undefined ? `${kitsLeft.toString()} kits left` : ""}</span>
      </div>
      {result?.success && result.tx && (
        <p className="mt-3 text-sm text-green">
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
