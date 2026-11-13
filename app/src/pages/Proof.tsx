import { useRef } from "react";
import type { Address } from "viem";
import { ADDR, DEPLOY_BLOCK, REPO, addrUrl } from "../config";
import { AddressTag, Eyebrow, Panel, TxLink } from "../components/ui";
import { useReveal } from "../lib/motion";
import { useLedger } from "../hooks/useLedger";
import proofRaw from "../data/testnet-v2.jsonl?raw";

const PROOF = proofRaw
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { label: string; tx: string; source?: string });

const CONTRACTS: { name: string; address: Address; role: string }[] = [
  { name: "BackstopPool", address: ADDR.pool, role: "ERC-4626 underwriting vault over MUSD, idle capital in sMUSD" },
  { name: "PolicyManager", address: ADDR.policyManager, role: "Products, premiums, soulbound policy NFTs, insurable-value checks" },
  { name: "ClaimsCourt", address: ADDR.court, role: "Claims, bonds, veMEZO-weighted votes, assessor rewards" },
  { name: "StarterKit", address: ADDR.starterKit, role: "One testnet kit per wallet for new visitors" },
];

export default function Proof() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const ledger = useLedger();
  const outside = ledger.data?.filter((w) => !w.team) ?? [];
  const team = ledger.data?.filter((w) => w.team) ?? [];

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Proof</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">Everything here can be checked on-chain.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        All contracts are deployed on Mezo testnet (chain 31611) and source-verified on Sourcify with an exact match.
      </p>

      <section aria-labelledby="contracts" className="mt-12">
        <h2 id="contracts" className="font-display text-3xl">Contracts</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {CONTRACTS.map((c) => (
            <li key={c.address} data-reveal>
              <Panel>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{c.name}</h3>
                  <a href={`https://repo.sourcify.dev/contracts/full_match/31611/${c.address}/`} target="_blank" rel="noopener noreferrer" className="text-xs text-green hover:underline">
                    Sourcify ✓
                  </a>
                </div>
                <p className="mt-1 text-sm text-muted">{c.role}</p>
                <a href={addrUrl(c.address)} target="_blank" rel="noopener noreferrer" className="num mt-3 block break-all text-xs text-amber hover:underline">
                  {c.address}
                </a>
              </Panel>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ledger" className="mt-16">
        <h2 id="ledger" className="font-display text-3xl">Every wallet that has used BACKSTOP</h2>
        <p className="mt-2 text-sm text-muted">Read from contract events since block {DEPLOY_BLOCK.toString()}. Team wallets are labelled.</p>
        {ledger.isLoading && <p className="mt-4 text-dim">Reading events…</p>}
        {ledger.error && <p className="mt-4 text-red">Could not read events: {(ledger.error as Error).message}</p>}
        {ledger.data && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel>
              <h3 className="text-sm uppercase tracking-wider text-muted">Outside wallets · {outside.length}</h3>
              {outside.length === 0 && <p className="mt-3 text-sm text-dim">None yet. Grab a starter kit and be the first.</p>}
              <ul className="mt-3 flex flex-col gap-2">
                {outside.map((w) => (
                  <li key={w.address} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <AddressTag address={w.address} />
                    <span className="text-xs text-dim">{w.actions.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <h3 className="text-sm uppercase tracking-wider text-muted">Team wallets · {team.length}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {team.map((w) => (
                  <li key={w.address} className="flex flex-col gap-0.5 text-sm">
                    <AddressTag address={w.address} />
                    <span className="text-xs text-dim">{w.actions.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}
      </section>

      <section aria-labelledby="txs" className="mt-16">
        <h2 id="txs" className="font-display text-3xl">Lifecycle transactions</h2>
        <p className="mt-2 text-sm text-muted">
          The run on the current contracts: underwriting, three policies, an approved claim (DRILL-001) and a rejected
          claim (DRILL-002), assessor votes, rewards and the underwriter's exit. Drills are labelled as drills in their
          evidence documents.
        </p>
        <ol className="mt-6 flex flex-col divide-y divide-line border-y border-line">
          {PROOF.map((p, i) => (
            <li key={p.tx} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="text-sm"><span className="num mr-3 text-dim">{String(i + 1).padStart(2, "0")}</span>{p.label}</span>
              <TxLink hash={p.tx} />
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-dim">
          Machine-readable log:{" "}
          <a className="underline hover:text-amber" href={`${REPO}/blob/main/proof/testnet-v2.jsonl`} target="_blank" rel="noopener noreferrer">
            proof/testnet-v2.jsonl
          </a>
          . The same lifecycle also ran on the first deployment, before the security reviews:{" "}
          <a className="underline hover:text-amber" href={`${REPO}/blob/main/proof/testnet.jsonl`} target="_blank" rel="noopener noreferrer">
            proof/testnet.jsonl
          </a>
          .
        </p>
      </section>
    </div>
  );
}
