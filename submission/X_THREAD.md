# X thread — BACKSTOP (draft, for you to post if you want)

Showcase only: links, no request for testers or users.

**1/**
On Oct 5, an attacker drained 37 veBTC locks on Mezo: 5.52 BTC, $472,476 at Mezo's own oracle, in 12 minutes.
Mezo paid everyone back from its treasury.

Today that treasury is the only backstop Mezo users have. We built a second one. 🧵

**2/**
BACKSTOP is insurance for Mezo positions, paid in MUSD.

Buy cover for a veBTC lock, a trove, Tigris pools, the MEZO bridge or a transaction halt. If it breaks, veMEZO
holders decide your claim and the pool pays you in MUSD.

**3/**
Underwriters deposit MUSD. Idle capital earns Mezo's savings rate in sMUSD; premiums vest on top.

Every policy is backed 1:1 when sold, and no one can withdraw capital that backs a live policy. The pool can't
promise what it can't pay.

**4/**
The court: each veMEZO lock votes with the weight it had *before* the claim was filed, read from veMEZO's own
checkpoint history.

Merging, splitting or topping up a lock afterwards changes nothing. 60% supermajority, quorum, minimum voters.

**5/**
Why a court and not a trigger? During the Oct 6 halt, Mezo kept producing blocks while transactions stopped.

Only 10 EVM transactions got in over 5.5 hours: a multisig call, a system call and one deployer. A block-time
monitor would have seen nothing wrong.

**6/**
All of it runs on Mezo testnet with real transactions: underwriting, policies, claims approved and rejected,
veMEZO votes, payouts, an underwriter exit, and veBTC cover on a lock in Mezo's real veBTC contract.

4 contracts verified on Sourcify. 100 tests + 6 invariants + fork tests on testnet and mainnet.

**7/**
App: https://backstop-pearl.vercel.app
Code: https://github.com/egbujor-emmanuel/backstop
Every transaction is linked on the Proof page.

Built for the Mezo Buildathon on AKINDO.
