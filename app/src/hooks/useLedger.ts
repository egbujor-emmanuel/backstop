import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { ADDR, DEPLOY_BLOCK } from "../config";
import { teamLabel } from "../lib/format";

/** Contract events that count as using BACKSTOP, and which argument names the wallet. */
const EVENTS = [
  { label: "bought cover", address: ADDR.policyManager, event: parseAbiItem("event PolicyBought(uint256 indexed policyId, address indexed holder, uint256 indexed productId, uint256 cover, uint256 premium, uint256 start, uint256 end, uint256 positionId)"), who: "holder" },
  { label: "underwrote", address: ADDR.pool, event: parseAbiItem("event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"), who: "owner" },
  { label: "filed a claim", address: ADDR.court, event: parseAbiItem("event ClaimFiled(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant, uint256 amount, uint256 incidentAt, uint256 votingEnds, uint256 quorum, string evidenceURI)"), who: "claimant" },
  { label: "voted as assessor", address: ADDR.court, event: parseAbiItem("event Voted(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, bool approve, uint256 weight)"), who: "voter" },
  { label: "got a starter kit", address: ADDR.starterKit, event: parseAbiItem("event KitSent(address indexed to, uint256 musd, uint256 gas)"), who: "to" },
] as const;

/** Mezo's RPC rejects eth_getLogs ranges wider than 10,000 blocks. */
const MAX_LOG_RANGE = 9_000n;

export interface LedgerWallet {
  address: string;
  actions: string[];
  team: boolean;
}

/** Wallets seen so far and the last block read, kept across refreshes so each refresh reads only new blocks. */
const cache = { nextBlock: DEPLOY_BLOCK, wallets: new Map<string, Set<string>>() };

/** Every wallet that has used BACKSTOP, read from contract events since deployment. */
export function useLedger() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["ledger"],
    enabled: !!client,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LedgerWallet[]> => {
      const latest = await client!.getBlockNumber();
      for (let from = cache.nextBlock; from <= latest; from += MAX_LOG_RANGE + 1n) {
        const to = from + MAX_LOG_RANGE > latest ? latest : from + MAX_LOG_RANGE;
        const batches = await Promise.all(
          EVENTS.map((e) => client!.getLogs({ address: e.address, event: e.event, fromBlock: from, toBlock: to }).then((logs) => ({ e, logs }))),
        );
        for (const { e, logs } of batches) {
          for (const log of logs) {
            const who = (log.args as Record<string, unknown>)[e.who] as string | undefined;
            if (!who) continue;
            const key = who.toLowerCase();
            cache.wallets.set(key, (cache.wallets.get(key) ?? new Set()).add(e.label));
          }
        }
        // Advance only after a whole window succeeded, so a failed request is retried next time.
        cache.nextBlock = to + 1n;
      }
      return [...cache.wallets.entries()].map(([address, actions]) => ({ address, actions: [...actions], team: !!teamLabel(address) }));
    },
  });
}
