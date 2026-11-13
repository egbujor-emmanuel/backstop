# DRILL-002 — rejected-claim drill (Mezo testnet)

**This is a drill, not a real incident.** It shows what happens to a claim that does not meet the
terms: the assessors reject it, and the claimant's bond goes to the assessors who voted correctly.

| Field | Value |
|---|---|
| Product | Mezo transaction halt over 2 hours (product 3) |
| Claimant | BACKSTOP team test wallet `0x7925ceCD8A1705A5A78Aa7eE70c14a7D2E15E645` |
| Amount claimed | 100 MUSD |
| Claimed event | A transaction halt "at filing time" |
| Assessors | BACKSTOP team test wallets holding veMEZO locks #952 and #953 |
| Expected outcome | REJECTED |

## Why it fails

Mezo testnet was producing blocks with EVM transactions throughout the claimed window, and this
claim's own filing transaction was included, so there was no transaction halt. The repo's
`backtest/tx_liveness.py` measures this from public block data. For comparison, the same script run on
Mezo mainnet for 2026-10-06 shows the real halt: zero EVM transactions in most 30-minute buckets
between 09:30 and 15:00 UTC.

Every wallet in this drill belongs to the BACKSTOP team.
