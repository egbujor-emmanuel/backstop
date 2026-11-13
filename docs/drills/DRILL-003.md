# DRILL-003 — veBTC cover, approved-claim drill (Mezo testnet)

**This is a drill, not a real incident.** No Mezo contract was exploited. It exists so anyone can watch
BACKSTOP's veBTC product, the cover that would have protected the 37 positions drained on October 5, run
end to end against Mezo's real veBTC contract with real transactions on Mezo testnet (chain 31611).

| Field | Value |
|---|---|
| Product | veBTC lock: VotingEscrow exploit (product 0) |
| Covered position | A veBTC lock created for this drill in Mezo's testnet veBTC VotingEscrow `0xB63fcCd03521Cf21907627bd7fA465C129479231`: 0.002 BTC for 28 days (veBTC's maximum) |
| Insurable value check | `PolicyManager.insurableValue` read the lock's locked BTC from veBTC and priced it with MUSD's PriceFeed before the policy could be sold |
| Claimant | BACKSTOP team wallet `0x2Be427A7E742FBf394e4c54397bB6aD965167C5d`, the lock's owner |
| Amount claimed | 100 MUSD, the full cover |
| Assessors | BACKSTOP team test wallets holding veMEZO locks #952 and #953 |
| Expected outcome | APPROVED: the drill instructs assessors to approve |

## What assessors check in a real veBTC claim

1. The incident time falls inside the policy's coverage window and the lock was insured before it.
2. The loss comes from the veBTC VotingEscrow contract itself (an exploit of the escrow), not from the
   holder's own key being compromised or a voluntary withdrawal.
3. The evidence links the exploit transaction and shows the lock's `locked()` balance before and after,
   read from the veBTC contract.
4. The amount claimed is no larger than the BTC lost, valued at MUSD's PriceFeed at the incident block.

On October 5, 2026 each of the 37 drained locks would have produced exactly this evidence: the attacker's
transactions and each lock's balance going to zero (see the Replay page and `backtest/`).

Every wallet in this drill belongs to the BACKSTOP team, and the drill is labelled as one on-chain (through
this evidence document) and in the app. The transactions are logged in `proof/testnet-v2.jsonl`.
