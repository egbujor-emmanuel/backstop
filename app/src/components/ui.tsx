import { useState, type ReactNode } from "react";
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from "wagmi";
import type { Abi, Address } from "viem";
import { addrUrl, txUrl } from "../config";
import { errorMessage, short, teamLabel } from "../lib/format";
import { mezoTestnet } from "../lib/wagmi";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber">{children}</p>
  );
}

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">{label}</span>
      <span className="num text-2xl text-paper sm:text-3xl">
        {value}
        {unit && <span className="ml-1.5 text-sm text-muted">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-dim">{hint}</span>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel/80 p-5 sm:p-6 ${className}`}>{children}</div>
  );
}

export function AddressTag({ address }: { address: string | undefined }) {
  if (!address) return <span className="num text-dim">…</span>;
  const label = teamLabel(address);
  return (
    <a href={addrUrl(address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-amber">
      <span className="num text-sm">{short(address)}</span>
      {label && (
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
    </a>
  );
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noopener noreferrer" className="num text-sm text-amber underline decoration-amber/40 hover:decoration-amber">
      {label ?? short(hash)}
    </a>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-dim">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "num w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-paper outline-none transition focus:border-amber";

export interface TxStep {
  label: string;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

/**
 * Runs one or more contract writes in order, waiting for each receipt.
 * Shows the step in progress, the confirmed hashes and any revert reason.
 */
export function TxButton({
  steps,
  children,
  disabled,
  onDone,
  variant = "primary",
}: {
  steps: TxStep[];
  children: ReactNode;
  disabled?: boolean;
  onDone?: () => void;
  variant?: "primary" | "ghost";
}) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashes, setHashes] = useState<{ label: string; hash: string }[]>([]);

  async function run() {
    setError(null);
    setHashes([]);
    try {
      if (chainId !== mezoTestnet.id) await switchChainAsync({ chainId: mezoTestnet.id });
      for (const step of steps) {
        setBusy(step.label);
        const hash = await writeContractAsync({
          address: step.address,
          abi: step.abi,
          functionName: step.functionName,
          args: step.args,
        } as Parameters<typeof writeContractAsync>[0]);
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${step.label} reverted`);
        setHashes((h) => [...h, { label: step.label, hash }]);
      }
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const style =
    variant === "primary"
      ? "bg-amber text-amber-ink hover:bg-[#ffb83f]"
      : "border border-line text-paper hover:border-amber hover:text-amber";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`${base} ${style}`} disabled={!isConnected || disabled || !!busy} onClick={run}>
        {busy ? `${busy}…` : isConnected ? children : "Connect a wallet first"}
      </button>
      {hashes.map((h) => (
        <span key={h.hash} className="text-xs text-green">
          ✓ {h.label} · <TxLink hash={h.hash} />
        </span>
      ))}
      {error && (
        <span role="alert" className="text-xs text-red">
          {error}
        </span>
      )}
    </div>
  );
}
