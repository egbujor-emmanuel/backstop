import { useRef } from "react";
import { Link } from "react-router-dom";
import { Eyebrow, Panel, Stat, TxLink } from "../components/ui";
import { LivePolicyCard } from "../components/LivePolicyCard";
import { usePoolStats, usePolicies, useClaims } from "../hooks/useProtocol";
import { bps, compact, usd } from "../lib/format";
import { gsap, prefersReducedMotion, useGSAP, useReveal } from "../lib/motion";
import exploit from "../data/oct5_exploit_positions.json";
import proofRaw from "../data/testnet-v2.jsonl?raw";

const PROOF = proofRaw
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { label: string; tx: string });

const LOSS_USD = Number(exploit.totalBtc) * exploit.btcUsdAtExploit;

const ROLES = [
  {
    n: "01",
    who: "You hold a Mezo position",
    what: "Buy a policy in MUSD for your veBTC lock, your trove's collateral, Mezo Swap pools, the MEZO bridge, or a transaction halt.",
    detail: "Cover on a lock or trove can never exceed what that position is worth at MUSD's own PriceFeed, so nobody can over-insure.",
  },
  {
    n: "02",
    who: "Underwriters fill the pot",
    what: "Deposit MUSD and earn premiums on top of Mezo's savings rate: 90% of idle capital is parked in sMUSD.",
    detail: "Every unit of cover is backed 1:1. Withdrawals wait out a cooldown and can never touch capital a policy depends on.",
  },
  {
    n: "03",
    who: "veMEZO holders judge claims",
    what: "Holders of locked MEZO vote on each claim, weighted by the size and length of their lock, and share 5% of every premium.",
    detail: "A claimant posts a 1% bond. A rejected claim's bond goes to the assessors who voted it down.",
  },
];

const PRIMITIVES = [
  { name: "MUSD", use: "Premiums, underwriting capital, bonds and payouts. All of it." },
  { name: "sMUSD Savings Rate", use: "Idle underwriting capital earns Mezo's savings yield." },
  { name: "TroveManager + PriceFeed", use: "Trove cover is sized from real collateral at MUSD's oracle." },
  { name: "veBTC (VotingEscrow)", use: "veBTC cover checks lock ownership and locked BTC on-chain." },
  { name: "veMEZO", use: "Claims are decided by veMEZO lock weight: a new job for MEZO." },
];

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const { stats } = usePoolStats();
  const { policies } = usePolicies();
  const { claims } = useClaims();
  useReveal(root);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from("[data-hero-word]", { yPercent: 110, opacity: 0, duration: 1, stagger: 0.06 })
        .from("[data-hero-sub]", { y: 16, opacity: 0, duration: 0.7 }, "-=0.5")
        .from("[data-hero-cta]", { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.4")
        .from("[data-hero-stripe]", { scaleX: 0, transformOrigin: "left", duration: 1.1 }, 0.2)
        .from("[data-hero-card]", { y: 40, opacity: 0, duration: 1.2 }, 0.5);
    },
    { scope: root },
  );

  const headline = ["When", "Mezo", "has", "a", "bad", "day,", "you're", "covered."];

  return (
    <div ref={root}>
      {/* Hero */}
      <section aria-labelledby="hero" className="relative grain">
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <Eyebrow>Live on Mezo testnet · MUSD cover</Eyebrow>
          <h1 id="hero" aria-label={headline.join(" ")} className="mt-6 max-w-4xl font-display xl:max-w-[44rem] text-[clamp(2.8rem,1.2rem+6vw,6.5rem)] leading-[0.95] tracking-tight">
            {headline.map((w, i) => (
              <span key={i} aria-hidden className="inline-block overflow-hidden pb-2 align-bottom">
                <span data-hero-word className={`inline-block pr-[0.25em] ${w === "covered." ? "italic text-amber" : ""}`}>
                  {w}
                </span>
              </span>
            ))}
          </h1>
          <div data-hero-stripe className="stripe mt-8 h-2 w-40 rounded-full" aria-hidden />
          <p data-hero-sub className="mt-8 max-w-2xl text-lg leading-relaxed text-muted">
            BACKSTOP is insurance for Mezo positions, paid in MUSD. Underwriters earn premiums on top of the MUSD savings
            rate. If a contract you use is exploited, or Mezo stops processing transactions, your claim is decided by
            veMEZO holders and paid from the pool.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link data-hero-cta to="/cover" className="rounded-full bg-amber px-6 py-3 font-medium text-amber-ink transition-colors hover:bg-[#ffb83f]">
              Get cover
            </Link>
            <Link data-hero-cta to="/underwrite" className="rounded-full border border-line px-6 py-3 text-paper transition-colors hover:border-amber hover:text-amber">
              Earn as an underwriter
            </Link>
            <Link data-hero-cta to="/replay" className="px-2 py-3 text-muted underline decoration-line underline-offset-4 hover:text-paper">
              Replay October 5 →
            </Link>
          </div>
          <div data-hero-card className="absolute right-6 top-40 hidden w-[340px] xl:block">
            <LivePolicyCard policyId={1n} />
          </div>
        </div>
      </section>

      {/* Live numbers */}
      <section aria-label="Live pool numbers" className="border-y border-line bg-panel/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-5">
          <Stat label="Pool capital" value={compact(stats?.totalAssets)} unit="MUSD" />
          <Stat label="Parked in sMUSD" value={compact(stats?.parked)} unit="MUSD" />
          <Stat label="Active cover" value={compact(stats?.activeCover)} unit="MUSD" />
          <Stat label="Utilization" value={bps(stats?.utilizationBps)} />
          <Stat label="Policies · claims" value={`${policies.length} · ${claims.length}`} hint="read live from chain 31611" />
        </div>
      </section>

      {/* The day it mattered */}
      <section aria-labelledby="oct5" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div data-reveal>
            <Eyebrow>October 5, 2026 · 18:54 UTC</Eyebrow>
            <h2 id="oct5" className="mt-4 font-display text-5xl leading-[1.02] sm:text-6xl">
              37 positions. <span className="text-red">5.52 BTC</span> gone in twelve minutes.
            </h2>
            <p className="mt-6 max-w-xl text-muted">
              An attacker exploited the veBTC contract and drained 37 locked positions belonging to 36 holders. Mezo repaid
              every one of them from protocol-owned funds. The next day it halted all transactions on the chain for about
              five and a half hours, and wrote that it is looking for automated ways to limit the blast radius next time.
            </p>
            <p className="mt-4 max-w-xl text-muted">
              BACKSTOP is that missing layer: a market where the people who carry the risk are paid to carry it, and the
              protocol's treasury isn't the only backstop.
            </p>
          </div>
          <Panel className="relative overflow-hidden" >
            <div data-reveal className="grid grid-cols-2 gap-6">
              <Stat label="Positions drained" value="37" />
              <Stat label="Holders" value="36" />
              <Stat label="BTC taken" value={exploit.totalBtc} />
              <Stat label="Value at Mezo's oracle" value={usd(LOSS_USD)} hint={`BTC ${usd(exploit.btcUsdAtExploit)}, block ${exploit.priceBlock}`} />
            </div>
            <Link to="/replay" className="mt-6 inline-block text-sm text-amber hover:underline">
              See every position and what cover would have paid →
            </Link>
          </Panel>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Eyebrow>How it works</Eyebrow>
        <h2 id="how" className="mt-4 max-w-3xl font-display text-4xl sm:text-5xl">Three roles. One pot of MUSD.</h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r.n} data-reveal className="flex flex-col gap-4 bg-panel p-7">
              <span className="num text-sm text-amber">{r.n}</span>
              <h3 className="font-display text-3xl leading-tight">{r.who}</h3>
              <p className="text-paper/90">{r.what}</p>
              <p className="text-sm text-dim">{r.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Mezo primitives */}
      <section aria-labelledby="prims" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal>
            <Eyebrow>Built from Mezo's own parts</Eyebrow>
            <h2 id="prims" className="mt-4 font-display text-4xl sm:text-5xl">Every MUSD in the system does real work.</h2>
            <p className="mt-6 text-muted">
              Underwriters must hold MUSD, buyers pay in MUSD, and claimants bond in MUSD: new demand on both sides of the
              market. MUSD's own core contracts are deliberately not covered, because cover paid in MUSD cannot back a
              failure of MUSD itself.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {PRIMITIVES.map((p) => (
              <li key={p.name} data-reveal className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="font-medium text-paper">{p.name}</span>
                <span className="text-sm text-muted sm:text-right">{p.use}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Proof feed */}
      <section aria-labelledby="proof" className="mx-auto max-w-6xl px-4 sm:px-6">
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Proof, not promises</Eyebrow>
              <h2 id="proof" className="mt-3 font-display text-3xl">The whole lifecycle, on-chain</h2>
            </div>
            <Link to="/proof" className="text-sm text-amber hover:underline">All contracts and transactions →</Link>
          </div>
          <ol className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {PROOF.filter((p) => !p.label.includes(" approves ")).slice(0, 12).map((p) => (
              <li key={p.tx} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 text-sm">
                <span className="text-muted">{p.label}</span>
                <TxLink hash={p.tx} />
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-dim">Wallets in these transactions belong to the BACKSTOP team and are labelled as such everywhere in the app.</p>
        </Panel>
      </section>
    </div>
  );
}
