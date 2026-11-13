# DRILL-001 — approved-claim drill (Mezo testnet)

**This is a drill, not a real incident.** No Mezo contract was exploited. It exists so anyone can
watch a complete BACKSTOP claim, with real transactions on Mezo testnet (chain 31611), from filing to
payout.

| Field | Value |
|---|---|
| Product | Mezo Swap (Tigris) pools exploit (product 2) |
| Claimant | BACKSTOP team test wallet `0x7925ceCD8A1705A5A78Aa7eE70c14a7D2E15E645` |
| Amount claimed | 150 MUSD of a 200 MUSD policy |
| Assessors | BACKSTOP team test wallets holding veMEZO locks #952 and #953 |
| Expected outcome | APPROVED: the drill instructs assessors to approve |

## What assessors check in a real claim

1. The incident time falls inside the policy's coverage window.
2. The loss is on a covered contract listed in the product's terms.
3. The evidence links on-chain transactions that show the loss: the exploit transaction, the
   transfers out of the claimant's position, and the claimant's position before and after.
4. The amount claimed is no larger than the loss shown.

Every wallet in this drill belongs to the BACKSTOP team, and the drill is labelled as one on-chain
(through this evidence document) and in the app.
