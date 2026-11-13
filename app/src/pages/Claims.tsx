import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { ADDR } from "../config";
import { claimsCourtAbi } from "../abi/ClaimsCourt";
import { AddressTag, Eyebrow, Field, Panel, TxButton, inputClass, type TxStep } from "../components/ui";
import { OUTCOME, useClaims, useMusd, usePolicies, useProducts } from "../hooks/useProtocol";
import { dateTime, duration, musd } from "../lib/format";
import { useReveal } from "../lib/motion";

const MAX_UINT = 2n ** 256n - 1n;

function safeHttpUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const OUTCOME_STYLE = ["text-amber", "text-green", "text-red", "text-muted"];

export default function Claims() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const now = useNow();
  const { address } = useAccount();
  const { claims, rewardPool, refetch } = useClaims();
  const { policies, refetch: refetchPolicies } = usePolicies();
  const { products } = useProducts();
  const { balance, allowance, refetch: refetchMusd } = useMusd(address, ADDR.court);
  const quorum = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "quorum" });

  const mine = policies.filter((p) => address && p.holder.toLowerCase() === address.toLowerCase() && Number(p.status) === 1 && !p.claimOpen);
  const [policyId, setPolicyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const selected = mine.find((p) => p.id.toString() === policyId) ?? mine[0];
  const claimAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", 18);
    } catch {
      return 0n;
    }
  }, [amount]);
  const bond = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "bondFor", args: [claimAmount], query: { enabled: claimAmount > 0n } });
  const incidentAt = selected ? BigInt(Math.min(now - 60, Number(selected.end))) : 0n;

  const fileSteps: TxStep[] = [
    ...((allowance ?? 0n) < (bond.data ?? 0n)
      ? [{ label: "Approve bond", address: ADDR.musd, abi: erc20Abi, functionName: "approve", args: [ADDR.court, MAX_UINT] } as TxStep]
      : []),
    { label: "File claim", address: ADDR.court, abi: claimsCourtAbi, functionName: "fileClaim", args: [selected?.id ?? 0n, claimAmount, incidentAt, evidence] },
  ];

  const [voteToken, setVoteToken] = useState("");
  const refresh = () => {
    refetch();
    refetchPolicies();
    refetchMusd();
  };

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Claims court</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">veMEZO holders decide every claim.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        A claim needs a quorum of {quorum.data !== undefined ? musd(quorum.data, 0) : "…"} veMEZO weight and more YES than
        NO. Weight comes from the size and remaining length of a veMEZO lock, and each lock votes once per claim. Winning
        voters share the assessor pool ({musd(rewardPool, 4)} MUSD now) and the bonds of rejected claims.
      </p>

      <section aria-labelledby="list" className="mt-12">
        <h2 id="list" className="sr-only">Claims</h2>
        <div className="flex flex-col gap-4">
          {claims.length === 0 && <Panel>No claims yet.</Panel>}
          {[...claims].reverse().map((c) => {
            const open = Number(c.outcome) === 0;
            const total = c.yesWeight + c.noWeight;
            const yesPct = total > 0n ? Number((c.yesWeight * 1000n) / total) / 10 : 0;
            const ended = now > Number(c.votingEnds);
            const policy = policies.find((p) => p.id === c.policyId);
            const evidenceHref = safeHttpUrl(c.evidenceURI);
            return (
              <article key={c.id.toString()} data-reveal className="rounded-2xl border border-line bg-panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="num text-xs text-dim">Claim #{c.id.toString()} · policy #{c.policyId.toString()}</p>
                    <h3 className="mt-1 text-lg text-paper">
                      {musd(c.amount, 0)} MUSD on {policy ? products[Number(policy.productId)]?.name ?? "…" : "…"}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span>Claimant <AddressTag address={c.claimant} /></span>
                      <span>Incident {dateTime(c.incidentAt)}</span>
                      <span>Bond {musd(c.bond, 2)} MUSD</span>
                    </div>
                    {evidenceHref ? (
                      <a href={evidenceHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-amber hover:underline">
                        Read the evidence →
                      </a>
                    ) : (
                      <p className="mt-2 break-all text-xs text-dim">Evidence: {c.evidenceURI}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-medium ${OUTCOME_STYLE[Number(c.outcome)]}`}>{OUTCOME[Number(c.outcome)]}</p>
                    <p className="num text-xs text-dim">
                      {open ? (ended ? "voting closed · ready to finalize" : `closes in ${duration(Number(c.votingEnds) - now)}`) : `reward pot ${musd(c.rewardPot, 4)} MUSD`}
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-muted">
                    <span className="num">YES {musd(c.yesWeight, 2)}</span>
                    <span className="num">NO {musd(c.noWeight, 2)}</span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-line" aria-label={`${yesPct}% yes`}>
                    <div className="h-full bg-green" style={{ width: `${yesPct}%` }} />
                    <div className="h-full bg-red" style={{ width: `${total > 0n ? 100 - yesPct : 0}%` }} />
                  </div>
                </div>
                {open && (
                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    {!ended && (
                      <>
                        <Field label="Your veMEZO lock id">
                          <input className={`${inputClass} w-36`} inputMode="numeric" value={voteToken} onChange={(e) => setVoteToken(e.target.value.replace(/[^0-9]/g, ""))} />
                        </Field>
                        <TxButton variant="ghost" disabled={!voteToken} onDone={refresh}
                          steps={[{ label: "Vote yes", address: ADDR.court, abi: claimsCourtAbi, functionName: "vote", args: [c.id, BigInt(voteToken || "0"), true] }]}>
                          Vote YES
                        </TxButton>
                        <TxButton variant="ghost" disabled={!voteToken} onDone={refresh}
                          steps={[{ label: "Vote no", address: ADDR.court, abi: claimsCourtAbi, functionName: "vote", args: [c.id, BigInt(voteToken || "0"), false] }]}>
                          Vote NO
                        </TxButton>
                      </>
                    )}
                    {ended && (
                      <TxButton onDone={refresh} steps={[{ label: "Finalize", address: ADDR.court, abi: claimsCourtAbi, functionName: "finalize", args: [c.id] }]}>
                        Finalize claim
                      </TxButton>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="file" className="mt-16 grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <h2 id="file" className="font-display text-3xl">File a claim</h2>
          {!address && <p className="mt-4 text-muted">Connect the wallet that holds the policy.</p>}
          {address && mine.length === 0 && <p className="mt-4 text-muted">This wallet has no active policy without an open claim.</p>}
          {mine.length > 0 && (
            <div className="mt-6 flex flex-col gap-4">
              <Field label="Policy">
                <select className={inputClass} value={selected?.id.toString()} onChange={(e) => setPolicyId(e.target.value)}>
                  {mine.map((p) => (
                    <option key={p.id.toString()} value={p.id.toString()}>
                      #{p.id.toString()} · {products[Number(p.productId)]?.name} · {musd(p.cover, 0)} MUSD
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount (MUSD)" hint={selected ? `Up to ${musd(selected.cover, 0)} MUSD` : undefined}>
                <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
              </Field>
              <Field label="Evidence link" hint="An https link that shows the loss: exploit transaction, your position before and after.">
                <input className={inputClass} value={evidence} onChange={(e) => setEvidence(e.target.value.slice(0, 512))} placeholder="https://…" />
              </Field>
              <p className="text-sm text-muted">
                Bond: <span className="num text-paper">{musd(bond.data, 2)} MUSD</span>, refunded if approved or if quorum is not met. Balance {musd(balance)} MUSD.
              </p>
              <TxButton steps={fileSteps} disabled={!selected || claimAmount === 0n || claimAmount > (selected?.cover ?? 0n) || !safeHttpUrl(evidence)} onDone={refresh}>
                File claim
              </TxButton>
            </div>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-3xl">Collect an assessor reward</h2>
          <p className="mt-4 text-sm text-muted">
            After a claim is decided, anyone can trigger the payout for a winning vote. The reward always goes to the wallet
            that cast it.
          </p>
          <RewardForm claimIds={claims.filter((c) => Number(c.outcome) === 1 || Number(c.outcome) === 2).map((c) => c.id)} onDone={refresh} />
        </Panel>
      </section>
    </div>
  );
}

function RewardForm({ claimIds, onDone }: { claimIds: bigint[]; onDone: () => void }) {
  const [claimId, setClaimId] = useState("");
  const [token, setToken] = useState("");
  const pending = useReadContract({
    address: ADDR.court,
    abi: claimsCourtAbi,
    functionName: "pendingReward",
    args: [BigInt(claimId || "0"), BigInt(token || "0")],
    query: { enabled: claimId !== "" && token !== "" },
  });
  return (
    <div className="mt-6 flex flex-col gap-4">
      <Field label="Claim">
        <select className={inputClass} value={claimId} onChange={(e) => setClaimId(e.target.value)}>
          <option value="">Choose a decided claim</option>
          {claimIds.map((id) => (
            <option key={id.toString()} value={id.toString()}>Claim #{id.toString()}</option>
          ))}
        </select>
      </Field>
      <Field label="veMEZO lock id that voted">
        <input className={inputClass} inputMode="numeric" value={token} onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ""))} />
      </Field>
      <p className="text-sm text-muted">Pending: <span className="num text-paper">{musd(pending.data, 4)} MUSD</span></p>
      <TxButton variant="ghost" disabled={!pending.data} onDone={onDone}
        steps={[{ label: "Claim reward", address: ADDR.court, abi: claimsCourtAbi, functionName: "claimReward", args: [BigInt(claimId || "0"), BigInt(token || "0")] }]}>
        Pay out reward
      </TxButton>
    </div>
  );
}
