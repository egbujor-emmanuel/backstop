import { useEffect, useId, useRef, useState } from "react";
import { useConnect, type Connector } from "wagmi";
import { mezoTestnet } from "../lib/wagmi";

/** Popular EVM wallets offered for install when they are not detected. `rdns` is the EIP-6963 id. */
const KNOWN_WALLETS = [
  { rdns: "io.metamask", name: "MetaMask", url: "https://metamask.io/download/" },
  { rdns: "io.rabby", name: "Rabby", url: "https://rabby.io/" },
  { rdns: "com.okex.wallet", name: "OKX Wallet", url: "https://www.okx.com/web3" },
  { rdns: "com.coinbase.wallet", name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet/downloads" },
  { rdns: "com.trustwallet.app", name: "Trust Wallet", url: "https://trustwallet.com/download" },
] as const;

const GENERIC_INJECTED_ID = "injected";

function hasInjectedProvider(): boolean {
  return typeof window !== "undefined" && !!(window as { ethereum?: unknown }).ethereum;
}

/**
 * "Connect wallet" button with a dropdown: wallets detected in this browser (EIP-6963, with their own
 * names and icons) connect in one click; popular wallets that are not installed get an install link.
 */
export function WalletMenu() {
  const { connect, connectors, isPending, error, variables } = useConnect();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // EIP-6963 wallets carry an rdns id; the generic injected connector is only a fallback for older
  // wallets that do not announce themselves.
  const announced = connectors.filter((c) => c.id !== GENERIC_INJECTED_ID);
  const generic = connectors.find((c) => c.id === GENERIC_INJECTED_ID);
  const installed: Connector[] = announced.length > 0 ? announced : generic && hasInjectedProvider() ? [generic] : [];
  const installedIds = new Set(announced.map((c) => c.id));
  const notInstalled = KNOWN_WALLETS.filter((w) => !installedIds.has(w.rdns));
  const pendingId = isPending ? (variables?.connector as Connector | undefined)?.id : undefined;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const choose = (connector: Connector) => {
    connect({ connector, chainId: mezoTestnet.id }, { onSuccess: () => setOpen(false) });
  };

  return (
    <div ref={rootRef} className="relative flex flex-col items-end">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-amber px-4 py-2 text-sm font-medium text-amber-ink transition hover:bg-[#ffb83f] active:scale-[0.98]"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Choose a wallet"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-2 shadow-2xl shadow-black/60"
        >
          <p className="px-3 pb-1 pt-2 text-xs uppercase tracking-[0.14em] text-muted">Installed</p>
          {installed.length === 0 ? (
            <p className="px-3 pb-2 text-sm text-dim">No wallet found in this browser.</p>
          ) : (
            <ul>
              {installed.map((c) => (
                <li key={c.uid}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    disabled={isPending}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-paper transition-colors hover:bg-panel-2 disabled:opacity-60"
                  >
                    <WalletIcon name={c.id === GENERIC_INJECTED_ID ? "Browser wallet" : c.name} icon={c.icon} />
                    <span className="flex-1">{c.id === GENERIC_INJECTED_ID ? "Browser wallet" : c.name}</span>
                    <span className="text-xs text-green">{pendingId === c.id ? "Connecting…" : "Detected"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notInstalled.length > 0 && (
            <>
              <p className="mt-1 border-t border-line px-3 pb-1 pt-3 text-xs uppercase tracking-[0.14em] text-muted">
                Not installed
              </p>
              <ul>
                {notInstalled.map((w) => (
                  <li key={w.rdns}>
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-paper"
                    >
                      <WalletIcon name={w.name} />
                      <span className="flex-1">{w.name}</span>
                      <span className="text-xs text-amber">
                        Install <span aria-hidden>↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-1 border-t border-line px-3 pb-2 pt-3 text-xs text-dim">
            On a phone, open this page in your wallet app's browser. The app adds Mezo testnet for you.
          </p>
        </div>
      )}
      {error && (
        <span role="alert" className="mt-1 max-w-xs text-right text-xs text-red">
          {error.message.split("\n")[0]}
        </span>
      )}
    </div>
  );
}

function WalletIcon({ name, icon }: { name: string; icon?: string }) {
  // Only data: or https: icons announced by the wallet itself are rendered; anything else falls back.
  const safe = icon && (icon.startsWith("data:image/") || icon.startsWith("https://")) ? icon : undefined;
  if (safe) return <img src={safe} alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />;
  return (
    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg border border-edge text-xs font-medium text-paper">
      {name.charAt(0)}
    </span>
  );
}
