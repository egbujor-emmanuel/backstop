import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { short, teamLabel } from "../lib/format";
import { mezoTestnet } from "../lib/wagmi";
import { REPO } from "../config";
import { useSmoothScroll } from "../lib/motion";
import { WalletMenu } from "./WalletMenu";

const TITLES: Record<string, string> = {
  "/": "BACKSTOP · cover for Mezo",
  "/cover": "Get cover · BACKSTOP",
  "/underwrite": "Underwrite · BACKSTOP",
  "/claims": "Claims court · BACKSTOP",
  "/replay": "Oct 5 replay · BACKSTOP",
  "/proof": "Proof · BACKSTOP",
};

const NAV = [
  { to: "/cover", label: "Get cover" },
  { to: "/underwrite", label: "Underwrite" },
  { to: "/claims", label: "Claims court" },
  { to: "/replay", label: "Oct 5 replay" },
  { to: "/proof", label: "Proof" },
];

function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) return <WalletMenu />;
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
      aria-label={`${short(address)}${label ? " · team" : ""}: disconnect wallet`}
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
  const [announcement, setAnnouncement] = useState("");
  const firstRender = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    const title = TITLES[pathname] ?? "BACKSTOP";
    document.title = title;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Tell screen-reader users the page changed and start them at the new page's content.
    setAnnouncement(title);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <a
        href="#main"
        onClick={(e) => {
          // HashRouter treats the hash as the route, so move focus instead of navigating.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2 focus:text-amber-ink">
        Skip to content
      </a>
      <div className="stripe h-1.5 w-full opacity-90" aria-hidden />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <header className="z-40 lg:sticky lg:top-0 border-b border-line/70 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-baseline gap-2" aria-label="BACKSTOP home">
            <span className="font-display text-2xl leading-none tracking-tight text-paper">BACKSTOP</span>
            <span className="hidden text-xs uppercase tracking-[0.2em] text-dim sm:inline">cover for Mezo</span>
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm transition ${isActive ? "bg-panel-2 text-paper underline decoration-amber decoration-2 underline-offset-[6px]" : "text-muted hover:text-paper"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <ConnectButton />
        </div>
        <nav aria-label="Main mobile" className="flex flex-wrap gap-1 px-4 pb-2 lg:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-2 text-xs ${isActive ? "bg-panel-2 text-paper underline decoration-amber decoration-2 underline-offset-4" : "text-muted"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
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
