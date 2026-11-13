// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVotingEscrow} from "../src/interfaces/IMezo.sol";
import {ClaimsCourt} from "../src/ClaimsCourt.sol";
import {PolicyManager} from "../src/PolicyManager.sol";

contract ClaimsCourtTest is Fixture {
    uint256 internal policyId;
    uint256 internal constant COVER = 10_000e18;

    function setUp() public override {
        super.setUp();
        _underwrite(500_000e18);
        policyId = _buy(assessedProduct, COVER, 90 days, 0);
        // Two assessors: one permanent lock, one 4-year lock.
        _giveVeMEZO(1, assessorA, 800e18, 0, true);
        _giveVeMEZO(2, assessorB, 1_000e18, block.timestamp + 1_456 days, false);
    }

    function _file(uint256 amount) internal returns (uint256 claimId) {
        vm.prank(buyer);
        claimId = court.fileClaim(policyId, amount, block.timestamp - 1, "ipfs://evidence");
    }

    function _vote(address who, uint256 claimId, uint256 tokenId, bool approve) internal {
        vm.prank(who);
        court.vote(claimId, tokenId, approve);
    }

    // ---------------- filing ----------------

    function test_fileClaimTakesBondAndOpensClaim() public {
        vm.warp(block.timestamp + 1 days);
        uint256 before = musd.balanceOf(buyer);
        uint256 claimId = _file(5_000e18);
        assertEq(before - musd.balanceOf(buyer), 50e18, "1% bond");
        ClaimsCourt.Claim memory c = court.claims(claimId);
        assertEq(c.amount, 5_000e18);
        assertEq(c.bond, 50e18);
        assertEq(c.votingEnds, block.timestamp + VOTING_PERIOD);
        assertTrue(pm.policies(policyId).claimOpen);
    }

    function test_bondHasMinimum() public view {
        assertEq(court.bondFor(10e18), 1e18);
        assertEq(court.bondFor(1_000e18), 10e18);
    }

    function test_fileClaimValidation() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(stranger);
        vm.expectRevert(ClaimsCourt.NotHolder.selector);
        court.fileClaim(policyId, 1_000e18, block.timestamp - 1, "e");

        PolicyManager.Policy memory pol = pm.policies(policyId);
        vm.startPrank(buyer);
        vm.expectRevert(ClaimsCourt.BadIncidentTime.selector);
        court.fileClaim(policyId, 1_000e18, pol.start - 1, "e");
        vm.expectRevert(ClaimsCourt.BadIncidentTime.selector);
        court.fileClaim(policyId, 1_000e18, block.timestamp + 1, "e");
        vm.expectRevert(ClaimsCourt.BadAmount.selector);
        court.fileClaim(policyId, COVER + 1, block.timestamp - 1, "e");
        vm.expectRevert(ClaimsCourt.BadAmount.selector);
        court.fileClaim(policyId, 0, block.timestamp - 1, "e");
        vm.expectRevert(ClaimsCourt.BadEvidence.selector);
        court.fileClaim(policyId, 1_000e18, block.timestamp - 1, "");
        vm.stopPrank();
    }

    function test_claimAllowedDuringGraceButNotAfter() public {
        PolicyManager.Policy memory pol = pm.policies(policyId);
        vm.warp(uint256(pol.end) + 14 days);
        vm.prank(buyer);
        court.fileClaim(policyId, 1_000e18, pol.end - 1, "ipfs://late-but-valid");

        uint256 other = _buy(assessedProduct, 1_000e18, 30 days, 0);
        PolicyManager.Policy memory pol2 = pm.policies(other);
        vm.warp(uint256(pol2.end) + 14 days + 1);
        vm.prank(buyer);
        vm.expectRevert(ClaimsCourt.ClaimWindowClosed.selector);
        court.fileClaim(other, 1_000e18, pol2.end - 1, "e");
    }

    function test_onlyOneOpenClaimPerPolicy() public {
        vm.warp(block.timestamp + 1 days);
        _file(1_000e18);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.ClaimAlreadyOpen.selector);
        court.fileClaim(policyId, 1_000e18, block.timestamp - 1, "e");
    }

    function test_transactionHaltClaimGoesThroughCourt() public {
        uint256 haltPolicy = _buy(haltProduct, 1_000e18, 30 days, 0);
        vm.warp(block.timestamp + 1 days);
        vm.prank(buyer);
        uint256 claimId = court.fileClaim(haltPolicy, 1_000e18, block.timestamp - 1, "ipfs://tx-liveness-report");
        _vote(assessorA, claimId, 1, true);
        _vote(assessorB, claimId, 2, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.APPROVED));
        assertEq(uint8(pm.policies(haltPolicy).status), uint8(PolicyManager.Status.CLAIMED));
    }

    // ---------------- voting ----------------

    function test_voteWeights() public view {
        uint256 snap = block.timestamp + 1; // locks were created in setUp, before this snapshot
        uint256 ends = snap + VOTING_PERIOD;
        assertEq(court.weightAt(1, snap, ends), 800e18, "permanent counts in full");
        assertApproxEqRel(court.weightAt(2, snap, ends), 1_000e18, 1e12, "max lock counts ~in full");
    }

    function test_shortLockHasNoWeight() public {
        _giveVeMEZO(3, assessorA, 1_000e18, block.timestamp + 1 + VOTING_PERIOD + MIN_LOCK_TAIL - 1, false);
        assertEq(court.weightAt(3, block.timestamp + 1, block.timestamp + 1 + VOTING_PERIOD), 0);
    }

    function test_weightDecaysWithRemainingLock() public {
        _giveVeMEZO(4, assessorA, 1_456e18, block.timestamp + 728 days, false);
        assertApproxEqRel(court.weightAt(4, block.timestamp + 1, block.timestamp + 1 + VOTING_PERIOD), 728e18, 1e12);
    }

    function test_weightIsTakenAtFilingNotAtVote() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        uint256 atFiling = court.voteWeight(claimId, 2);
        vm.warp(block.timestamp + VOTING_PERIOD);
        assertEq(court.voteWeight(claimId, 2), atFiling, "decay during the vote does not change weight");
    }

    function test_mergeAfterFilingCannotDoubleCount() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        uint256 lock2Before = court.voteWeight(claimId, 2);
        _vote(assessorA, claimId, 1, true);
        // Merge lock 1 into lock 2 after filing: lock 1 is burned, lock 2 grows.
        veMEZO.burn(1);
        _giveVeMEZO(2, assessorB, 1_800e18, block.timestamp + 1_456 days, false);
        assertEq(court.voteWeight(claimId, 2), lock2Before, "lock 2 keeps its pre-filing weight, not 1,800");
        _vote(assessorB, claimId, 2, true);
        assertApproxEqRel(court.claims(claimId).yesWeight, 800e18 + lock2Before, 1e12);
    }

    function test_topUpByAnyoneAfterFilingCannotEraseAVote() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        uint256 before = court.voteWeight(claimId, 2);
        // VotingEscrow.depositFor is permissionless: a stranger writes a checkpoint on lock 2.
        veMEZO.depositFor(2, 1);
        assertEq(court.voteWeight(claimId, 2), before, "weight comes from history before filing");
        _vote(assessorB, claimId, 2, false);
    }

    function test_topUpInTheFilingSecondCannotEraseAVote() public {
        vm.warp(block.timestamp + 1 days);
        uint256 before = court.weightAt(2, block.timestamp, block.timestamp + VOTING_PERIOD);
        uint256 claimId = _file(1_000e18);
        veMEZO.depositFor(2, 1); // same block as the filing
        assertEq(court.voteWeight(claimId, 2), before);
        assertGt(before, 0);
    }

    function test_historicalWeightUsesTheRightCheckpoint() public {
        _giveVeMEZO(30, assessorA, 100e18, 0, true);
        vm.warp(block.timestamp + 1 days);
        _giveVeMEZO(30, assessorA, 300e18, 0, true); // grows before filing
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        vm.warp(block.timestamp + 1 hours);
        _giveVeMEZO(30, assessorA, 900e18, 0, true); // grows after filing
        assertEq(court.voteWeight(claimId, 30), 300e18, "the checkpoint in force just before filing");
    }

    function test_burnedLockCannotVote() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        veMEZO.burn(2);
        assertEq(court.voteWeight(claimId, 2), 0);
    }

    function test_supermajorityRequired() public {
        _giveVeMEZO(31, assessorA, 1_100e18, 0, true);
        _giveVeMEZO(32, assessorB, 900e18, 0, true);
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        _vote(assessorA, claimId, 31, true); // 55% yes
        _vote(assessorB, claimId, 32, false);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.REJECTED), "55% is not enough");
    }

    function test_freeRetriesAreCapped() public {
        vm.warp(block.timestamp + 1 days);
        for (uint256 i; i < 2; i++) {
            uint256 id = _file(1_000e18);
            vm.warp(block.timestamp + VOTING_PERIOD + 1);
            court.finalize(id); // NO_QUORUM, free
        }
        assertEq(pm.policies(policyId).claimsFiled, 0);
        assertEq(pm.policies(policyId).freeRetries, 2);
        uint256 third = _file(1_000e18);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        court.finalize(third); // NO_QUORUM again: now it counts
        assertEq(pm.policies(policyId).claimsFiled, 1);
    }

    function test_rewardSlicesCappedAtThePolicysAssessorCut() public {
        // A small policy paid 5% of its premium into the reward pool. Its claims, together, can
        // never draw more than that, however large the pool is.
        uint256 small = _buy(assessedProduct, 10e18, 7 days, 0);
        uint256 cut = pm.policies(small).premium * pm.ASSESSOR_SHARE_BPS() / 10_000;
        uint256 poolBefore = court.rewardPool();
        assertGt(poolBefore * 2_000 / 10_000, cut, "pool slice alone would be larger");
        vm.warp(block.timestamp + 1 days);

        uint256[2] memory ids;
        for (uint256 i; i < 2; i++) {
            vm.prank(buyer);
            ids[i] = court.fileClaim(small, 10e18, block.timestamp - 1, "ipfs://e");
            _vote(assessorA, ids[i], 1, false);
            _vote(assessorB, ids[i], 2, false);
            vm.warp(block.timestamp + VOTING_PERIOD + 1);
            court.finalize(ids[i]);
        }
        uint256 bond = court.claims(ids[0]).bond;
        assertEq(court.claims(ids[0]).rewardPot, cut + bond, "first claim takes the whole cut");
        assertEq(court.claims(ids[1]).rewardPot, bond, "second claim gets only its bond");
        assertEq(court.rewardsDrawn(small), cut);
        assertEq(court.rewardPool(), poolBefore - cut, "other buyers' contributions untouched");
    }

    function test_undeliverableBondIsHeldAndDoesNotBlockTheDecision() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18); // nobody votes: NO_QUORUM, bond refunded
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        musd.setFrozen(buyer, true);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.NO_QUORUM), "decided anyway");
        uint256 bond = court.claims(claimId).bond;
        assertEq(court.bondOwed(claimId), bond, "bond held");
        assertFalse(pm.policies(policyId).claimOpen, "policy freed for expiry or refiling");

        vm.expectRevert(); // still frozen
        court.withdrawBond(claimId);

        musd.setFrozen(buyer, false);
        uint256 before = musd.balanceOf(buyer);
        vm.prank(stranger);
        court.withdrawBond(claimId);
        assertEq(musd.balanceOf(buyer) - before, bond, "bond reaches the claimant");
        assertEq(court.bondOwed(claimId), 0);
        vm.expectRevert(ClaimsCourt.NothingToClaim.selector);
        court.withdrawBond(claimId);
    }

    function test_oversizedPayoutRevertReasonIsTruncated() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(5_000e18);
        _vote(assessorA, claimId, 1, true);
        _vote(assessorB, claimId, 2, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.mockCallRevert(
            address(pm), abi.encodeWithSelector(PolicyManager.settleAssessedClaim.selector), new bytes(50_000)
        );
        vm.recordLogs();
        court.finalize(claimId);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("PayoutDeferred(uint256,bytes)")) {
                assertEq(abi.decode(logs[i].data, (bytes)).length, 256, "reason capped at 256 bytes");
                found = true;
            }
        }
        assertTrue(found);
        assertTrue(court.claims(claimId).payoutPending);
    }

    function test_payoutFailureRecordsTheReason() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(5_000e18);
        _vote(assessorA, claimId, 1, true);
        _vote(assessorB, claimId, 2, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        musd.setFrozen(buyer, true);
        vm.recordLogs();
        court.finalize(claimId);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("PayoutDeferred(uint256,bytes)")) {
                bytes memory reason = abi.decode(logs[i].data, (bytes));
                assertGt(reason.length, 0, "revert reason kept");
                found = true;
            }
        }
        assertTrue(found);
    }

    function test_finalizeWithTooLittleGasRevertsInsteadOfDeferring() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(5_000e18);
        _vote(assessorA, claimId, 1, true);
        _vote(assessorB, claimId, 2, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        (bool ok,) = address(court).call{gas: 300_000}(abi.encodeCall(ClaimsCourt.finalize, (claimId)));
        assertFalse(ok, "low-gas finalize reverts");
        assertEq(uint8(court.claims(claimId).outcome), uint8(ClaimsCourt.Outcome.PENDING), "nothing recorded");
    }

    function test_lockCreatedAfterFilingHasNoWeight() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        // Split or new lock: a token whose first checkpoint is after filing cannot vote.
        _giveVeMEZO(20, assessorA, 5_000e18, 0, true);
        vm.prank(assessorA);
        vm.expectRevert(ClaimsCourt.NoWeight.selector);
        court.vote(claimId, 20, true);
        assertEq(court.voteWeight(claimId, 20), 0);
    }

    function test_lockChangedInSameSecondAsFilingHasNoWeight() public {
        vm.warp(block.timestamp + 1 days);
        _giveVeMEZO(21, assessorA, 5_000e18, 0, true);
        uint256 claimId = _file(1_000e18);
        assertEq(court.voteWeight(claimId, 21), 0);
    }

    function test_voteGuards() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);

        vm.prank(stranger);
        vm.expectRevert(ClaimsCourt.NotTokenOwner.selector);
        court.vote(claimId, 1, true);

        _giveVeMEZO(5, buyer, 500e18, 0, true);
        vm.prank(buyer);
        vm.expectRevert(ClaimsCourt.ClaimantCannotVote.selector);
        court.vote(claimId, 5, true);

        _vote(assessorA, claimId, 1, true);
        vm.prank(assessorA);
        vm.expectRevert(ClaimsCourt.AlreadyVoted.selector);
        court.vote(claimId, 1, false);

        // Moving the NFT to a fresh wallet does not allow a second vote.
        veMEZO.transfer(1, stranger);
        vm.prank(stranger);
        vm.expectRevert(ClaimsCourt.AlreadyVoted.selector);
        court.vote(claimId, 1, true);

        _giveVeMEZO(6, assessorB, 100e18, block.timestamp + 2 days, false);
        vm.prank(assessorB);
        vm.expectRevert(ClaimsCourt.NoWeight.selector);
        court.vote(claimId, 6, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.prank(assessorB);
        vm.expectRevert(ClaimsCourt.VotingClosed.selector);
        court.vote(claimId, 2, true);
    }

    // ---------------- outcomes ----------------

    function test_approvedClaimPaysHolderRefundsBondAndRewardsMajority() public {
        address assessorC = makeAddr("assessorC");
        _giveVeMEZO(7, assessorC, 800e18, 0, true); // exists before the claim is filed
        vm.warp(block.timestamp + 1 days);
        uint256 rewardPoolBefore = court.rewardPool();
        uint256 claimId = _file(6_000e18);
        _vote(assessorA, claimId, 1, true); // 800
        _vote(assessorB, claimId, 2, false); // ~1000 -> would reject
        _vote(assessorC, claimId, 7, true); // yes 1600 vs no ~1000: 61.5%, above the 60% bar

        vm.expectRevert(ClaimsCourt.VotingOpen.selector);
        court.finalize(claimId);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        uint256 buyerBefore = musd.balanceOf(buyer);
        ClaimsCourt.Outcome outcome = court.finalize(claimId);
        assertEq(uint8(outcome), uint8(ClaimsCourt.Outcome.APPROVED));
        assertEq(musd.balanceOf(buyer) - buyerBefore, 6_000e18 + 60e18, "payout + bond back");
        assertEq(uint8(pm.policies(policyId).status), uint8(PolicyManager.Status.CLAIMED));
        assertEq(pool.activeCover(), 0, "whole cover released");

        uint256 pot = court.claims(claimId).rewardPot;
        assertEq(pot, rewardPoolBefore * 2_000 / 10_000);
        uint256 a = court.pendingReward(claimId, 1);
        uint256 c = court.pendingReward(claimId, 7);
        assertEq(court.pendingReward(claimId, 2), 0, "minority gets nothing");
        assertApproxEqAbs(a + c, pot, 2);
        assertApproxEqAbs(a, c, 2, "equal weights, equal shares");

        uint256 before = musd.balanceOf(assessorA);
        court.claimReward(claimId, 1);
        assertEq(musd.balanceOf(assessorA) - before, a);
        vm.expectRevert(ClaimsCourt.NothingToClaim.selector);
        court.claimReward(claimId, 1);
    }

    function test_rejectedClaimForfeitsBondToAssessors() public {
        vm.warp(block.timestamp + 1 days);
        uint256 rewardPoolBefore = court.rewardPool();
        uint256 claimId = _file(5_000e18);
        _vote(assessorA, claimId, 1, false);
        _vote(assessorB, claimId, 2, false);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        uint256 buyerBefore = musd.balanceOf(buyer);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.REJECTED));
        assertEq(musd.balanceOf(buyer), buyerBefore, "bond not refunded");
        assertEq(court.claims(claimId).rewardPot, rewardPoolBefore * 2_000 / 10_000 + 50e18);

        PolicyManager.Policy memory pol = pm.policies(policyId);
        assertEq(uint8(pol.status), uint8(PolicyManager.Status.ACTIVE), "policy keeps cover");
        assertFalse(pol.claimOpen);
        assertEq(pool.activeCover(), COVER);

        uint256 total = court.pendingReward(claimId, 1) + court.pendingReward(claimId, 2);
        assertApproxEqAbs(total, court.claims(claimId).rewardPot, 2);
    }

    function test_tieIsRejected() public {
        _giveVeMEZO(8, assessorB, 800e18, 0, true);
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        _vote(assessorA, claimId, 1, true); // 800 yes
        _vote(assessorB, claimId, 8, false); // 800 no
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.REJECTED));
    }

    function test_noQuorumRefundsBondAndAllowsRefile() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(2_000e18);
        _vote(assessorA, claimId, 1, true); // 800 < 1000 quorum
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        uint256 before = musd.balanceOf(buyer);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.NO_QUORUM));
        assertEq(musd.balanceOf(buyer) - before, 20e18, "bond refunded");
        assertEq(court.pendingReward(claimId, 1), 0);
        vm.expectRevert(ClaimsCourt.NotPending.selector);
        court.finalize(claimId);

        // A failed quorum is not the claimant's fault: it does not use up a claim attempt.
        assertEq(pm.policies(policyId).claimsFiled, 0);
        _file(2_000e18);
    }

    function test_minVotersRequired() public {
        _giveVeMEZO(9, assessorA, 5_000e18, 0, true); // one lock alone exceeds quorum
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        _vote(assessorA, claimId, 9, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.NO_QUORUM), "one voter is not enough");
    }

    function test_quorumIsSnapshotAtFiling() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        assertEq(court.claims(claimId).quorum, QUORUM);
    }

    function test_relativeQuorumScalesWithTotalVotingPower() public {
        veMEZO.setTotalVotingPower(1_000_000e18);
        ClaimsCourt rel = new ClaimsCourt(
            IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 100e18, 200, MIN_VOTERS, APPROVAL_BPS, MIN_LOCK_TAIL
        );
        assertEq(rel.currentQuorum(), 20_000e18, "2% of total voting power");
        veMEZO.setTotalVotingPower(1_000e18);
        assertEq(rel.currentQuorum(), 100e18, "never below the floor");

        // Fails closed: an unreadable or zero total stops filing instead of falling to the floor.
        veMEZO.setVotingPowerReverts(true);
        vm.expectRevert(ClaimsCourt.QuorumUnavailable.selector);
        rel.currentQuorum();
        veMEZO.setVotingPowerReverts(false);
        veMEZO.setTotalVotingPower(0);
        vm.expectRevert(ClaimsCourt.QuorumUnavailable.selector);
        rel.currentQuorum();
    }

    function test_relativeQuorumCourtWontDeployWithoutVotingPower() public {
        veMEZO.setTotalVotingPower(0);
        vm.expectRevert(ClaimsCourt.QuorumUnavailable.selector);
        new ClaimsCourt(
            IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 100e18, 200, MIN_VOTERS, APPROVAL_BPS, MIN_LOCK_TAIL
        );
    }

    function test_constructorRejectsBadConfig() public {
        vm.expectRevert(ClaimsCourt.BadConfig.selector);
        new ClaimsCourt(IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 1e18, 10_001, 2, APPROVAL_BPS, 1 days);
        vm.expectRevert(ClaimsCourt.BadConfig.selector);
        new ClaimsCourt(IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 1e18, 0, 0, APPROVAL_BPS, 1 days);
        vm.expectRevert(ClaimsCourt.BadConfig.selector);
        new ClaimsCourt(IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 0, 0, 2, APPROVAL_BPS, 1 days);
        vm.expectRevert(ClaimsCourt.BadConfig.selector);
        new ClaimsCourt(IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, 1e18, 0, 2, 5_000, 1 days);
    }

    function test_payoutDeferredThenRetried() public {
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(5_000e18);
        _vote(assessorA, claimId, 1, true);
        _vote(assessorB, claimId, 2, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        musd.setFrozen(buyer, true); // the payout transfer cannot complete
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.APPROVED), "decision recorded anyway");
        assertTrue(court.claims(claimId).payoutPending);
        assertEq(uint8(pm.policies(policyId).status), uint8(PolicyManager.Status.ACTIVE), "not paid yet");
        assertTrue(pm.policies(policyId).claimOpen, "expiry stays blocked");

        musd.setFrozen(buyer, false);
        uint256 before = musd.balanceOf(buyer);
        vm.prank(stranger);
        court.retryPayout(claimId);
        assertEq(musd.balanceOf(buyer) - before, 5_000e18 + 50e18, "payout + bond");
        assertFalse(court.claims(claimId).payoutPending);
        assertEq(uint8(pm.policies(policyId).status), uint8(PolicyManager.Status.CLAIMED));

        vm.expectRevert(ClaimsCourt.NoPayoutPending.selector);
        court.retryPayout(claimId);
    }

    function test_atMostTwoClaimsPerPolicy() public {
        vm.warp(block.timestamp + 1 days);
        for (uint256 i; i < 2; i++) {
            uint256 claimId = _file(1_000e18);
            _vote(assessorA, claimId, 1, false);
            _vote(assessorB, claimId, 2, false);
            vm.warp(block.timestamp + VOTING_PERIOD + 1);
            assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.REJECTED));
        }
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.TooManyClaims.selector);
        court.fileClaim(policyId, 1_000e18, block.timestamp - 1, "e");
    }

    function test_openClaimBlocksExpiry() public {
        vm.warp(block.timestamp + 1 days);
        _file(1_000e18);
        vm.warp(block.timestamp + 200 days);
        vm.expectRevert(PolicyManager.ClaimWindowOpen.selector);
        pm.expire(policyId);
    }

    function test_notifyRewardsOnlyPolicyManager() public {
        vm.prank(stranger);
        vm.expectRevert(ClaimsCourt.NotPolicyManager.selector);
        court.notifyRewards(1);
    }

    function test_unknownClaimReverts() public {
        vm.expectRevert(ClaimsCourt.UnknownClaim.selector);
        court.claims(5);
    }

    function testFuzz_rewardsNeverExceedPot(uint96 wa, uint96 wb, uint96 wc) public {
        // Each lock alone meets quorum, so every run reaches a real decision.
        wa = uint96(bound(wa, QUORUM, 1e27));
        wb = uint96(bound(wb, QUORUM, 1e27));
        wc = uint96(bound(wc, QUORUM, 1e27));
        address[3] memory who = [makeAddr("x1"), makeAddr("x2"), makeAddr("x3")];
        _giveVeMEZO(11, who[0], int128(uint128(wa)), 0, true);
        _giveVeMEZO(12, who[1], int128(uint128(wb)), 0, true);
        _giveVeMEZO(13, who[2], int128(uint128(wc)), 0, true);
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        _vote(who[0], claimId, 11, true);
        _vote(who[1], claimId, 12, true);
        _vote(who[2], claimId, 13, false);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        ClaimsCourt.Outcome outcome = court.finalize(claimId);
        assertTrue(outcome != ClaimsCourt.Outcome.NO_QUORUM, "always decided");

        uint256 pot = court.claims(claimId).rewardPot;
        uint256 courtBefore = musd.balanceOf(address(court));
        uint256 paid;
        for (uint256 t = 11; t <= 13; t++) {
            if (court.pendingReward(claimId, t) > 0) paid += court.claimReward(claimId, t);
        }
        assertLe(paid, pot, "never more than the pot");
        assertGt(paid, 0, "winners were paid");
        assertEq(courtBefore - musd.balanceOf(address(court)), paid, "payouts left the court");
    }
}
