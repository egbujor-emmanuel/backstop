## The problem

On **October 5, 2026** an attacker drained **37 veBTC positions (5.52 BTC, $472,476 at Mezo's oracle)** in twelve minutes. The next day Mezo halted transactions for five and a half hours. Mezo paid everyone back from its own funds. Today, the protocol's treasury is the only backstop Mezo users have.

## What BACKSTOP does

BACKSTOP is **insurance for Mezo positions, paid in MUSD**.

- **Buyers** insure a veBTC lock, an MUSD trove's collateral, Tigris pools, the MEZO bridge or a transaction halt. Cover on a veBTC lock or a trove is capped at its real value, read from Mezo's own veBTC, TroveManager and PriceFeed contracts. The price rises as the pool fills, and a max-premium guard stops front-running.
- **Underwriters** deposit MUSD into an ERC-4626 pool. Idle capital earns Mezo's MUSD savings rate in sMUSD, and premiums vest on top. Every policy is backed 1:1 when it is sold, and nobody can withdraw capital that backs a live policy.
- **Claims** are decided by **veMEZO holders**. Each lock votes with the weight it had just before the claim was filed, read from veMEZO's own history, so merging, splitting or topping up a lock afterwards changes nothing. Approval needs a 60% supermajority, a quorum and a minimum number of locks. Payouts come from the pool in MUSD, and winning voters share 5% of every premium.

## Why it matters for MUSD and MEZO

MUSD is the unit of everything: premiums, underwriting capital, claim bonds, payouts and assessor rewards. Every policy creates MUSD demand on both sides, and idle capital flows into sMUSD. veMEZO gets a new job, deciding claims, and gets paid for it. BACKSTOP composes **six Mezo primitives on-chain**: MUSD, sMUSD, TroveManager, PriceFeed, veBTC and veMEZO.

## Proof

- 4 contracts on Mezo testnet, all **verified on Sourcify (exact match)**.
- The whole lifecycle ran with real transactions:
  - underwriting and policies;
  - three drill claims (two approved and paid, including veBTC cover on a lock in Mezo's real veBTC contract, and one rejected);
  - veMEZO votes, assessor rewards and an underwriter exit.
- **100 unit and fuzz tests, 6 invariants, and fork tests** of the full lifecycle against Mezo's real **testnet and mainnet** contracts.
- Every transaction is linked: https://backstop-pearl.vercel.app/#/proof
- On-chain evidence from Mezo mainnet: during the Oct 6 halt only 10 transactions got in (a multisig, a system call and one deployer), which is why halt claims go to a court instead of a block-time trigger.

## Try it

Open https://backstop-pearl.vercel.app, connect any EVM wallet (the app adds Mezo testnet) and tap **Send me a starter kit** for free test MUSD and gas.

## Track, status, readiness

- **Track:** Track 1 (DeFi). It also fits Track 2: a new use for MUSD (cover) and new MUSD holders (underwriters).
- **Status:** entirely new, built during the hackathon.
- **Readiness:** testnet deployment, mainnet-fork tested.

## Next milestones

1. **December 2026:** independent audit of the core contracts; claim-assessment guidelines with worked examples from the Oct 5 data.
2. **Q1 2027:** capped mainnet pool with veBTC and trove products, through Mezo's Ignition Program.
3. **Q2 2027:** cover for community protocols on Mezo, priced from on-chain risk signals.

## Links

- Live app: https://backstop-pearl.vercel.app
- Code: https://github.com/egbujor-emmanuel/backstop
- Deck: https://backstop-pearl.vercel.app/deck.html
