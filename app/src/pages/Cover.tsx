import { useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { ADDR } from "../config";
import { policyManagerAbi } from "../abi/PolicyManager";
import { erc20Abi } from "viem";
import { Eyebrow, Field, Panel, TxButton, inputClass, AddressTag, type TxStep } from "../components/ui";
import { KIND, STATUS, useMusd, usePolicies, useProducts, usePoolStats } from "../hooks/useProtocol";
import { dateTime, musd, bps, compact, parseAmount, sanitizeAmount, shortenAddresses } from "../lib/format";
import { useReveal } from "../lib/motion";
import { StarterKitCard } from "../components/StarterKitCard";

const DAY = 86_400n;

export default function Cover() {
  const root = useRef<HTMLDivElement>(null);
  const { address } = useAccount();
  const { products, refetch: refetchProducts } = useProducts();
  const { policies, refetch: refetchPolicies } = usePolicies();
  const { stats, refetch: refetchStats } = usePoolStats();
  useReveal(root, [products.length]);
  const { balance, allowance, refetch: refetchMusd } = useMusd(address, ADDR.policyManager);

  const [productId, setProductId] = useState(2);
  const [amount, setAmount] = useState("100");
  const [days, setDays] = useState("30");
  const [positionId, setPositionId] = useState("");

  const product = products[productId];
  const kind = product ? Number(product.kind) : 0;
  const cover = useMemo(() => parseAmount(amount), [amount]);
  const durationSec = BigInt(Math.max(0, Math.floor(Number(days) || 0))) * DAY;
  const posId = kind === 1 ? BigInt(positionId || "0") : 0n;

  const quote = useReadContract({
    address: ADDR.policyManager,
    abi: policyManagerAbi,
    functionName: "quote",
    args: [BigInt(productId), cover, durationSec],
    query: { enabled: !!product && cover > 0n && durationSec > 0n },
  });
  const insurable = useReadContract({
    address: ADDR.policyManager,
    abi: policyManagerAbi,
    functionName: "insurableValue",
    args: [BigInt(productId), address ?? "0x0000000000000000000000000000000000000000", posId],
    query: { enabled: !!product && kind !== 0 && !!address && (kind !== 1 || positionId !== "") },
  });

  const premium = quote.data;
  // Approve the premium plus 1%: the utilization multiplier can rise if someone buys first.
  const approval = premium !== undefined ? premium + premium / 100n + 1n : undefined;
  const needsApproval = premium !== undefined && (allowance ?? 0n) < premium;
  const problems: string[] = [];
  if (product && !product.active) problems.push("This product is paused for new policies.");
  if (product && cover > 0n && cover < 10n * 10n ** 18n) problems.push("Minimum cover is 10 MUSD.");
  if (product && cover > product.maxCoverPerPolicy) problems.push(`Maximum per policy is ${musd(product.maxCoverPerPolicy, 0)} MUSD.`);
  if (product && cover + product.activeCover > product.capacity) problems.push("Not enough capacity left on this product.");
  if (stats && cover > stats.freeCapital) problems.push(`The pool has ${musd(stats.freeCapital, 0)} MUSD of free capital.`);
  if (Number(days) < 7 || Number(days) > 365) problems.push("Duration must be 7 to 365 days.");
  if (kind !== 0 && insurable.error) problems.push(kind === 1 ? "You must own this veBTC lock, and it must hold BTC." : "You need an active MUSD trove on this wallet.");
  if (kind !== 0 && insurable.data !== undefined && cover > insurable.data) problems.push(`Your position can be insured for at most ${musd(insurable.data)} MUSD.`);
  if (premium !== undefined && balance !== undefined && balance < premium) problems.push("Not enough MUSD for the premium. Grab a starter kit below.");

  const steps: TxStep[] = [
    ...(needsApproval
      ? [{ label: "Approve MUSD", address: ADDR.musd, abi: erc20Abi, functionName: "approve", args: [ADDR.policyManager, approval ?? 0n] } as TxStep]
      : []),
    { label: "Buy policy", address: ADDR.policyManager, abi: policyManagerAbi, functionName: "buy", args: [BigInt(productId), cover, durationSec, posId, approval ?? 0n] },
  ];

  const mine = policies.filter((p) => address && p.holder.toLowerCase() === address.toLowerCase());

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Get cover</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">Insure a Mezo position in MUSD.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Pick what you want covered, how much and for how long. The premium is fixed when you buy. Your policy is a
        non-transferable NFT bound to your wallet.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Products */}
        <section aria-label="Products" className="flex flex-col gap-3">
          {products.map((p, i) => {
            const used = p.capacity > 0n ? Number((p.activeCover * 10_000n) / p.capacity) : 0;
            const selected = i === productId;
            return (
              <button
                key={p.name}
                type="button"
                data-reveal
                onClick={() => setProductId(i)}
                aria-pressed={selected}
                aria-label={`${p.name}, ${bps(p.annualRateBps)} a year${p.active ? "" : ", paused"}`}
                aria-describedby={`product-${i}-details`}
                className={`group rounded-2xl border p-5 text-left transition-colors ${selected ? "border-amber bg-panel-2" : "border-line bg-panel hover:border-muted"}`}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="block min-w-0">
                    <span className="block font-medium text-paper">{p.name}</span>
                    <span id={`product-${i}-details`} className="mt-1 block text-xs text-dim [overflow-wrap:anywhere]">
                      {shortenAddresses(p.coveredUri)}
                      <span className="sr-only">
                        {" "}
                        {KIND[Number(p.kind)]}. {compact(p.activeCover)} of {compact(p.capacity)} MUSD capacity used.
                      </span>
                    </span>
                  </span>
                  <span className="num shrink-0 text-lg text-amber">{bps(p.annualRateBps)}<span className="text-xs text-dim">/yr</span></span>
                </span>
                <span className="mt-4 flex items-center gap-3 text-xs text-muted" aria-hidden>
                  <span className="rounded-full border border-line px-2 py-0.5">{KIND[Number(p.kind)]}</span>
                  <span className="num">{compact(p.activeCover)} / {compact(p.capacity)} MUSD used</span>
                  {!p.active && <span className="text-red">paused</span>}
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full origin-left bg-amber transition-transform duration-700" style={{ transform: `scaleX(${used / 10_000})` }} />
                </span>
              </button>
            );
          })}
          {products.length === 0 && <Panel>Loading products from chain…</Panel>}
        </section>

        {/* Buy form */}
        <section aria-label="Buy a policy" className="lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <h2 className="font-display text-3xl">{product?.name ?? "…"}</h2>
            <div className="mt-6 flex flex-col gap-4">
              <Field label="Cover (MUSD)">
                <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} />
              </Field>
              <Field label="Duration (days)" hint="7 to 365 days">
                <input className={inputClass} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} />
              </Field>
              {kind === 1 && (
                <Field label="Your veBTC lock id" hint="The token id of a veBTC lock this wallet owns">
                  <input className={inputClass} inputMode="numeric" value={positionId} onChange={(e) => setPositionId(e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
              )}
              {kind !== 0 && (
                <p className="text-sm text-muted">
                  Insurable value of your {kind === 1 ? "lock" : "trove"} at MUSD's PriceFeed:{" "}
                  <span className="num text-paper">{insurable.data !== undefined ? `${musd(insurable.data)} MUSD` : "—"}</span>
                </p>
              )}
              <div className="rounded-xl border border-line bg-ink p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Premium</span>
                  <span className="num text-2xl">{premium !== undefined ? musd(premium, 4) : "—"} <span className="text-sm text-dim">MUSD</span></span>
                </div>
                <p className="mt-2 text-xs text-dim">85% to underwriters, 5% to veMEZO assessors, 10% protocol fee.{address ? ` Your balance: ${musd(balance)} MUSD.` : ""}</p>
              </div>
              <div id="cover-problems" role="status" aria-live="polite">
                {problems.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm text-red">
                    {problems.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                )}
              </div>
              <TxButton
                steps={steps}
                disabled={!product || premium === undefined || problems.length > 0}
                onDone={() => {
                  refetchPolicies();
                  refetchProducts();
                  refetchMusd();
                  refetchStats();
                }}
              >
                {needsApproval ? "Approve and buy cover" : "Buy cover"}
              </TxButton>
            </div>
          </Panel>
          <div className="mt-6">
            <StarterKitCard />
          </div>
        </section>
      </div>

      {/* My policies */}
      <section aria-labelledby="mine" className="mt-16">
        <h2 id="mine" className="font-display text-3xl">Your policies</h2>
        {!address && <p className="mt-3 text-muted">Connect a wallet to see your policies.</p>}
        {address && mine.length === 0 && <p className="mt-3 text-muted">No policies on this wallet yet.</p>}
        {mine.length > 0 && (
          <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-labelledby="mine">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Policies held by the connected wallet</caption>
              <thead className="text-xs uppercase tracking-wider text-dim">
                <tr><th scope="col" className="py-2">#</th><th scope="col">Product</th><th scope="col">Cover</th><th scope="col">Ends</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {mine.map((p) => (
                  <tr key={p.id.toString()} className="border-t border-line">
                    <td className="num py-3">{p.id.toString()}</td>
                    <td>{products[Number(p.productId)]?.name ?? "…"}</td>
                    <td className="num">{musd(p.cover, 0)} MUSD</td>
                    <td className="num">{dateTime(p.end)}</td>
                    <td>{STATUS[Number(p.status)]}{p.claimOpen ? " · claim open" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All policies */}
      <section aria-labelledby="all" className="mt-16">
        <h2 id="all" className="font-display text-3xl">Every policy sold</h2>
        <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-labelledby="all">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Every BACKSTOP policy sold, newest first</caption>
            <thead className="text-xs uppercase tracking-wider text-dim">
              <tr><th scope="col" className="py-2">#</th><th scope="col">Holder</th><th scope="col">Product</th><th scope="col">Cover</th><th scope="col">Premium</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id.toString()} className="border-t border-line">
                  <td className="num py-3">{p.id.toString()}</td>
                  <td><AddressTag address={p.holder} /></td>
                  <td>{products[Number(p.productId)]?.name ?? "…"}</td>
                  <td className="num">{musd(p.cover, 0)}</td>
                  <td className="num">{musd(p.premium, 4)}</td>
                  <td>{STATUS[Number(p.status)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
