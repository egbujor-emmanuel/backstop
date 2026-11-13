import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { ADDR } from "../config";
import { backstopPoolAbi } from "../abi/BackstopPool";
import { Eyebrow, Field, Panel, Stat, TxButton, inputClass, type TxStep } from "../components/ui";
import { StarterKitCard } from "../components/StarterKitCard";
import { useMusd, usePoolStats } from "../hooks/useProtocol";
import { bps, duration, musd, parseAmount, sanitizeAmount } from "../lib/format";
import { useReveal } from "../lib/motion";

const pool = { address: ADDR.pool, abi: backstopPoolAbi } as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Underwrite() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const now = useNow();
  const { address } = useAccount();
  const { stats, refetch: refetchStats } = usePoolStats();
  const { balance, allowance, refetch: refetchMusd } = useMusd(address, ADDR.pool);
  const me = useReadContracts({
    contracts: [
      { ...pool, functionName: "balanceOf", args: [address ?? ZERO] },
      { ...pool, functionName: "withdrawRequests", args: [address ?? ZERO] },
      { ...pool, functionName: "maxWithdraw", args: [address ?? ZERO] },
      { ...pool, functionName: "maxRedeem", args: [address ?? ZERO] },
      { ...pool, functionName: "withdrawCooldown" },
      { ...pool, functionName: "withdrawWindow" },
    ],
    allowFailure: false,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const shares = me.data?.[0];
  const request = me.data?.[1];
  const maxWithdraw = me.data?.[2];
  const maxRedeem = me.data?.[3];
  const cooldown = me.data?.[4];
  const withdrawWindow = me.data?.[5];
  const position = useReadContracts({
    contracts: [{ ...pool, functionName: "convertToAssets", args: [shares ?? 0n] }],
    allowFailure: false,
    query: { enabled: shares !== undefined, refetchInterval: 12_000 },
  });
  const value = position.data?.[0];

  const [amount, setAmount] = useState("10");
  const deposit = useMemo(() => parseAmount(amount), [amount]);

  const refresh = () => {
    me.refetch();
    refetchStats();
    refetchMusd();
    position.refetch();
  };

  const depositSteps: TxStep[] = [
    ...((allowance ?? 0n) < deposit
      ? [{ label: "Approve MUSD", address: ADDR.musd, abi: erc20Abi, functionName: "approve", args: [ADDR.pool, deposit] } as TxStep]
      : []),
    { label: "Deposit", address: ADDR.pool, abi: backstopPoolAbi, functionName: "deposit", args: [deposit, address ?? ZERO] },
  ];

  const requestShares = request?.[0] ?? 0n;
  const unlockAt = Number(request?.[1] ?? 0n);
  const windowEnd = unlockAt + Number(withdrawWindow ?? 0n);
  let requestState = "No withdrawal requested.";
  if (requestShares > 0n) {
    if (now < unlockAt) requestState = `Cooldown: unlocks in ${duration(unlockAt - now)}.`;
    else if (now <= windowEnd) requestState = `Unlocked. Withdraw within ${duration(windowEnd - now)}.`;
    else requestState = "Withdrawal window expired. Request again.";
  }

  return (
    <div ref={root} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Eyebrow>Underwrite</Eyebrow>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">Earn premiums on top of the MUSD savings rate.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Deposit MUSD and receive bsMUSD shares. 90% of idle capital is parked in Mezo's sMUSD savings vault. Premiums vest
        into the share price over 7 days. If a claim is approved, it is paid from the pool, so underwriters carry that risk
        in exchange for the premiums.
      </p>

      <section aria-label="Pool" className="mt-12 grid grid-cols-2 gap-6 border-y border-line py-8 lg:grid-cols-4">
        <Stat label="Pool capital" value={musd(stats?.totalAssets, 0)} unit="MUSD" />
        <Stat label="Free capital" value={musd(stats?.freeCapital, 0)} unit="MUSD" hint="not backing any policy" />
        <Stat label="Active cover" value={musd(stats?.activeCover, 0)} unit="MUSD" />
        <Stat label="Utilization" value={bps(stats?.utilizationBps)} hint={`${musd(stats?.unvestedPremium, 4)} MUSD premium still vesting`} />
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-3xl">Deposit</h2>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Amount (MUSD)" hint={address ? `Wallet balance: ${musd(balance)} MUSD` : "Connect a wallet to see your balance."}>
              <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} />
            </Field>
            <TxButton steps={depositSteps} disabled={deposit === 0n || (balance !== undefined && deposit > balance)} onDone={refresh}>
              Deposit {amount || "0"} MUSD
            </TxButton>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-3xl">Your position</h2>
          {!address && (
            <p className="mt-6 text-sm text-muted">
              Connect a wallet to see your shares, what they are worth and what you can withdraw.
            </p>
          )}
          {address && (
          <>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <dt className="text-muted">Shares</dt>
            <dd className="num text-right">{shares !== undefined ? musd(shares / 10n ** 6n, 4) : "—"} bsMUSD</dd>
            <dt className="text-muted">Worth</dt>
            <dd className="num text-right">{musd(value, 4)} MUSD</dd>
            <dt className="text-muted">Withdrawable now</dt>
            <dd className="num text-right">{musd(maxWithdraw, 4)} MUSD</dd>
          </dl>
          <p className="mt-4 text-sm text-muted">{requestState}</p>
          <p className="mt-1 text-xs text-dim">
            Cooldown on testnet: {duration(Number(cooldown ?? 0n))}. Withdrawals can never take capital that backs an active policy.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <TxButton
              variant="ghost"
              steps={[{ label: "Request withdrawal", address: ADDR.pool, abi: backstopPoolAbi, functionName: "requestWithdraw", args: [shares ?? 0n] }]}
              disabled={!shares || (requestShares > 0n && now <= windowEnd)}
              onDone={refresh}
            >
              Request withdrawal
            </TxButton>
            <TxButton
              steps={[{ label: "Withdraw", address: ADDR.pool, abi: backstopPoolAbi, functionName: "redeem", args: [maxRedeem ?? 0n, address ?? ZERO, address ?? ZERO] }]}
              disabled={!maxRedeem}
              onDone={refresh}
            >
              Withdraw {musd(maxWithdraw, 2)} MUSD
            </TxButton>
          </div>
          </>
          )}
        </Panel>
      </div>
      <div className="mt-6 max-w-xl">
        <StarterKitCard />
      </div>
    </div>
  );
}
