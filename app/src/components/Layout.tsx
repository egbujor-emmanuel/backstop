import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { short, teamLabel } from "../lib/format";
import { mezoTestnet } from "../lib/wagmi";
import { REPO } from "../config";
import { useSmoothScroll } from "../lib/motion";

const NAV = [
  { to: "/cover", label: "Get cover" },
  { to: "/underwrite", label: "Underwrite" },
  { to: "/claims", label: "Claims court" },
  { to: "/replay", label: "Oct 5 replay" },
  { to: "/proof", label: "Proof" },
];

function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const hasWallet = typeof window !== "undefined" && "ethereum" in window && !!(window as { ethereum?: unknown }).ethereum;
    if (!hasWallet) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-amber px-4 py-2 text-sm text-amber transition-colors hover:bg-amber hover:text-amber-ink"
        >
          Install a wallet
        </a>
      );
    }
    const injected = connectors[0];
    return (
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={() => injected && connect({ connector: injected, chainId: mezoTestnet.id })}
          className="rounded-full bg-amber px-4 py-2 text-sm font-medium text-amber-ink transition hover:bg-[#ffb83f] active:scale-[0.98]"
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
        {error && <span className="mt-1 text-[11px] text-red">{error.message.split("\n")[0]}</span>}
      </div>
    );
  }
  if (chainId !== mezoTestnet.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: mezoTestnet.id })}
        className="rounded-full border border-red px-4 py-2 text-sm text-red hover:bg-red/10"
      >
        Switch to Mezo Testnet
      </button>
    );
  }
  const label = teamLabel(address);
  return (
    <button
      type="button"
      onClick={() => disconnect()}
      title="Disconnect"
      className="num rounded-full border border-line px-4 py-2 text-sm text-paper transition hover:border-amber"
    >
      {short(address)}
      {label ? " · team" : ""}
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  useSmoothScroll();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2 focus:text-amber-ink">
        Skip to content
      </a>
      <div className="stripe h-1.5 w-full opacity-90" aria-hidden />
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-baseline gap-2" aria-label="BACKSTOP home">
            <span className="font-display text-2xl leading-none tracking-tight text-paper">BACKSTOP</span>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-dim sm:inline">cover for Mezo</span>
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition ${isActive ? "bg-panel-2 text-paper" : "text-muted hover:text-paper"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <ConnectButton />
        </div>
        <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1 text-xs ${isActive ? "bg-panel-2 text-paper" : "text-muted"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            BACKSTOP runs on Mezo testnet (chain 31611). Test tokens only, no real value. Built for the Mezo Buildathon.
          </p>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-amber">
            Source on GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}
