# BACKSTOP threat model

What BACKSTOP protects, who could attack it, and what in the code stops them. Each defence names the contract
and the test that exercises it.

## Assets

| Asset | Held by | Leaves only through |
|---|---|---|
| Underwriting capital (MUSD, mostly as sMUSD) | `BackstopPool` | ERC-4626 withdrawals by share owners; `payClaim` from `PolicyManager` |
| Assessor rewards and claim bonds (MUSD) | `ClaimsCourt` | Bond refunds to claimants; `claimReward` to winning voters |
| Protocol fee (MUSD) | Treasury address | n/a |

No owner or admin function moves any of these.

## Actors and defences

### A buyer who wants more than their loss

| Attack | Defence | Where |
|---|---|---|
| Insure a veBTC lock or trove for more than it is worth | `insurableValue` caps cover at the position's BTC × MUSD PriceFeed price, summed over every live policy on that position | `PolicyManager._recordInsurableInterest`, tests `test_veBTCCoverCappedAtLockValue`, `test_troveCoverCappedAtCollateralValue` |
| Insure the same lock again after selling it | Position key for veBTC is the token id, not the holder | `test_veBTCOverInsuranceBlockedAcrossOwners` |
| Sell the policy to someone without a loss | Policies are soulbound ERC-721s; payouts go to the original holder | `PolicyManager._update`, `test_policiesAreSoulbound` |
| Claim more than the cover, or claim twice | Claim amount ≤ cover; a settled policy becomes `CLAIMED`; one open claim at a time; at most two claims per policy | `ClaimsCourt.fileClaim`, `PolicyManager.openClaim`, `test_atMostTwoClaimsPerPolicy` |
| Claim for an incident outside coverage | Incident time must be inside `[start, end]` and not in the future; filing closes 14 days after the end | `test_fileClaimValidation`, `test_claimAllowedDuringGraceButNotAfter` |
| Spam the court with claims | 1% bond (minimum 1 MUSD), forfeited to assessors if rejected; at most 2 counted claims per policy, and only 2 `NO_QUORUM` outcomes are forgiven | `test_rejectedClaimForfeitsBondToAssessors`, `test_freeRetriesAreCapped` |
| Push premiums onto later buyers by filling capacity cheaply | The premium scales with pool utilisation (1x empty to 5x full, averaged over the purchase), so crowding out cover costs real money | `PolicyManager.utilizationMultiplierBps`, `test_premiumRisesWithUtilization` |
| Sandwich a buyer into a worse price | `buy` takes `maxPremium` and reverts above it | `test_maxPremiumGuardsAgainstPriceMoves` |

### An underwriter who wants yield without risk

| Attack | Defence | Where |
|---|---|---|
| Deposit just before a premium arrives and leave after | Premiums vest linearly over 7 days | `BackstopPool.unvestedPremium`, `test_justInTimeDepositCannotCapturePremium` |
| Leave when an incident becomes known | Withdrawals need a request and a cooldown, then a limited window | `test_withdrawRequiresRequestAndCooldown` |
| Withdraw capital that backs live policies | `maxRedeem` is capped by `freeCapital = totalAssets − activeCover` | `test_withdrawLimitedToFreeCapital`, invariant `invariant_coverAlwaysFullyBacked` |
| Steal later depositors' funds by donation (ERC-4626 inflation) | 6-decimal virtual share offset | `test_inflationAttackDoesNotStealVictimDeposit` |

### An assessor who wants to steer outcomes

| Attack | Defence | Where |
|---|---|---|
| Vote twice by moving, merging or splitting a veMEZO NFT | Votes are keyed by token id, and weight is read from the lock's own checkpoint history at `filedAt - 1`, the same maths as `balanceOfNFTAt`. Nothing done at or after filing - a merge, a split, a transfer, a top-up - changes it; a burned lock has `locked().amount = 0` and cannot vote | `ClaimsCourt.weightAt`, `test_mergeAfterFilingCannotDoubleCount`, `test_historicalWeightUsesTheRightCheckpoint` |
| Erase an opposing vote with `depositFor` (permissionless top-up) | A top-up after filing writes a new checkpoint with `ts >= filedAt`; the weight read at `filedAt - 1` is untouched | `test_topUpByAnyoneAfterFilingCannotEraseAVote`, `test_topUpInTheFilingSecondCannotEraseAVote` |
| Vote with a lock that expires right after the vote | Weight is zero unless the lock outlasts the vote by `minLockTail`, or is permanent | `test_shortLockHasNoWeight` |
| Vote with a lock created after seeing the claim | No checkpoint exists before filing, so its weight is zero | `test_lockCreatedAfterFilingHasNoWeight` |
| Vote on your own claim | The claimant's address cannot vote on its claim | `test_voteGuards` |
| A small group decides alone | Quorum is the larger of a floor and a share of veMEZO total voting power, snapshotted at filing; at least `minVoters` distinct locks must vote; approval needs a supermajority (`approvalBps`), and a tie is a rejection | `test_relativeQuorumScalesWithTotalVotingPower`, `test_minVotersRequired`, `test_supermajorityRequired`, `test_tieIsRejected` |
| Spoof the quorum by breaking the voting-power read | `currentQuorum` fails closed: if `totalVotingPower` reverts, returns garbage or zero, filing reverts instead of falling back to the floor | `test_relativeQuorumCourtWontDeployWithoutVotingPower` |
| Farm assessor rewards with self-filed claims | A decided claim's reward slice is capped so all claims on one policy can never draw more than the assessor cut that policy paid in (5% of its premium); other buyers' contributions are untouchable | `ClaimsCourt._takeRewardSlice`, `test_rewardSlicesCappedAtThePolicysAssessorCut` |

**Residual risk:** a holder of a large share of veMEZO weight can still sway a vote, and the claimant exclusion is
by address - a claimant can vote from a second wallet it controls (inherent to NFT voting; the history-based weight
makes this expensive, not free, because the locks must have existed before filing). Mitigations on the roadmap: a
challenge window before payout and assessor bonds slashed on overturned votes. On mainnet, the quorum share
(`quorumBps`) and floor will be set well above any single lock.

### Correlated risk

| Risk | Treatment |
|---|---|
| MUSD itself fails | MUSD core contracts are excluded from every product: cover paid in MUSD cannot back a failure of MUSD. |
| sMUSD pauses deposits | `_park` catches the revert and keeps MUSD liquid (`test_parkFailureKeepsDepositsWorking`). |
| sMUSD blocks withdrawals | Payouts and withdrawals would wait until it resumes. The 10% liquid buffer covers small claims, and an approved claim is never lost: the decision is recorded, `finalize` must carry at least 500k gas so a caller cannot starve the payout on purpose, a failed payout is deferred with its (bounded) revert reason, and `retryPayout` is permissionless (`test_payoutDeferredThenRetried`, `test_finalizeWithTooLittleGasRevertsInsteadOfDeferring`, `test_oversizedPayoutRevertReasonIsTruncated`). |
| sMUSD stops reporting yield | The yield read is a guarded staticcall that treats failure as zero, and deposits close while the share price cannot be trusted (below 1% of par); withdrawals always stay open (`test_failingYieldReadDoesNotBrickThePool`). |
| The claimant's address cannot receive MUSD | A bond refund that cannot be delivered is held in `bondOwed` for a permissionless `withdrawBond`, so it never blocks a decision (`test_undeliverableBondIsHeldAndDoesNotBlockTheDecision`). |
| An exploit hits many policies at once | Each product has a capacity cap, and every policy's cover is backed 1:1 at purchase. |

### Admin

The owner can add products, change rates and capacities for **new** policies, set the treasury, and pause new sales. It
cannot move funds, change an existing policy, approve or block a claim, or change the court. `PolicyManager` uses
`Ownable2Step`. The court and pool wiring are set once and cannot be changed (`test_courtWiredOnce`,
`test_setPolicyManagerOnceAndOnlyDeployer`).

## Invariants checked by fuzzing

Run on every `forge test` (256 runs x 64 random calls, reverts fail the run):

1. Pool assets >= active cover (`invariant_coverAlwaysFullyBacked`).
2. Pool active cover = sum of per-product active cover (`invariant_coverAccountingMatches`).
3. Pool active cover = sum of cover on active policies (`invariant_activePoliciesMatchCover`).
4. The pool's `parked` book equals its sMUSD principal (`invariant_parkedMatchesSavings`).
5. The court always holds every open or held bond, every unpaid winning-voter reward and its reward
   pool in MUSD (`invariant_courtSolvent`).
6. Cover recorded per veBTC position = cover of the active policies on that position
   (`invariant_positionCoverMatchesPolicies`).

## Mainnet parameter changes

Testnet uses drill-friendly values. Before mainnet: `votingPeriod` 1 h -> at least 3 days, `quorumBps`
0 -> above 0 (relative quorum on, still failing closed), `minQuorum` 60 -> well above any single lock,
`minVoters` 2 -> at least 5, `withdrawCooldown` 1 h -> at least 7 days, and per-product capacities
sized to the pool. All of these are immutable constructor arguments: changing them is a redeploy,
never a tune.
