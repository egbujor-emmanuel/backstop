# AKINDO submission form — BACKSTOP (Mezo Buildathon, Wave 2)

Paste each field into the form. Fields marked **YOU** need your own details.

**Project name**
BACKSTOP

**Project category** (3–5 words)
On-chain cover and insurance

**TL;DR**
BACKSTOP is insurance for Mezo positions, paid in MUSD: underwriters earn premiums on top of the MUSD savings
rate, and if a contract you use is exploited or Mezo stops processing transactions, veMEZO holders decide your claim
and the pool pays you in MUSD.

**How it works**
The problem: on October 5, 2026 an attacker drained 37 veBTC positions (5.52 BTC, $472,476 at Mezo's oracle) in
twelve minutes, and the next day Mezo halted transactions for five and a half hours. Mezo repaid everyone from its
own funds. Today the protocol treasury is the only backstop Mezo users have.

BACKSTOP turns that liability into a market:
- Underwriters deposit MUSD into an ERC-4626 pool. Idle capital earns Mezo's MUSD savings rate in sMUSD, and
  premiums vest into the share price over 7 days. Every policy is backed 1:1 when it is sold, and underwriters can
  never withdraw capital that backs a live policy.
- Buyers insure a veBTC lock, an MUSD trove's collateral, Tigris pools, the MEZO bridge or a transaction halt.
  Cover on a veBTC lock or a trove is capped at its value at MUSD's PriceFeed, read from Mezo's own contracts. The
  premium rises with pool utilisation (1x empty to 5x full), and `maxPremium` stops front-running.
- Claims go to a court of veMEZO holders. Each lock votes with the weight it had just before the claim was filed,
  read from veMEZO's own checkpoint history, so merging, splitting or topping up a lock afterwards changes nothing.
  Approval needs a 60% supermajority, a quorum and a minimum number of locks; payouts come from the pool in MUSD.

MUSD and MEZO: MUSD is the unit of everything — premiums, underwriting capital, claim bonds, payouts and assessor
rewards — so every policy creates MUSD demand on both sides. Idle underwriting capital goes into sMUSD. veMEZO gets a
new job: deciding claims, paid 5% of every premium. BACKSTOP composes six Mezo primitives on-chain: MUSD, sMUSD,
TroveManager, PriceFeed, veBTC and veMEZO.

Proof: four contracts deployed on Mezo testnet and verified on Sourcify (exact match). The full lifecycle ran with
real transactions: underwriting, policies, three drill claims (two approved and paid, including a veBTC policy on a
lock in Mezo's real veBTC contract, and one rejected), veMEZO votes, assessor rewards and an underwriter exit. 100
unit and fuzz tests, 6 invariants, and fork tests of the whole lifecycle against Mezo's real testnet and mainnet
contracts. Every transaction is linked from the app's Proof page and the README.

**Target group**
- Track 1 DeFi users who hold value on Mezo: veBTC lockers, MUSD borrowers with troves, Tigris LPs, and anyone
  bridging MEZO. They buy cover in MUSD.
- MUSD holders who want more than the savings rate: they underwrite and earn premiums on top of sMUSD yield.
- veMEZO holders: they earn from deciding claims.
- Experience level from intermediate DeFi users up; desktop and mobile web (any EVM wallet; the app adds Mezo
  testnet itself and gives new wallets a free starter kit of test MUSD and gas).

**Tech stack**
Solidity 0.8.28, Foundry (unit, fuzz, invariant and fork tests), OpenZeppelin 5 (ERC-4626, ERC-721); React 19, Vite,
wagmi and viem (EIP-6963 wallet discovery), GSAP and Lenis, Tailwind; a Vercel serverless relayer for the starter
kit; Python backtests that read Mezo mainnet for the October 5 and October 6 data; Sourcify verification.

**Track**
Track 1 (DeFi). It also fits Track 2: it gives MUSD a new use (cover) and new holders (underwriters).

**Chain deployed on**
Mezo (testnet, chain 31611)

**Project status**
Entirely new, built during the hackathon.

**Project readiness**
Testnet deployment (contracts verified; full lifecycle on-chain; mainnet-fork tested against Mezo's real mainnet
contracts).

**Future milestones**
1. December 2026: independent audit of the three core contracts; claim-assessment guidelines published with worked
   examples from the October 5 data.
2. Q1 2027: capped mainnet pool (MUSD on Mezo) with veBTC and trove products, through Mezo's Ignition Program.
3. Q2 2027: cover for community protocols on Mezo, priced from on-chain risk signals, and cover bought directly by
   protocols for their users.

**Team info** — **YOU**
Name, role (for example: founder, smart contracts and product), and your X or LinkedIn link.

**Links**
- Live app: https://backstop-pearl.vercel.app
- GitHub: https://github.com/egbujor-emmanuel/backstop
- Deck: https://backstop-pearl.vercel.app/deck.html (PDF: submission/BACKSTOP-deck.pdf in the repo)
- Video: **YOU** — the YouTube link after you upload `submission/BACKSTOP-walkthrough.mp4` as Public or Unlisted
