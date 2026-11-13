// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Fixture} from "./utils/Fixture.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {ClaimsCourt} from "../src/ClaimsCourt.sol";
import {TestMUSD, TestVotingEscrow} from "./utils/Doubles.sol";

/// Drives random sequences of every user action against the real contracts.
contract Handler is Test {
    TestMUSD internal musd;
    BackstopPool internal pool;
    PolicyManager internal pm;
    ClaimsCourt internal court;
    TestVotingEscrow internal veMEZO;
    TestVotingEscrow internal veBTC;
    uint256 internal veBTCProduct;

    address[] internal underwriters;
    address internal buyer = makeAddr("h-buyer");
    address[] internal assessors;
    uint256[] public policyIds;
    uint256[] public claimIds;

    constructor(
        TestMUSD musd_,
        BackstopPool pool_,
        PolicyManager pm_,
        ClaimsCourt court_,
        TestVotingEscrow veMEZO_,
        TestVotingEscrow veBTC_,
        uint256 veBTCProduct_
    ) {
        musd = musd_;
        pool = pool_;
        pm = pm_;
        court = court_;
        veMEZO = veMEZO_;
        veBTC = veBTC_;
        veBTCProduct = veBTCProduct_;
        for (uint256 i; i < 3; i++) {
            veBTC.setLock(500 + i, buyer, 1e18, 0, true); // 1 BTC each, worth 70,000 MUSD
        }
        for (uint256 i; i < 3; i++) {
            address u = makeAddr(string.concat("h-uw", vm.toString(i)));
            underwriters.push(u);
            musd.mint(u, 10_000_000e18);
            vm.prank(u);
            musd.approve(address(pool), type(uint256).max);
        }
        musd.mint(buyer, 10_000_000e18);
        vm.startPrank(buyer);
        musd.approve(address(pm), type(uint256).max);
        musd.approve(address(court), type(uint256).max);
        vm.stopPrank();
        for (uint256 i; i < 3; i++) {
            address a = makeAddr(string.concat("h-as", vm.toString(i)));
            assessors.push(a);
            veMEZO.setLock(100 + i, a, 1_000e18, 0, true);
        }
    }

    function deposit(uint256 who, uint256 amount) external {
        amount = bound(amount, 1e18, 1_000_000e18);
        vm.prank(underwriters[who % 3]);
        pool.deposit(amount, underwriters[who % 3]);
    }

    function requestWithdraw(uint256 who, uint256 fraction) external {
        address u = underwriters[who % 3];
        uint256 shares = pool.balanceOf(u) * bound(fraction, 1, 100) / 100;
        vm.prank(u);
        pool.requestWithdraw(shares);
    }

    function redeemMax(uint256 who) external {
        address u = underwriters[who % 3];
        uint256 shares = pool.maxRedeem(u);
        if (shares == 0) return;
        vm.prank(u);
        pool.redeem(shares, u, u);
    }

    function buy(uint256 cover, uint256 duration) external {
        cover = bound(cover, 10e18, 100_000e18);
        duration = bound(duration, 7 days, 365 days);
        if (cover > pool.freeCapital()) return;
        PolicyManager.Product memory p = pm.products(0);
        if (uint256(p.activeCover) + cover > p.capacity) return;
        vm.prank(buyer);
        policyIds.push(pm.buy(0, cover, duration, 0, type(uint256).max));
    }

    function buyVeBTC(uint256 which, uint256 cover, uint256 duration) external {
        uint256 tokenId = 500 + (which % 3);
        cover = bound(cover, 10e18, 50_000e18);
        duration = bound(duration, 7 days, 365 days);
        if (cover > pool.freeCapital()) return;
        PolicyManager.Product memory p = pm.products(veBTCProduct);
        if (uint256(p.activeCover) + cover > p.capacity) return;
        if (cover > pm.insurableValue(veBTCProduct, buyer, tokenId)) return;
        vm.prank(buyer);
        policyIds.push(pm.buy(veBTCProduct, cover, duration, tokenId, type(uint256).max));
    }

    function fileClaim(uint256 idx, uint256 fraction) external {
        if (policyIds.length == 0) return;
        uint256 policyId = policyIds[idx % policyIds.length];
        PolicyManager.Policy memory pol = pm.policies(policyId);
        if (pol.status != PolicyManager.Status.ACTIVE || pol.claimOpen || pol.claimsFiled >= 2) return;
        if (block.timestamp > uint256(pol.end) + 14 days || block.timestamp <= pol.start) return;
        uint256 amount = uint256(pol.cover) * bound(fraction, 1, 100) / 100;
        uint256 incidentAt = block.timestamp > pol.end ? pol.end : block.timestamp - 1;
        if (incidentAt < pol.start) return;
        vm.prank(buyer);
        claimIds.push(court.fileClaim(policyId, amount, incidentAt, "ipfs://e"));
    }

    function vote(uint256 idx, uint256 who, bool approve) external {
        if (claimIds.length == 0) return;
        uint256 claimId = claimIds[idx % claimIds.length];
        ClaimsCourt.Claim memory c = court.claims(claimId);
        uint256 tokenId = 100 + (who % 3);
        if (c.outcome != ClaimsCourt.Outcome.PENDING || block.timestamp > c.votingEnds) return;
        (, uint128 w,,) = court.votes(claimId, tokenId);
        if (w != 0) return;
        vm.prank(assessors[who % 3]);
        court.vote(claimId, tokenId, approve);
    }

    function finalize(uint256 idx) external {
        if (claimIds.length == 0) return;
        uint256 claimId = claimIds[idx % claimIds.length];
        ClaimsCourt.Claim memory c = court.claims(claimId);
        if (c.outcome != ClaimsCourt.Outcome.PENDING || block.timestamp <= c.votingEnds) return;
        court.finalize(claimId);
    }

    function claimReward(uint256 idx, uint256 who) external {
        if (claimIds.length == 0) return;
        uint256 claimId = claimIds[idx % claimIds.length];
        uint256 tokenId = 100 + (who % 3);
        if (court.pendingReward(claimId, tokenId) == 0) return;
        court.claimReward(claimId, tokenId);
    }

    function retryPayout(uint256 idx) external {
        if (claimIds.length == 0) return;
        uint256 claimId = claimIds[idx % claimIds.length];
        if (!court.claims(claimId).payoutPending) return;
        court.retryPayout(claimId);
    }

    function claimCount() external view returns (uint256) {
        return claimIds.length;
    }

    function expire(uint256 idx) external {
        if (policyIds.length == 0) return;
        uint256 policyId = policyIds[idx % policyIds.length];
        PolicyManager.Policy memory pol = pm.policies(policyId);
        if (pol.status != PolicyManager.Status.ACTIVE || pol.claimOpen) return;
        if (block.timestamp <= uint256(pol.end) + 14 days) return;
        pm.expire(policyId);
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 20 days));
    }

    function policyCount() external view returns (uint256) {
        return policyIds.length;
    }
}

contract InvariantsTest is Fixture {
    Handler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new Handler(musd, pool, pm, court, veMEZO, veBTC, veBTCProduct);
        targetContract(address(handler));
    }

    /// Every unit of active cover is backed by pool assets.
    function invariant_coverAlwaysFullyBacked() public view {
        assertGe(pool.grossAssets(), pool.activeCover());
    }

    /// Pool cover equals the sum of cover tracked per product.
    function invariant_coverAccountingMatches() public view {
        uint256 sum;
        for (uint256 i; i < pm.productCount(); i++) {
            sum += pm.products(i).activeCover;
        }
        assertEq(sum, pool.activeCover());
    }

    /// Sum of active policies' cover equals pool cover.
    function invariant_activePoliciesMatchCover() public view {
        uint256 sum;
        for (uint256 i; i < handler.policyCount(); i++) {
            PolicyManager.Policy memory pol = pm.policies(handler.policyIds(i));
            if (pol.status == PolicyManager.Status.ACTIVE) sum += pol.cover;
        }
        assertEq(sum, pool.activeCover());
    }

    /// The pool's internal record of parked principal matches its sMUSD balance.
    function invariant_parkedMatchesSavings() public view {
        assertEq(pool.parked(), savings.balanceOf(address(pool)));
    }

    /// The court always holds its reward pool, every bond it still owes and every unpaid reward.
    function invariant_courtSolvent() public view {
        uint256 owed = court.rewardPool();
        for (uint256 i; i < handler.claimCount(); i++) {
            uint256 claimId = handler.claimIds(i);
            ClaimsCourt.Claim memory c = court.claims(claimId);
            if (c.outcome == ClaimsCourt.Outcome.PENDING || c.payoutPending) owed += c.bond;
            owed += court.bondOwed(claimId);
            for (uint256 t = 100; t < 103; t++) {
                owed += court.pendingReward(claimId, t);
            }
        }
        assertGe(musd.balanceOf(address(court)), owed, "court holds every bond and unpaid reward");
    }

    /// Cover tracked per veBTC position equals the cover of active policies on that position.
    function invariant_positionCoverMatchesPolicies() public view {
        for (uint256 t = 500; t < 503; t++) {
            uint256 sum;
            for (uint256 i; i < handler.policyCount(); i++) {
                PolicyManager.Policy memory pol = pm.policies(handler.policyIds(i));
                if (pol.status == PolicyManager.Status.ACTIVE && pol.productId == veBTCProduct && pol.positionId == t) {
                    sum += pol.cover;
                }
            }
            bytes32 key = pm.positionKey(PolicyManager.PositionKind.VEBTC, address(0), t);
            assertEq(pm.insured(key), sum);
        }
    }
}
