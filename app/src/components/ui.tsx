import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
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
    <a
      href={addrUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 underline decoration-edge underline-offset-4 hover:text-amber hover:decoration-amber"
    >
      <span className="num text-sm">{short(address)}</span>
      {label && (
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
      <span className="sr-only"> (opens the explorer in a new tab)</span>
    </a>
  );
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label ?? `Transaction ${short(hash)}`} on the Mezo explorer (opens in a new tab)`}
      className="num text-sm text-amber underline decoration-amber/40 hover:decoration-amber"
    >
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
  const id = useId();
  const hintId = `${id}-hint`;
  // The hint is a description, not part of the label, so it is linked with aria-describedby.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, {
        id,
        "aria-describedby": hint ? hintId : undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs uppercase tracking-[0.14em] text-muted">
        {label}
      </label>
      {control}
      {hint && (
        <span id={hintId} className="text-xs text-dim">
          {hint}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  "num w-full rounded-xl border border-edge bg-ink px-3.5 py-2.5 text-paper outline-none transition focus:border-amber";

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
  ariaLabel,
}: {
  steps: TxStep[];
  children: ReactNode;
  disabled?: boolean;
  onDone?: () => void;
  variant?: "primary" | "ghost";
  ariaLabel?: string;
}) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashes, setHashes] = useState<{ label: string; hash: string }[]>([]);

  async function run() {
    if (busy) return;
    // Lock the button before any wallet prompt so a second click cannot start a second run.
    setBusy(steps[0]?.label ?? "Working");
    setError(null);
    setHashes([]);
    let confirmed = 0;
    try {
      if (!client) throw new Error("No connection to Mezo testnet. Reload the page and try again.");
      if (chainId !== mezoTestnet.id) await switchChainAsync({ chainId: mezoTestnet.id });
      for (const step of steps) {
        setBusy(step.label);
        const hash = await writeContractAsync({
          address: step.address,
          abi: step.abi,
          functionName: step.functionName,
          args: step.args,
          chainId: mezoTestnet.id,
        } as Parameters<typeof writeContractAsync>[0]);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${step.label} reverted`);
        confirmed += 1;
        setHashes((h) => [...h, { label: step.label, hash }]);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      // Refresh after any confirmed step, even if a later step failed (e.g. approve then a rejected buy),
      // so balances and allowances never stay stale.
      if (confirmed > 0) onDone?.();
    }
  }

  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-wait aria-disabled:opacity-60";
  const style =
    variant === "primary"
      ? "bg-amber text-amber-ink hover:bg-[#ffb83f]"
      : "border border-line text-paper hover:border-amber hover:text-amber";

  return (
    <div className="flex flex-col gap-2">
      {/* While busy the button stays focusable (aria-disabled) so keyboard users keep their place;
          run() ignores clicks. The custom label applies only to the idle, connected state so the
          accessible name always contains the visible text. */}
      <button
        type="button"
        aria-label={isConnected && !busy ? ariaLabel : undefined}
        aria-disabled={busy ? true : undefined}
        aria-busy={busy ? true : undefined}
        className={`${base} ${style}`}
        disabled={!isConnected || disabled}
        onClick={run}
      >
        {busy ? `${busy}…` : isConnected ? children : "Connect a wallet first"}
      </button>
      <div role="status" aria-live="polite" className="flex flex-col gap-1">
        {hashes.map((h) => (
          <span key={h.hash} className="text-xs text-green">
            ✓ {h.label} confirmed · <TxLink hash={h.hash} />
          </span>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-xs text-red">
          {error}
        </span>
      )}
    </div>
  );
}
