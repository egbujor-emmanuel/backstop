// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
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
        uint256 ends = block.timestamp + VOTING_PERIOD;
        assertEq(court.voteWeight(1, ends), 800e18, "permanent counts in full");
        assertApproxEqAbs(court.voteWeight(2, ends), 1_000e18, 1, "max lock counts ~in full");
    }

    function test_shortLockHasNoWeight() public {
        _giveVeMEZO(3, assessorA, 1_000e18, block.timestamp + VOTING_PERIOD + MIN_LOCK_TAIL - 1, false);
        assertEq(court.voteWeight(3, block.timestamp + VOTING_PERIOD), 0);
    }

    function test_weightDecaysWithRemainingLock() public {
        _giveVeMEZO(4, assessorA, 1_456e18, block.timestamp + 728 days, false);
        assertEq(court.voteWeight(4, block.timestamp + VOTING_PERIOD), 728e18);
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
        vm.warp(block.timestamp + 1 days);
        uint256 rewardPoolBefore = court.rewardPool();
        uint256 claimId = _file(6_000e18);
        _vote(assessorA, claimId, 1, true); // 800
        _vote(assessorB, claimId, 2, false); // ~1000 -> would reject

        // Add a third approving voter so yes wins.
        address assessorC = makeAddr("assessorC");
        _giveVeMEZO(7, assessorC, 500e18, 0, true);
        _vote(assessorC, claimId, 7, true); // yes 1300 vs no ~1000

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
        assertApproxEqAbs(a * 500, c * 800, 1e6, "pro-rata by weight");

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

        // Second (and last) claim on the same policy.
        _file(2_000e18);
    }

    function test_atMostTwoClaimsPerPolicy() public {
        vm.warp(block.timestamp + 1 days);
        for (uint256 i; i < 2; i++) {
            uint256 claimId = _file(1_000e18);
            vm.warp(block.timestamp + VOTING_PERIOD + 1);
            court.finalize(claimId); // no votes -> NO_QUORUM
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
        wa = uint96(bound(wa, 1e18, 1e27));
        wb = uint96(bound(wb, 1e18, 1e27));
        wc = uint96(bound(wc, 1e18, 1e27));
        _giveVeMEZO(11, makeAddr("x1"), int128(uint128(wa)), 0, true);
        _giveVeMEZO(12, makeAddr("x2"), int128(uint128(wb)), 0, true);
        _giveVeMEZO(13, makeAddr("x3"), int128(uint128(wc)), 0, true);
        vm.warp(block.timestamp + 1 days);
        uint256 claimId = _file(1_000e18);
        _vote(makeAddr("x1"), claimId, 11, true);
        _vote(makeAddr("x2"), claimId, 12, true);
        _vote(makeAddr("x3"), claimId, 13, false);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        court.finalize(claimId);
        uint256 pot = court.claims(claimId).rewardPot;
        uint256 paid = court.pendingReward(claimId, 11) + court.pendingReward(claimId, 12)
            + court.pendingReward(claimId, 13);
        assertLe(paid, pot);
    }
}
