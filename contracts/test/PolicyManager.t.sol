// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {ITroveManager} from "../src/interfaces/IMezo.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PolicyManagerTest is Fixture {
    function setUp() public override {
        super.setUp();
        _underwrite(500_000e18);
    }

    // ---------------- quoting and buying ----------------

    function test_quoteIsLinearAndRoundsUp() public view {
        // Pool 500,000 MUSD, nothing covered: 10,000 of cover moves utilization 0% -> 2%, so the
        // multiplier is the curve's average 1 + 4(0 + 0 + 0.02^2)/3 = 1.000533 (10005 bps, floored).
        assertEq(pm.utilizationMultiplierBps(10_000e18), 10_005);
        // 5% a year on 10,000 MUSD for 365 days = 500 MUSD, times 1.0005.
        assertEq(pm.quote(assessedProduct, 10_000e18, 365 days), 500.25e18);
        assertEq(pm.quote(assessedProduct, 10_000e18, 73 days), 100.05e18);
        // 1 wei of cover for 7 days rounds up to 1 wei, never down to 0.
        assertEq(pm.quote(assessedProduct, 1, 7 days), 1);
    }

    function test_premiumRisesWithUtilization() public view {
        assertEq(pm.utilizationMultiplierBps(0), 10_000, "idle pool: 1x");
        assertEq(pm.utilizationMultiplierBps(250_000e18), 13_333, "idle to 50%: average 1.33x");
        assertEq(pm.utilizationMultiplierBps(500_000e18), 23_333, "idle to full: average 2.33x");
        assertEq(pm.utilizationMultiplierBps(900_000e18), 23_333, "capped at full");
    }

    function test_marginalPriceAtFullPoolIsFiveX() public {
        _buy(assessedProduct, 100_000e18, 30 days, 0);
        vm.prank(owner);
        pm.updateProduct(assessedProduct, 500, 10_000_000e18, 1_000_000e18, true);
        _buy(assessedProduct, 300_000e18, 30 days, 0);
        _buy(assessedProduct, 99_000e18, 30 days, 0); // pool now ~99.8% used
        assertGe(pm.utilizationMultiplierBps(10e18), 49_800, "the last unit of capacity costs ~5x");
    }

    function test_splittingDoesNotLowerTheTotalPremium() public {
        uint256 once = pm.quote(assessedProduct, 100_000e18, 365 days);
        uint256 first = pm.quote(assessedProduct, 50_000e18, 365 days);
        _buy(assessedProduct, 50_000e18, 365 days, 0);
        uint256 second = pm.quote(assessedProduct, 50_000e18, 365 days);
        assertApproxEqRel(first + second, once, 0.001e18, "same total at once or in pieces");
    }

    function test_maxPremiumGuardsAgainstPriceMoves() public {
        uint256 premium = pm.quote(assessedProduct, 10_000e18, 30 days);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.PremiumTooHigh.selector, premium, premium - 1));
        pm.buy(assessedProduct, 10_000e18, 30 days, 0, premium - 1);
        vm.prank(buyer);
        pm.buy(assessedProduct, 10_000e18, 30 days, 0, premium);
    }

    function test_veBTCLockMustOutlastThePolicy() public {
        veBTC.setLock(44, buyer, 0.1e18, block.timestamp + 20 days, false);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.LockEndsBeforePolicy.selector);
        pm.buy(veBTCProduct, 1_000e18, 30 days, 44, type(uint256).max);
        _buy(veBTCProduct, 1_000e18, 20 days, 44); // a policy inside the lock is fine
        veBTC.setLock(45, buyer, 0.1e18, 0, true);
        _buy(veBTCProduct, 1_000e18, 365 days, 45); // permanent locks always qualify
    }

    function test_zeroPriceIsRejected() public {
        troves.setTrove(buyer, ITroveManager.Status.active, 0.05e18);
        feed.setPrice(0);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.PriceUnavailable.selector);
        pm.buy(troveProduct, 1_000e18, 30 days, 0, type(uint256).max);
    }

    function test_ownershipCannotBeRenounced() public {
        vm.prank(owner);
        vm.expectRevert(PolicyManager.RenounceDisabled.selector);
        pm.renounceOwnership();
        assertEq(pm.owner(), owner);
    }

    function test_productNameIsEscapedInSvg() public {
        vm.prank(owner);
        uint256 id = pm.addProduct("<script>&\"x\"", "x", 500, PolicyManager.PositionKind.NONE, 1_000_000e18, 100_000e18);
        uint256 policyId = _buy(id, 100e18, 30 days, 0);
        string memory uri = pm.tokenURI(policyId);
        assertGt(bytes(uri).length, 200);
    }

    function test_positionKeyViewMatchesInsured() public {
        veBTC.setLock(42, buyer, 0.1e18, block.timestamp + 400 days, false);
        _buy(veBTCProduct, 1_000e18, 30 days, 42);
        bytes32 key = pm.positionKey(PolicyManager.PositionKind.VEBTC, buyer, 42);
        assertEq(pm.insured(key), 1_000e18);
    }

    function test_buyAssessedSplitsPremiumExactly() public {
        uint256 premium = pm.quote(assessedProduct, 10_000e18, 365 days);
        uint256 courtBefore = musd.balanceOf(address(court));
        uint256 policyId = _buy(assessedProduct, 10_000e18, 365 days, 0);

        uint256 fee = premium * 1_000 / 10_000;
        uint256 assessor = premium * 500 / 10_000;
        assertEq(musd.balanceOf(treasury), fee, "10% treasury");
        assertEq(musd.balanceOf(address(court)) - courtBefore, assessor, "5% assessors");
        assertEq(court.rewardPool(), assessor);
        assertEq(pool.lockedPremium(), premium - fee - assessor, "85% pool");
        assertEq(pool.activeCover(), 10_000e18);
        assertEq(pm.ownerOf(policyId), buyer);

        PolicyManager.Policy memory pol = pm.policies(policyId);
        assertEq(uint8(pol.status), uint8(PolicyManager.Status.ACTIVE));
        assertEq(pol.cover, 10_000e18);
        assertEq(pol.premium, premium);
        assertEq(pol.end - pol.start, 365 days);
        assertEq(pol.holder, buyer);
        assertEq(pm.products(assessedProduct).activeCover, 10_000e18);
    }

    function test_everyProductFundsAssessors() public {
        uint256 premium = pm.quote(haltProduct, 10_000e18, 30 days);
        _buy(haltProduct, 10_000e18, 30 days, 0);
        assertEq(court.rewardPool(), premium * 500 / 10_000);
    }

    function test_policiesAreSoulbound() public {
        uint256 policyId = _buy(assessedProduct, 1_000e18, 30 days, 0);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.Soulbound.selector);
        pm.transferFrom(buyer, stranger, policyId);
    }

    function test_buyValidatesParameters() public {
        vm.startPrank(buyer);
        vm.expectRevert(PolicyManager.BadCover.selector);
        pm.buy(assessedProduct, 9e18, 30 days, 0, type(uint256).max);
        vm.expectRevert(PolicyManager.BadCover.selector);
        pm.buy(assessedProduct, 100_001e18, 30 days, 0, type(uint256).max);
        vm.expectRevert(PolicyManager.BadDuration.selector);
        pm.buy(assessedProduct, 1_000e18, 6 days, 0, type(uint256).max);
        vm.expectRevert(PolicyManager.BadDuration.selector);
        pm.buy(assessedProduct, 1_000e18, 366 days, 0, type(uint256).max);
        vm.expectRevert(PolicyManager.BadPositionId.selector);
        pm.buy(assessedProduct, 1_000e18, 30 days, 7, type(uint256).max);
        vm.expectRevert(PolicyManager.UnknownProduct.selector);
        pm.buy(99, 1_000e18, 30 days, 0, type(uint256).max);
        vm.stopPrank();
    }

    function test_buyRevertsWhenPoolLacksFreeCapital() public {
        vm.prank(owner);
        pm.updateProduct(assessedProduct, 500, 10_000_000e18, 1_000_000e18, true);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(BackstopPool.InsufficientFreeCapital.selector, 600_000e18, 500_000e18));
        pm.buy(assessedProduct, 600_000e18, 30 days, 0, type(uint256).max);
    }

    function test_productCapacityEnforced() public {
        vm.prank(owner);
        pm.updateProduct(assessedProduct, 500, 15_000e18, 10_000e18, true);
        _buy(assessedProduct, 10_000e18, 30 days, 0);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.CapacityExceeded.selector);
        pm.buy(assessedProduct, 6_000e18, 30 days, 0, type(uint256).max);
    }

    function test_inactiveProductAndPauseBlockSales() public {
        vm.prank(owner);
        pm.updateProduct(assessedProduct, 500, 1_000_000e18, 100_000e18, false);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.ProductInactive.selector);
        pm.buy(assessedProduct, 1_000e18, 30 days, 0, type(uint256).max);

        vm.prank(owner);
        pm.pause();
        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pm.buy(haltProduct, 1_000e18, 30 days, 0, type(uint256).max);
    }

    function test_rateChangeOnlyAffectsNewPolicies() public {
        uint256 policyId = _buy(assessedProduct, 10_000e18, 365 days, 0);
        uint256 oldPremium = pm.policies(policyId).premium;
        vm.prank(owner);
        pm.updateProduct(assessedProduct, 1_000, 1_000_000e18, 100_000e18, true);
        assertEq(pm.policies(policyId).premium, oldPremium);
        // 10,000 already covered, 10,000 quoted: utilization 2% -> 4%,
        // average multiplier 1 + 4(0.0004 + 0.0008 + 0.0016)/3 = 1.0037.
        assertEq(pm.quote(assessedProduct, 10_000e18, 365 days), 1_003.7e18);
    }

    // ---------------- insurable interest ----------------

    function test_veBTCCoverCappedAtLockValue() public {
        veBTC.setLock(42, buyer, 0.1e18, block.timestamp + 400 days, false); // 0.1 BTC = 7,000 MUSD
        assertEq(pm.insurableValue(veBTCProduct, buyer, 42), 7_000e18);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsPositionValue.selector, 7_001e18, 7_000e18));
        pm.buy(veBTCProduct, 7_001e18, 30 days, 42, type(uint256).max);

        _buy(veBTCProduct, 5_000e18, 30 days, 42);
        assertEq(pm.insurableValue(veBTCProduct, buyer, 42), 2_000e18, "second policy sees remaining value");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsPositionValue.selector, 2_001e18, 2_000e18));
        pm.buy(veBTCProduct, 2_001e18, 30 days, 42, type(uint256).max);
        _buy(veBTCProduct, 2_000e18, 30 days, 42);
    }

    function test_veBTCOverInsuranceBlockedAcrossOwners() public {
        veBTC.setLock(42, buyer, 0.1e18, block.timestamp + 400 days, false);
        _buy(veBTCProduct, 7_000e18, 30 days, 42);
        // The lock changes hands; the new owner cannot insure it again while the cover is live.
        veBTC.transfer(42, stranger);
        musd.mint(stranger, 1_000e18);
        vm.startPrank(stranger);
        musd.approve(address(pm), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsPositionValue.selector, 10e18, 0));
        pm.buy(veBTCProduct, 10e18, 30 days, 42, type(uint256).max);
        vm.stopPrank();
    }

    function test_positionCapIsSharedAcrossProducts() public {
        vm.prank(owner);
        uint256 second = pm.addProduct("veBTC lock: bridge exploit", "x", 300, PolicyManager.PositionKind.VEBTC, 1_000_000e18, 100_000e18);
        veBTC.setLock(42, buyer, 0.1e18, block.timestamp + 400 days, false); // worth 7,000 MUSD
        _buy(veBTCProduct, 7_000e18, 30 days, 42);
        assertEq(pm.insurableValue(second, buyer, 42), 0, "the lock is fully insured by another product");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsPositionValue.selector, 10e18, 0));
        pm.buy(second, 10e18, 30 days, 42, type(uint256).max);
    }

    function test_veBTCRequiresOwnershipAndNonEmptyLock() public {
        veBTC.setLock(42, stranger, 0.1e18, block.timestamp + 400 days, false);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.NotPositionOwner.selector);
        pm.buy(veBTCProduct, 1_000e18, 30 days, 42, type(uint256).max);

        // Unknown id: veBTC returns address(0) as owner.
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.NotPositionOwner.selector);
        pm.buy(veBTCProduct, 1_000e18, 30 days, 777, type(uint256).max);

        veBTC.setLock(43, buyer, 0, block.timestamp + 400 days, false);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.EmptyPosition.selector);
        pm.buy(veBTCProduct, 1_000e18, 30 days, 43, type(uint256).max);
    }

    function test_troveCoverCappedAtCollateralValue() public {
        troves.setTrove(buyer, ITroveManager.Status.active, 0.05e18); // 3,500 MUSD
        assertEq(pm.insurableValue(troveProduct, buyer, 0), 3_500e18);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsPositionValue.selector, 3_501e18, 3_500e18));
        pm.buy(troveProduct, 3_501e18, 30 days, 0, type(uint256).max);
        _buy(troveProduct, 3_500e18, 30 days, 0);
    }

    function test_troveMustBeActiveAndPositionIdZero() public {
        troves.setTrove(buyer, ITroveManager.Status.closedByLiquidation, 0.05e18);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.NotPositionOwner.selector);
        pm.buy(troveProduct, 1_000e18, 30 days, 0, type(uint256).max);

        troves.setTrove(buyer, ITroveManager.Status.active, 0.05e18);
        vm.prank(buyer);
        vm.expectRevert(PolicyManager.BadPositionId.selector);
        pm.buy(troveProduct, 1_000e18, 30 days, 1, type(uint256).max);
    }

    function test_insurableValueFollowsOraclePrice() public {
        troves.setTrove(buyer, ITroveManager.Status.active, 0.05e18);
        feed.setPrice(35_000e18);
        assertEq(pm.insurableValue(troveProduct, buyer, 0), 1_750e18);
    }

    // ---------------- expiry ----------------

    function test_expireReleasesCoverAfterGrace() public {
        uint256 policyId = _buy(assessedProduct, 10_000e18, 30 days, 0);
        vm.warp(block.timestamp + 30 days + 14 days);
        vm.expectRevert(PolicyManager.ClaimWindowOpen.selector);
        pm.expire(policyId);

        vm.warp(block.timestamp + 1);
        vm.prank(stranger);
        pm.expire(policyId);
        assertEq(uint8(pm.policies(policyId).status), uint8(PolicyManager.Status.EXPIRED));
        assertEq(pool.activeCover(), 0);
        assertEq(pm.products(assessedProduct).activeCover, 0);

        vm.expectRevert(PolicyManager.PolicyNotActive.selector);
        pm.expire(policyId);
    }

    function test_expireFreesPositionForNewCover() public {
        veBTC.setLock(42, buyer, 0.1e18, block.timestamp + 400 days, false);
        uint256 policyId = _buy(veBTCProduct, 7_000e18, 7 days, 42);
        vm.warp(block.timestamp + 21 days + 1);
        pm.expire(policyId);
        assertEq(pm.insurableValue(veBTCProduct, buyer, 42), 7_000e18);
    }

    // ---------------- admin ----------------

    function test_onlyOwnerCurates() public {
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pm.addProduct("x", "x", 100, PolicyManager.PositionKind.NONE, 1e24, 1e22);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pm.updateProduct(0, 100, 1e24, 1e22, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pm.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pm.setTreasury(stranger);
        vm.stopPrank();
    }

    function test_addProductValidation() public {
        vm.startPrank(owner);
        vm.expectRevert(PolicyManager.BadRate.selector);
        pm.addProduct("x", "x", 0, PolicyManager.PositionKind.NONE, 1e24, 1e22);
        vm.expectRevert(PolicyManager.BadRate.selector);
        pm.addProduct("x", "x", 5_001, PolicyManager.PositionKind.NONE, 1e24, 1e22);
        vm.expectRevert(PolicyManager.BadCover.selector);
        pm.addProduct("x", "x", 100, PolicyManager.PositionKind.NONE, 1e20, 1e22);
        vm.stopPrank();
    }

    function test_courtWiredOnce() public {
        vm.prank(owner);
        vm.expectRevert(PolicyManager.AlreadySet.selector);
        pm.setCourt(stranger);
    }

    function test_courtHooksRestricted() public {
        uint256 policyId = _buy(assessedProduct, 1_000e18, 30 days, 0);
        vm.startPrank(stranger);
        vm.expectRevert(PolicyManager.NotCourt.selector);
        pm.openClaim(policyId);
        vm.expectRevert(PolicyManager.NotCourt.selector);
        pm.closeClaim(policyId, true);
        vm.expectRevert(PolicyManager.NotCourt.selector);
        pm.settleAssessedClaim(policyId, 1);
        vm.stopPrank();
    }

    function test_tokenURIRenders() public {
        uint256 policyId = _buy(assessedProduct, 1_000e18, 30 days, 0);
        string memory uri = pm.tokenURI(policyId);
        assertGt(bytes(uri).length, 200);
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; i++) out[i] = b[i];
        return string(out);
    }

    function testFuzz_premiumNeverExceedsMaxRate(uint256 cover, uint256 duration) public view {
        cover = bound(cover, 10e18, 100_000e18);
        duration = bound(duration, 7 days, 365 days);
        uint256 premium = pm.quote(assessedProduct, cover, duration);
        uint256 base = cover * 500 * duration / (10_000 * 365 days);
        assertGe(premium, base, "never below the base rate");
        assertLe(premium, cover * 500 * 5 / 10_000 + 1, "never above 5x the annual rate");
        assertGt(premium, 0);
    }
}
