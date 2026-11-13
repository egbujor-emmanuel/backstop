import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { ADDR } from "../config";
import { claimsCourtAbi } from "../abi/ClaimsCourt";
import { AddressTag, Eyebrow, Field, Panel, TxButton, inputClass, type TxStep } from "../components/ui";
import { OUTCOME, useClaims, useMusd, usePolicies, useProducts } from "../hooks/useProtocol";
import { dateTime, duration, musd, parseAmount, sanitizeAmount } from "../lib/format";
import { useReveal } from "../lib/motion";

type ClaimRow = ReturnType<typeof useClaims>["claims"][number];

function safeHttpUrl(url: string): URL | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u : undefined;
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
  const { address } = useAccount();
  const { claims, rewardPool, refetch } = useClaims();
  const { policies, refetch: refetchPolicies } = usePolicies();
  const { products } = useProducts();
  const minVoters = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "minVoters" });
  const approvalBps = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "approvalBps" });
  const quorumNow = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "currentQuorum" });
  useReveal(root, [claims.length]);

  const refresh = () => {
    refetch();
    refetchPolicies();
  };

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Claims court</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">veMEZO holders decide every claim.</h1>
      <p className="mt-4 max-w-3xl text-muted">
        A claim passes when at least {approvalBps.data !== undefined ? Number(approvalBps.data) / 100 : "…"}% of the weight cast is YES, total weight reaches the quorum fixed when the claim was filed (
        {quorumNow.data !== undefined ? musd(quorumNow.data, 0) : "…"} veMEZO now), and at least{" "}
        {minVoters.data?.toString() ?? "…"} different locks vote. Each lock votes with the weight it had just before the claim
        was filed, read from its own on-chain history, so nothing done after filing (a merge, a split, a top-up) changes it.
        Winning voters share the
        assessor pool ({musd(rewardPool, 4)} MUSD now) and the bonds of rejected claims.
      </p>
      <p className="mt-3 max-w-3xl text-sm text-dim">
        On testnet the claims so far are drills: the claimant and both voting locks (veMEZO #952 and #953) belong to the
        team, the vote lasts one hour and the quorum is a fixed 60 veMEZO. Any veMEZO holder can vote on an open claim from
        this page. For mainnet the vote runs at least three days and the quorum becomes a share of all veMEZO voting power.
      </p>

      <section aria-labelledby="list" className="mt-12">
        <h2 id="list" className="sr-only">Claims</h2>
        <div className="flex flex-col gap-4">
          {claims.length === 0 && <Panel>No claims yet.</Panel>}
          {[...claims].reverse().map((c) => {
            const policy = policies.find((p) => p.id === c.policyId);
            const productName = policy ? products[Number(policy.productId)]?.name ?? "…" : "…";
            return (
              <ClaimCard key={c.id.toString()} claim={c} productName={productName} minVoters={minVoters.data} onDone={refresh} />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="file" className="mt-16 grid items-start gap-6 lg:grid-cols-2">
        <FileClaimForm address={address} policies={policies} products={products} onDone={refresh} />
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

function ClaimCard({
  claim: c,
  productName,
  minVoters,
  onDone,
}: {
  claim: ClaimRow;
  productName: string;
  minVoters: bigint | undefined;
  onDone: () => void;
}) {
  const now = useNow();
  const [token, setToken] = useState("");
  const tokenId = token === "" ? undefined : BigInt(token);
  const weight = useReadContract({
    address: ADDR.court,
    abi: claimsCourtAbi,
    functionName: "voteWeight",
    args: [c.id, tokenId ?? 0n],
    query: { enabled: tokenId !== undefined },
  });
  const bondOwed = useReadContract({
    address: ADDR.court,
    abi: claimsCourtAbi,
    functionName: "bondOwed",
    args: [c.id],
    query: { enabled: Number(c.outcome) === 1 || Number(c.outcome) === 3 },
  });
  const open = Number(c.outcome) === 0;
  const total = c.yesWeight + c.noWeight;
  const yesPct = total > 0n ? Number((c.yesWeight * 1000n) / total) / 10 : 0;
  const ended = now > Number(c.votingEnds);
  const evidence = safeHttpUrl(c.evidenceURI);
  const id = c.id.toString();

  const voteStep = (approve: boolean): TxStep[] => [
    { label: approve ? "Vote yes" : "Vote no", address: ADDR.court, abi: claimsCourtAbi, functionName: "vote", args: [c.id, tokenId ?? 0n, approve] },
  ];

  return (
    <article data-reveal className="rounded-2xl border border-line bg-panel p-6" aria-labelledby={`claim-${id}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="num text-xs text-dim">Claim #{id} · policy #{c.policyId.toString()}</p>
          <h3 id={`claim-${id}`} className="mt-1 text-lg text-paper">
            {musd(c.amount, 0)} MUSD on {productName}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>Claimant <AddressTag address={c.claimant} /></span>
            <span>Incident {dateTime(c.incidentAt)}</span>
            <span>Bond {musd(c.bond, 2)} MUSD</span>
          </div>
          {evidence ? (
            <a href={evidence.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-amber hover:underline">
              Read the evidence <span className="text-dim">({evidence.host})</span> →
            </a>
          ) : (
            <p className="mt-2 break-all text-xs text-dim">Evidence: {c.evidenceURI}</p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-lg font-medium ${OUTCOME_STYLE[Number(c.outcome)]}`}>
            {OUTCOME[Number(c.outcome)]}
            {c.payoutPending ? " · payout pending" : ""}
          </p>
          <p className="num text-xs text-dim">
            {open ? (ended ? "voting closed · ready to finalize" : `closes in ${duration(Number(c.votingEnds) - now)}`) : `reward pot ${musd(c.rewardPot, 4)} MUSD`}
          </p>
          <p className="num text-xs text-dim">
            quorum {musd(c.quorum, 0)} · voters {c.voters}
            {minVoters !== undefined ? ` / ${minVoters.toString()} min` : ""}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-xs text-muted">
          <span className="num">YES {musd(c.yesWeight, 2)}</span>
          <span className="num">NO {musd(c.noWeight, 2)}</span>
        </div>
        <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`Claim ${id}: ${yesPct}% of vote weight is yes`}>
          <div className="h-full bg-green" style={{ width: `${yesPct}%` }} />
          <div className="h-full bg-red" style={{ width: `${total > 0n ? 100 - yesPct : 0}%` }} />
        </div>
      </div>
      {open && !ended && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Field label={`Your veMEZO lock id (claim #${id})`} hint={tokenId !== undefined ? `Weight on this claim: ${weight.data !== undefined ? musd(weight.data, 2) : "…"}` : undefined}>
            <input className={`${inputClass} w-40`} inputMode="numeric" value={token} onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
          <TxButton variant="ghost" disabled={!weight.data} onDone={onDone} steps={voteStep(true)} ariaLabel={`Vote yes on claim ${id}`}>
            Vote YES
          </TxButton>
          <TxButton variant="ghost" disabled={!weight.data} onDone={onDone} steps={voteStep(false)} ariaLabel={`Vote no on claim ${id}`}>
            Vote NO
          </TxButton>
        </div>
      )}
      {open && ended && (
        <div className="mt-5">
          <TxButton onDone={onDone} steps={[{ label: "Finalize", address: ADDR.court, abi: claimsCourtAbi, functionName: "finalize", args: [c.id] }]}>
            Finalize claim #{id}
          </TxButton>
        </div>
      )}
      {c.payoutPending && (
        <div className="mt-5">
          <TxButton onDone={onDone} steps={[{ label: "Retry payout", address: ADDR.court, abi: claimsCourtAbi, functionName: "retryPayout", args: [c.id] }]}>
            Retry payout for claim #{id}
          </TxButton>
        </div>
      )}
      {(bondOwed.data ?? 0n) > 0n && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-muted">
            The {musd(bondOwed.data ?? 0n, 2)} MUSD bond refund could not be delivered when this claim closed. It is held for the claimant.
          </p>
          <TxButton
            onDone={() => {
              bondOwed.refetch();
              onDone();
            }}
            steps={[{ label: "Withdraw bond", address: ADDR.court, abi: claimsCourtAbi, functionName: "withdrawBond", args: [c.id] }]}
          >
            Send held bond to the claimant
          </TxButton>
        </div>
      )}
    </article>
  );
}

function FileClaimForm({
  address,
  policies,
  products,
  onDone,
}: {
  address: `0x${string}` | undefined;
  policies: ReturnType<typeof usePolicies>["policies"];
  products: ReturnType<typeof useProducts>["products"];
  onDone: () => void;
}) {
  const now = useNow();
  const { balance, allowance, refetch: refetchMusd } = useMusd(address, ADDR.court);
  const mine = policies.filter((p) => address && p.holder.toLowerCase() === address.toLowerCase() && Number(p.status) === 1 && !p.claimOpen);
  const [policyId, setPolicyId] = useState("");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const selected = mine.find((p) => p.id.toString() === policyId) ?? mine[0];
  const claimAmount = useMemo(() => parseAmount(amount), [amount]);
  const bond = useReadContract({ address: ADDR.court, abi: claimsCourtAbi, functionName: "bondFor", args: [claimAmount], query: { enabled: claimAmount > 0n } });
  // The incident time is the claimant's statement; default to just now, never after the policy's end.
  const incidentAt = selected ? BigInt(Math.max(Number(selected.start), Math.min(now - 60, Number(selected.end)))) : 0n;

  const bondAmount = bond.data;
  const steps: TxStep[] = [
    ...(bondAmount !== undefined && (allowance ?? 0n) < bondAmount
      ? [{ label: "Approve bond", address: ADDR.musd, abi: erc20Abi, functionName: "approve", args: [ADDR.court, bondAmount] } as TxStep]
      : []),
    { label: "File claim", address: ADDR.court, abi: claimsCourtAbi, functionName: "fileClaim", args: [selected?.id ?? 0n, claimAmount, incidentAt, evidence] },
  ];
  const disabled =
    !selected || claimAmount === 0n || claimAmount > (selected?.cover ?? 0n) || !safeHttpUrl(evidence) || bondAmount === undefined || (balance !== undefined && balance < bondAmount);

  return (
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
            <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} />
          </Field>
          <Field label="Evidence link" hint="An https link that shows the loss: the exploit transaction and your position before and after.">
            <input className={inputClass} value={evidence} onChange={(e) => setEvidence(e.target.value.slice(0, 512))} placeholder="https://…" />
          </Field>
          <p className="text-sm text-muted">
            Bond: <span className="num text-paper">{musd(bondAmount, 2)} MUSD</span>, refunded if approved or if quorum is not met. Balance {musd(balance)} MUSD.
          </p>
          <TxButton steps={steps} disabled={disabled} onDone={() => { onDone(); refetchMusd(); }}>
            File claim
          </TxButton>
        </div>
      )}
    </Panel>
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
    query: { enabled: claimId !== "" && token !== "", refetchInterval: 12_000 },
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
      {claimId !== "" && token !== "" && (
        <p className="text-sm text-muted">Pending: <span className="num text-paper">{musd(pending.data, 4)} MUSD</span></p>
      )}
      <TxButton
        variant="ghost"
        disabled={!pending.data}
        onDone={() => {
          pending.refetch();
          onDone();
        }}
        steps={[{ label: "Claim reward", address: ADDR.court, abi: claimsCourtAbi, functionName: "claimReward", args: [BigInt(claimId || "0"), BigInt(token || "0")] }]}
      >
        Pay out reward
      </TxButton>
    </div>
  );
}
