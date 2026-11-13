import { useReadContract, useReadContracts } from "wagmi";
import { keepPreviousData } from "@tanstack/react-query";
import { erc20Abi, type Address } from "viem";
import { ADDR } from "../config";
import { backstopPoolAbi } from "../abi/BackstopPool";
import { policyManagerAbi } from "../abi/PolicyManager";
import { claimsCourtAbi } from "../abi/ClaimsCourt";
import { starterKitAbi } from "../abi/StarterKit";

const REFRESH = 12_000;

const pool = { address: ADDR.pool, abi: backstopPoolAbi } as const;
const pm = { address: ADDR.policyManager, abi: policyManagerAbi } as const;
const court = { address: ADDR.court, abi: claimsCourtAbi } as const;

export interface PoolStats {
  totalAssets: bigint;
  grossAssets: bigint;
  activeCover: bigint;
  freeCapital: bigint;
  utilizationBps: bigint;
  unvestedPremium: bigint;
  parked: bigint;
  totalShares: bigint;
}

export function usePoolStats() {
  const q = useReadContracts({
    contracts: [
      { ...pool, functionName: "totalAssets" },
      { ...pool, functionName: "grossAssets" },
      { ...pool, functionName: "activeCover" },
      { ...pool, functionName: "freeCapital" },
      { ...pool, functionName: "utilizationBps" },
      { ...pool, functionName: "unvestedPremium" },
      { ...pool, functionName: "parked" },
      { ...pool, functionName: "totalSupply" },
    ],
    allowFailure: false,
    query: { refetchInterval: REFRESH },
  });
  const d = q.data;
  const stats: PoolStats | undefined = d
    ? {
        totalAssets: d[0],
        grossAssets: d[1],
        activeCover: d[2],
        freeCapital: d[3],
        utilizationBps: d[4],
        unvestedPremium: d[5],
        parked: d[6],
        totalShares: d[7],
      }
    : undefined;
  return { ...q, stats };
}

export function useProducts() {
  const count = useReadContract({ ...pm, functionName: "productCount", query: { refetchInterval: REFRESH } });
  const n = Number(count.data ?? 0n);
  const list = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({ ...pm, functionName: "products" as const, args: [BigInt(i)] as const })),
    allowFailure: false,
    query: { enabled: n > 0, refetchInterval: REFRESH, placeholderData: keepPreviousData },
  });
  const refetch = () => Promise.all([count.refetch(), list.refetch()]);
  return { products: list.data ?? [], isLoading: count.isLoading || list.isLoading, refetch };
}

export function usePolicies() {
  const next = useReadContract({ ...pm, functionName: "nextPolicyId", query: { refetchInterval: REFRESH } });
  const n = Number(next.data ?? 1n) - 1;
  const list = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({ ...pm, functionName: "policies" as const, args: [BigInt(i + 1)] as const })),
    allowFailure: false,
    query: { enabled: n > 0, refetchInterval: REFRESH, placeholderData: keepPreviousData },
  });
  const policies = (list.data ?? []).map((p, i) => ({ id: BigInt(i + 1), ...p }));
  const refetch = () => Promise.all([next.refetch(), list.refetch()]);
  return { policies, isLoading: next.isLoading || list.isLoading, refetch };
}

export function useClaims() {
  const count = useReadContract({ ...court, functionName: "claimCount", query: { refetchInterval: REFRESH } });
  const n = Number(count.data ?? 0n);
  const list = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({ ...court, functionName: "claims" as const, args: [BigInt(i)] as const })),
    allowFailure: false,
    query: { enabled: n > 0, refetchInterval: REFRESH, placeholderData: keepPreviousData },
  });
  const claims = (list.data ?? []).map((c, i) => ({ id: BigInt(i), ...c }));
  const rewardPool = useReadContract({ ...court, functionName: "rewardPool", query: { refetchInterval: REFRESH } });
  const refetch = () => Promise.all([count.refetch(), list.refetch(), rewardPool.refetch()]);
  return { claims, rewardPool: rewardPool.data, isLoading: count.isLoading || list.isLoading, refetch };
}

export function useMusd(owner: Address | undefined, spender: Address) {
  const q = useReadContracts({
    contracts: [
      { address: ADDR.musd, abi: erc20Abi, functionName: "balanceOf", args: [owner ?? "0x0000000000000000000000000000000000000000"] },
      { address: ADDR.musd, abi: erc20Abi, functionName: "allowance", args: [owner ?? "0x0000000000000000000000000000000000000000", spender] },
    ],
    allowFailure: false,
    query: { enabled: !!owner, refetchInterval: REFRESH },
  });
  return { balance: q.data?.[0], allowance: q.data?.[1], refetch: q.refetch };
}

export function useStarterKit(owner: Address | undefined) {
  const q = useReadContracts({
    contracts: [
      { address: ADDR.starterKit, abi: starterKitAbi, functionName: "kitsLeft" },
      { address: ADDR.starterKit, abi: starterKitAbi, functionName: "claimed", args: [owner ?? "0x0000000000000000000000000000000000000000"] },
      { address: ADDR.starterKit, abi: starterKitAbi, functionName: "kitsGiven" },
    ],
    allowFailure: false,
    query: { refetchInterval: REFRESH },
  });
  return { kitsLeft: q.data?.[0], claimed: q.data?.[1], kitsGiven: q.data?.[2], refetch: q.refetch };
}

export const STATUS = ["None", "Active", "Paid", "Expired"] as const;
export const OUTCOME = ["Voting", "Approved", "Rejected", "No quorum"] as const;
export const KIND = ["Any holder", "veBTC lock", "MUSD trove"] as const;
