import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eyebrow, Panel, Stat } from "../components/ui";
import { MAINNET_EXPLORER, REPO } from "../config";
import { usd } from "../lib/format";
import { useReveal } from "../lib/motion";
import exploit from "../data/oct5_exploit_positions.json";
import halt from "../data/oct6_tx_liveness.json";

/** veBTC cover rate of the live testnet product (3% a year), applied to a 30-day policy. */
const RATE = 0.03;
const DAYS = 30;
const PRICE = exploit.btcUsdAtExploit;
const TOTAL_BTC = Number(exploit.totalBtc);
const TOTAL_USD = TOTAL_BTC * PRICE;
const TOTAL_PREMIUM = TOTAL_USD * RATE * (DAYS / 365);

/** Chart bar color validated against the dark chart surface (dataviz validator: all checks pass). */
const BAR = "#c97d16";

const HALT_START = Date.UTC(2026, 9, 6, 9, 27) / 1000; // Mezo report: transactions halted 09:27 UTC
const HALT_END = Date.UTC(2026, 9, 6, 15, 0) / 1000; // chain unpaused 15:00 UTC

function hhmm(t: number): string {
  return new Date(t * 1000).toISOString().slice(11, 16);
}

function HaltChart() {
  const buckets = halt.buckets.filter((b) => b.blocks > 10);
  const [hover, setHover] = useState<number | null>(null);
  const W = 960;
  const H = 260;
  const pad = { l: 36, r: 12, t: 16, b: 32 };
  const max = Math.max(...buckets.map((b) => b.evmTxs), 1);
  const yMax = Math.ceil(max / 10) * 10;
  const bw = (W - pad.l - pad.r) / buckets.length;
  const x = (i: number) => pad.l + i * bw;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / yMax);
  const t0 = buckets[0].start;
  const span = buckets[buckets.length - 1].start + halt.bucketMinutes * 60 - t0;
  const tx = (t: number) => pad.l + ((t - t0) / span) * (W - pad.l - pad.r);
  const ticks = [0, yMax / 2, yMax];
  const h = hover !== null ? buckets[hover] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby="halt-title halt-desc">
        <title id="halt-title">EVM transactions per 15 minutes on Mezo mainnet, October 6, 2026</title>
        <desc id="halt-desc">
          Blocks kept being produced all day, but EVM transactions fell to zero or one per 15 minutes between about 09:30 and
          15:00 UTC, the transaction halt described in Mezo's incident report.
        </desc>
        {/* Halt window annotation */}
        <rect x={tx(HALT_START)} y={pad.t} width={tx(HALT_END) - tx(HALT_START)} height={H - pad.t - pad.b} fill="#ecebe4" opacity={0.05} />
        <text x={tx(HALT_START) + 8} y={pad.t + 14} fill="#a3a197" fontSize="12" fontFamily="var(--font-sans)">
          Transactions halted 09:27–15:00 UTC (Mezo incident report)
        </text>
        {/* Recessive grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2a2f2b" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fill="#74726a" fontSize="11" fontFamily="var(--font-mono)">{t}</text>
          </g>
        ))}
        {/* Bars: 2px gap, rounded data-end, anchored to baseline */}
        {buckets.map((b, i) => {
          const top = y(b.evmTxs);
          const height = y(0) - top;
          const r = Math.min(4, height / 2, (bw - 2) / 2);
          const w = bw - 2;
          const x0 = x(i) + 1;
          const path =
            height <= 0
              ? ""
              : `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + w - r} Q${x0 + w},${top} ${x0 + w},${top + r} V${y(0)} Z`;
          return (
            <g key={b.start}>
              {path && <path d={path} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {/* Hit target larger than the mark */}
              <rect
                x={x(i)}
                y={pad.t}
                width={bw}
                height={H - pad.t - pad.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${hhmm(b.start)} UTC: ${b.evmTxs} EVM transactions in ${b.blocks} blocks`}
              />
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#74726a" strokeWidth={1} />
        {buckets.filter((_, i) => i % 8 === 0).map((b) => (
          <text key={b.start} x={tx(b.start)} y={H - 10} fill="#74726a" fontSize="11" fontFamily="var(--font-mono)">{hhmm(b.start)}</text>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(80, (x(hover) / W) * 100)}%` }}
        >
          <p className="num text-paper">{hhmm(h.start)}–{hhmm(h.start + halt.bucketMinutes * 60)} UTC</p>
          <p className="text-muted"><span className="num text-paper">{h.evmTxs}</span> EVM transactions</p>
          <p className="text-muted"><span className="num text-paper">{h.blocks}</span> blocks produced</p>
        </div>
      )}
      <figcaption className="mt-3 text-xs text-dim">
        Source: every block from {halt.firstBlock} to {halt.lastBlock} read from Mezo mainnet with{" "}
        <a className="underline hover:text-amber" href={`${REPO}/blob/main/backtest/tx_liveness.py`} target="_blank" rel="noopener noreferrer">backtest/tx_liveness.py</a>.
        Longest stretch with no EVM transaction: {Math.round(halt.longestEmpty.seconds / 60)} minutes, blocks{" "}
        {halt.longestEmpty.fromBlock}–{halt.longestEmpty.toBlock}.
      </figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-paper">Show the data as a table</summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-dim"><tr><th className="py-1">Window (UTC)</th><th>Blocks</th><th>EVM transactions</th></tr></thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start} className="border-t border-line/60">
                  <td className="num py-1">{hhmm(b.start)}</td>
                  <td className="num">{b.blocks}</td>
                  <td className="num">{b.evmTxs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export default function Replay() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const rows = [...exploit.positions].sort((a, b) => Number(b.btc) - Number(a.btc));

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Replay · real Mezo mainnet data</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">What October 5 would have looked like with BACKSTOP.</h1>
      <p className="mt-4 max-w-3xl text-muted">
        Every number on this page comes from Mezo's own incident report and from Mezo mainnet: the 37 drained veBTC
        positions, the BTC price from Mezo's Skip oracle at the exploit block, and every block of the next day's halt.
      </p>

      <section aria-label="Totals" className="mt-12 grid grid-cols-2 gap-6 border-y border-line py-8 lg:grid-cols-4">
        <Stat label="BTC drained" value={exploit.totalBtc} />
        <Stat label="Loss at oracle price" value={usd(TOTAL_USD)} hint={`BTC ${usd(PRICE)} at block ${exploit.priceBlock}`} />
        <Stat label="30-day veBTC cover for all 37" value={usd(TOTAL_PREMIUM)} hint="at the live 3%/yr veBTC rate" />
        <Stat label="Who paid on the day" value="Mezo" hint="from protocol-owned funds" />
      </section>

      <section aria-labelledby="positions" className="mt-14">
        <h2 id="positions" className="font-display text-3xl">The 37 positions</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          With a 30-day BACKSTOP veBTC policy, each holder would have paid the premium shown, and after a claim approved by
          veMEZO assessors been repaid in MUSD from the pool, instead of waiting on the protocol's treasury.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-dim">
              <tr><th className="py-2">veBTC id</th><th>Holder</th><th className="text-right">BTC lost</th><th className="text-right">Value</th><th className="text-right">30-day premium</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const v = Number(p.btc) * PRICE;
                return (
                  <tr key={p.nftId} className="border-t border-line">
                    <td className="num py-2.5">#{p.nftId}</td>
                    <td>
                      <a className="num hover:text-amber" href={`${MAINNET_EXPLORER}/address/${p.holder}`} target="_blank" rel="noopener noreferrer">
                        {p.holder.slice(0, 8)}…{p.holder.slice(-6)}
                      </a>
                    </td>
                    <td className="num text-right">{p.btc}</td>
                    <td className="num text-right">{usd(v)}</td>
                    <td className="num text-right text-amber">{v * RATE * (DAYS / 365) < 1 ? "<$1" : usd(v * RATE * (DAYS / 365))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-dim">
          Source:{" "}
          <a className="underline hover:text-amber" href={exploit.source} target="_blank" rel="noopener noreferrer">Mezo incident report, 2026-10-07</a>. {exploit.priceSource}.
        </p>
      </section>

      <section aria-labelledby="halt" className="mt-20">
        <Eyebrow>October 6 · the day after</Eyebrow>
        <h2 id="halt" className="mt-3 font-display text-4xl">Blocks kept coming. Transactions stopped.</h2>
        <p className="mt-3 max-w-3xl text-muted">
          Mezo halted all transactions while it fixed the bug. Block production never stopped, so a contract cannot detect
          this kind of halt by watching block times. That is why BACKSTOP's transaction-halt cover is decided by the claims
          court, with this measurement as evidence.
        </p>
        <Panel className="mt-8">
          <HaltChart />
        </Panel>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/cover" className="rounded-full bg-amber px-6 py-3 font-medium text-amber-ink hover:bg-[#ffb83f]">Cover your veBTC lock</Link>
        <Link to="/claims" className="rounded-full border border-line px-6 py-3 hover:border-amber hover:text-amber">See the claims court</Link>
      </div>
    </div>
  );
}
