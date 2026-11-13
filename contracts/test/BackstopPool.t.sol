// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMUSDSavingsRate} from "../src/interfaces/IMezo.sol";

contract BackstopPoolTest is Fixture {
    function test_depositParksAboveBufferInSavings() public {
        _underwrite(10_000e18);
        assertEq(savings.balanceOf(address(pool)), 9_000e18, "90% parked");
        assertEq(musd.balanceOf(address(pool)), 1_000e18, "10% buffer");
        assertEq(pool.totalAssets(), 10_000e18);
        assertEq(pool.grossAssets(), 10_000e18);
    }

    function test_totalAssetsCountsClaimableSavingsYield() public {
        _underwrite(10_000e18);
        savings.accrue(address(pool), 250e18);
        assertEq(pool.totalAssets(), 10_250e18);
    }

    function test_harvestPullsYieldAndReparks() public {
        _underwrite(10_000e18);
        savings.accrue(address(pool), 1_000e18);
        uint256 got = pool.harvest();
        assertEq(got, 1_000e18);
        assertEq(savings.claimableYield(address(pool)), 0);
        assertEq(pool.totalAssets(), 11_000e18);
        assertEq(musd.balanceOf(address(pool)), 1_100e18, "buffer rebalanced to 10%");
    }

    function test_parkFailureKeepsDepositsWorking() public {
        savings.setDepositsPaused(true);
        _underwrite(5_000e18);
        assertEq(musd.balanceOf(address(pool)), 5_000e18);
        assertEq(savings.balanceOf(address(pool)), 0);
        assertEq(musd.allowance(address(pool), address(savings)), 0, "approval cleared");
    }

    function test_premiumVestsLinearlyOverSevenDays() public {
        _underwrite(100_000e18);
        uint256 policyId = _buy(assessedProduct, 10_000e18, 365 days, 0);
        uint256 premium = pm.policies(policyId).premium;
        uint256 toPool = premium - premium / 10 - premium / 20;
        assertEq(pool.totalAssets(), 100_000e18, "nothing vested at t0");
        vm.warp(block.timestamp + 3.5 days);
        assertApproxEqAbs(pool.totalAssets(), 100_000e18 + toPool / 2, 1);
        vm.warp(block.timestamp + 3.5 days);
        assertEq(pool.totalAssets(), 100_000e18 + toPool);
    }

    function test_justInTimeDepositCannotCapturePremium() public {
        _underwrite(100_000e18);
        address sniper = makeAddr("sniper");
        musd.mint(sniper, 100_000e18);
        vm.startPrank(sniper);
        musd.approve(address(pool), type(uint256).max);
        uint256 shares = pool.deposit(100_000e18, sniper);
        vm.stopPrank();

        _buy(assessedProduct, 50_000e18, 365 days, 0);
        // Immediately after the premium lands, the sniper's shares are still worth what they paid.
        assertApproxEqAbs(pool.convertToAssets(shares), 100_000e18, 1);
    }

    function test_withdrawRequiresRequestAndCooldown() public {
        uint256 shares = _underwrite(10_000e18);
        assertEq(pool.maxRedeem(underwriter), 0, "no request");

        vm.prank(underwriter);
        pool.requestWithdraw(shares);
        assertEq(pool.maxRedeem(underwriter), 0, "cooldown running");

        vm.warp(block.timestamp + COOLDOWN);
        assertEq(pool.maxRedeem(underwriter), shares, "unlocked");

        vm.warp(block.timestamp + WINDOW + 1);
        assertEq(pool.maxRedeem(underwriter), 0, "window expired");
    }

    function test_withdrawUnparksFromSavings() public {
        uint256 shares = _underwrite(10_000e18);
        vm.prank(underwriter);
        pool.requestWithdraw(shares);
        vm.warp(block.timestamp + COOLDOWN);
        uint256 before = musd.balanceOf(underwriter);
        vm.prank(underwriter);
        pool.redeem(shares, underwriter, underwriter);
        uint256 received = musd.balanceOf(underwriter) - before;
        assertLe(received, 10_000e18);
        assertGe(received + 1, 10_000e18, "at most 1 wei of rounding");
        assertLe(savings.balanceOf(address(pool)) + musd.balanceOf(address(pool)), 1, "pool emptied");
    }

    function test_withdrawLimitedToFreeCapital() public {
        uint256 shares = _underwrite(10_000e18);
        _buy(assessedProduct, 6_000e18, 30 days, 0);
        vm.prank(underwriter);
        pool.requestWithdraw(shares);
        vm.warp(block.timestamp + COOLDOWN);
        uint256 maxAssets = pool.maxWithdraw(underwriter);
        assertLe(maxAssets, pool.totalAssets() - 6_000e18);
        assertGt(maxAssets, 3_999e18);

        vm.prank(underwriter);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxWithdraw.selector, underwriter, maxAssets + 2e18, maxAssets)
        );
        pool.withdraw(maxAssets + 2e18, underwriter, underwriter);

        vm.prank(underwriter);
        pool.withdraw(maxAssets, underwriter, underwriter);
        assertGe(pool.totalAssets(), pool.activeCover(), "cover still fully backed");
    }

    function test_withdrawCannotExceedRequestedShares() public {
        uint256 shares = _underwrite(10_000e18);
        vm.prank(underwriter);
        pool.requestWithdraw(shares / 2);
        vm.warp(block.timestamp + COOLDOWN);
        assertEq(pool.maxRedeem(underwriter), shares / 2);
        vm.prank(underwriter);
        pool.redeem(shares / 2, underwriter, underwriter);
        assertEq(pool.maxRedeem(underwriter), 0, "request consumed");
    }

    function test_requestWithdrawRejectsMoreThanBalance() public {
        uint256 shares = _underwrite(1_000e18);
        vm.prank(underwriter);
        vm.expectRevert(BackstopPool.ExceedsBalance.selector);
        pool.requestWithdraw(shares + 1);
    }

    function test_hooksOnlyCallableByPolicyManager() public {
        vm.startPrank(stranger);
        vm.expectRevert(BackstopPool.NotPolicyManager.selector);
        pool.lockCover(1);
        vm.expectRevert(BackstopPool.NotPolicyManager.selector);
        pool.unlockCover(1);
        vm.expectRevert(BackstopPool.NotPolicyManager.selector);
        pool.notifyPremium(1);
        vm.expectRevert(BackstopPool.NotPolicyManager.selector);
        pool.payClaim(stranger, 1, 1);
        vm.stopPrank();
    }

    function test_setPolicyManagerOnceAndOnlyDeployer() public {
        vm.expectRevert(BackstopPool.AlreadySet.selector);
        pool.setPolicyManager(stranger);

        BackstopPool fresh =
            new BackstopPool(IERC20(address(musd)), IMUSDSavingsRate(address(savings)), 1, 1);
        vm.prank(stranger);
        vm.expectRevert(BackstopPool.NotDeployer.selector);
        fresh.setPolicyManager(stranger);
        vm.expectRevert(BackstopPool.ZeroAddress.selector);
        fresh.setPolicyManager(address(0));
    }

    function test_lockCoverRevertsBeyondFreeCapital() public {
        _underwrite(1_000e18);
        vm.prank(address(pm));
        vm.expectRevert(abi.encodeWithSelector(BackstopPool.InsufficientFreeCapital.selector, 1_001e18, 1_000e18));
        pool.lockCover(1_001e18);
    }

    function test_payClaimUnparksAndReleasesCover() public {
        _underwrite(10_000e18);
        vm.startPrank(address(pm));
        pool.lockCover(5_000e18);
        pool.payClaim(buyer, 5_000e18, 5_000e18);
        vm.stopPrank();
        assertEq(pool.activeCover(), 0);
        assertEq(musd.balanceOf(buyer), 100_000e18 + 5_000e18);
        assertEq(pool.totalAssets(), 5_000e18);
    }

    function test_inflationAttackDoesNotStealVictimDeposit() public {
        address attacker = makeAddr("attacker");
        musd.mint(attacker, 10_001e18);
        vm.startPrank(attacker);
        musd.approve(address(pool), type(uint256).max);
        pool.deposit(1, attacker);
        musd.transfer(address(pool), 10_000e18); // donation
        vm.stopPrank();

        uint256 victimShares = _underwrite(10_000e18);
        assertGt(victimShares, 0, "victim minted shares");
        assertApproxEqRel(pool.convertToAssets(victimShares), 10_000e18, 0.001e18);
    }

    function test_parkedPrincipalIsTrackedInternally() public {
        _underwrite(10_000e18);
        assertEq(pool.parked(), 9_000e18);
        assertEq(pool.parked(), savings.balanceOf(address(pool)));
        vm.startPrank(address(pm));
        pool.lockCover(5_000e18);
        pool.payClaim(buyer, 5_000e18, 5_000e18);
        vm.stopPrank();
        assertEq(pool.parked(), savings.balanceOf(address(pool)), "unparking keeps the books in sync");
    }

    function test_failingYieldReadDoesNotBrickThePool() public {
        _underwrite(10_000e18);
        savings.accrue(address(pool), 100e18);
        savings.setYieldReverts(true);
        assertFalse(pool.yieldReadOk());
        assertEq(pool.totalAssets(), 10_000e18, "unreadable yield counts as zero");
        _buy(assessedProduct, 1_000e18, 30 days, 0); // sales still work

        // Deposits pause, so nobody mints shares at a price that ignores the hidden yield.
        assertEq(pool.maxDeposit(underwriter), 0);
        vm.startPrank(underwriter);
        musd.approve(address(pool), 1_000e18);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, underwriter, 1_000e18, 0));
        pool.deposit(1_000e18, underwriter);
        vm.stopPrank();

        savings.setYieldReverts(false);
        assertTrue(pool.yieldReadOk());
        _underwrite(1_000e18); // deposits reopen
    }

    function test_depositsStopWhenSharePriceCollapses() public {
        _underwrite(1_000e18);
        vm.startPrank(address(pm));
        pool.lockCover(999.999e18);
        pool.payClaim(buyer, 999.999e18, 999.999e18);
        vm.stopPrank();
        musd.mint(stranger, 1e18);
        vm.prank(stranger);
        musd.transfer(address(pool), 1); // a 1 wei donation does not reopen deposits
        assertGt(pool.totalAssets(), 0);
        assertEq(pool.maxDeposit(underwriter), 0, "price below 1% of par");
    }

    function test_constructorRejectsBadConfig() public {
        vm.expectRevert(BackstopPool.BadConfig.selector);
        new BackstopPool(IERC20(address(musd)), IMUSDSavingsRate(address(0xBEEF)), 1, 1); // no code
        vm.expectRevert(BackstopPool.BadConfig.selector);
        new BackstopPool(IERC20(address(musd)), IMUSDSavingsRate(address(savings)), 1, 0); // zero window
    }

    function test_depositsStopWhenAssetsAreWipedOut() public {
        _underwrite(1_000e18);
        vm.startPrank(address(pm));
        pool.lockCover(1_000e18);
        pool.payClaim(buyer, 1_000e18, 1_000e18);
        vm.stopPrank();
        assertEq(pool.totalAssets(), 0);
        assertGt(pool.totalSupply(), 0);
        assertEq(pool.maxDeposit(underwriter), 0);
        vm.startPrank(underwriter);
        musd.approve(address(pool), 1_000e18);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, underwriter, 1_000e18, 0));
        pool.deposit(1_000e18, underwriter);
        vm.stopPrank();
    }

    function test_utilization() public {
        _underwrite(10_000e18);
        assertEq(pool.utilizationBps(), 0);
        _buy(assessedProduct, 2_500e18, 30 days, 0);
        assertEq(pool.utilizationBps(), 2_500);
    }

    function testFuzz_depositRedeemNeverProfitsWithoutPremium(uint256 amount) public {
        amount = bound(amount, 1e18, 1_000_000e18);
        uint256 shares = _underwrite(amount);
        vm.prank(underwriter);
        pool.requestWithdraw(shares);
        vm.warp(block.timestamp + COOLDOWN);
        uint256 before = musd.balanceOf(underwriter);
        vm.prank(underwriter);
        uint256 out = pool.redeem(shares, underwriter, underwriter);
        assertLe(out, amount);
        assertEq(musd.balanceOf(underwriter) - before, out);
        assertGe(out + 1, amount, "loses at most 1 wei to rounding");
    }
}
