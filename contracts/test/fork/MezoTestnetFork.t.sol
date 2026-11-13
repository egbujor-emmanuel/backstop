// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BackstopPool} from "../../src/BackstopPool.sol";
import {PolicyManager} from "../../src/PolicyManager.sol";
import {ClaimsCourt} from "../../src/ClaimsCourt.sol";
import {IMUSDSavingsRate, ITroveManager, IPriceFeed, IVotingEscrow} from "../../src/interfaces/IMezo.sol";

interface ISortedTroves {
    function getFirst() external view returns (address);
    function getNext(address id) external view returns (address);
}

/// Runs the full BACKSTOP lifecycle against the real Mezo testnet contracts (chain 31611).
/// Run with: forge test --match-path test/fork/* --fork-url https://rpc.test.mezo.org
contract MezoTestnetForkTest is Test {
    IERC20 constant MUSD = IERC20(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
    IMUSDSavingsRate constant SMUSD = IMUSDSavingsRate(0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16);
    ITroveManager constant TROVES = ITroveManager(0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0);
    ISortedTroves constant SORTED = ISortedTroves(0x722E4D24FD6Ff8b0AC679450F3D91294607268fA);
    IPriceFeed constant FEED = IPriceFeed(0x86bCF0841622a5dAC14A313a15f96A95421b9366);
    IVotingEscrow constant VEBTC = IVotingEscrow(0xB63fcCd03521Cf21907627bd7fA465C129479231);
    IVotingEscrow constant VEMEZO = IVotingEscrow(0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b);

    BackstopPool pool;
    PolicyManager pm;
    ClaimsCourt court;
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address underwriter = makeAddr("underwriter");

    function setUp() public {
        if (block.chainid != 31611) {
            vm.skip(true);
            return;
        }
        pool = new BackstopPool(MUSD, SMUSD, 1 hours, 2 days);
        pm = new PolicyManager(owner, MUSD, pool, TROVES, FEED, VEBTC, treasury);
        pool.setPolicyManager(address(pm));
        court = new ClaimsCourt(MUSD, pm, VEMEZO, 1 hours, 1e18, 0, 1, 6_000, 1 days);
        vm.startPrank(owner);
        pm.setCourt(address(court));
        pm.addProduct("veBTC lock exploit", "ipfs://vebtc", 300, PolicyManager.PositionKind.VEBTC, 1_000_000e18, 100_000e18);
        pm.addProduct("Trove collateral exploit", "ipfs://trove", 400, PolicyManager.PositionKind.TROVE, 1_000_000e18, 100_000e18);
        vm.stopPrank();
        deal(address(MUSD), underwriter, 50_000e18);

        // Mezo's Skip BTC/USD oracle is a native precompile: Foundry's local EVM cannot execute
        // it (its placeholder bytecode calls itself). Read the real value from the live chain and
        // serve it to the local EVM, re-stamped whenever the test moves time forward.
        bytes memory raw = vm.rpc(
            "eth_call", '[{"to":"0x7b7c000000000000000000000000000000000015","data":"0xfeaf968c"},"latest"]'
        );
        (skipRound, skipAnswer,,,) = abi.decode(raw, (uint80, int256, uint256, uint256, uint80));
        console2.log("live Skip BTC/USD", uint256(skipAnswer) / 1e18);
        bytes memory dec = vm.rpc("eth_call", '[{"to":"0x7b7c000000000000000000000000000000000015","data":"0x313ce567"},"latest"]');
        vm.mockCall(SKIP, abi.encodeWithSignature("decimals()"), dec);
        _serveSkip();
    }

    address constant SKIP = 0x7b7c000000000000000000000000000000000015;
    uint80 skipRound;
    int256 skipAnswer;

    function _serveSkip() internal {
        vm.mockCall(
            SKIP,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(skipRound, skipAnswer, block.timestamp, block.timestamp, skipRound)
        );
    }

    function _warp(uint256 t) internal {
        vm.warp(t);
        _serveSkip();
    }

    function _firstTroveOwner() internal view returns (address) {
        return SORTED.getFirst();
    }

    function _veBTCWithLock() internal view returns (uint256 id, address holder) {
        for (id = 1; id <= 424; id++) {
            holder = VEBTC.ownerOf(id);
            if (holder != address(0) && holder.code.length == 0 && VEBTC.locked(id).amount > 0) return (id, holder);
        }
        revert("no veBTC lock found");
    }

    function _veMEZOVoter(uint256 claimId, address exclude) internal view returns (uint256 id, address holder) {
        for (id = 1; id <= 951; id++) {
            holder = VEMEZO.ownerOf(id);
            if (holder == address(0) || holder == exclude || holder.code.length != 0) continue;
            if (court.voteWeight(claimId, id) > 0) return (id, holder);
        }
        revert("no veMEZO voter found");
    }

    function test_fork_fullLifecycleOnRealMezoContracts() public {
        uint256 shares = _stepUnderwrite();
        (address borrower, uint256 trovePolicy, uint256 troveCover) = _stepTroveCover();
        _stepVeBTCCover();
        _stepClaim(borrower, trovePolicy, troveCover);
        _stepExit(shares);
    }

    /// 1. Underwriting capital is parked in the real sMUSD vault.
    function _stepUnderwrite() internal returns (uint256 shares) {
        uint256 smusdBefore = SMUSD.balanceOf(address(pool));
        vm.startPrank(underwriter);
        MUSD.approve(address(pool), 20_000e18);
        shares = pool.deposit(20_000e18, underwriter);
        vm.stopPrank();
        assertEq(SMUSD.balanceOf(address(pool)) - smusdBefore, 18_000e18, "90% parked in real sMUSD");
        assertEq(pool.totalAssets(), 20_000e18);
    }

    /// 2. A real trove owner insures their trove, capped by collateral at MUSD's PriceFeed.
    function _stepTroveCover() internal returns (address borrower, uint256 policyId, uint256 cover) {
        borrower = _firstTroveOwner();
        assertEq(uint8(TROVES.getTroveStatus(borrower)), uint8(ITroveManager.Status.active));
        uint256 value = pm.insurableValue(1, borrower, 0);
        assertEq(value, TROVES.getTroveColl(borrower) * FEED.fetchPrice() / 1e18, "value at real oracle");
        cover = value < 5_000e18 ? value : 5_000e18;
        deal(address(MUSD), borrower, 1_000e18);
        vm.startPrank(borrower);
        MUSD.approve(address(pm), type(uint256).max);
        MUSD.approve(address(court), type(uint256).max);
        policyId = pm.buy(1, cover, 30 days, 0, type(uint256).max);
        vm.stopPrank();
        console2.log("trove owner", borrower);
        console2.log("trove cover (MUSD)", cover / 1e18);
    }

    /// 3. A real veBTC holder insures their lock.
    function _stepVeBTCCover() internal {
        (uint256 veId, address veHolder) = _veBTCWithLock();
        uint256 value = pm.insurableValue(0, veHolder, veId);
        assertGt(value, 0);
        uint256 cover = value < 2_000e18 ? value : 2_000e18;
        console2.log("veBTC id", veId);
        console2.log("veBTC insurable value (MUSD)", value / 1e18);
        if (cover < pm.MIN_COVER()) return;
        deal(address(MUSD), veHolder, 1_000e18);
        vm.startPrank(veHolder);
        MUSD.approve(address(pm), type(uint256).max);
        pm.buy(0, cover, 30 days, veId, type(uint256).max);
        vm.stopPrank();
    }

    /// 4-5. Claim, real veMEZO vote, payout pulled back out of real sMUSD.
    function _stepClaim(address borrower, uint256 policyId, uint256 cover) internal {
        _warp(block.timestamp + 1 days);
        vm.prank(borrower);
        uint256 claimId = court.fileClaim(policyId, cover, block.timestamp - 1, "ipfs://fork-drill");
        uint256 ends = court.claims(claimId).votingEnds;
        (uint256 mezoId, address voter) = _veMEZOVoter(claimId, borrower);
        console2.log("veMEZO voter id", mezoId);
        console2.log("vote weight", court.voteWeight(claimId, mezoId) / 1e18);
        vm.prank(voter);
        court.vote(claimId, mezoId, true);

        _warp(ends + 1);
        uint256 balBefore = MUSD.balanceOf(borrower);
        uint256 gasBefore = gasleft();
        assertEq(uint8(court.finalize(claimId)), uint8(ClaimsCourt.Outcome.APPROVED));
        uint256 finalizeGas = gasBefore - gasleft();
        console2.log("finalize gas, payout from real sMUSD included", finalizeGas);
        // The payout must fit easily inside the gas finalize guarantees it (MIN_PAYOUT_GAS).
        assertLt(finalizeGas, court.MIN_PAYOUT_GAS() * 3 / 4, "payout fits the reserved gas");
        assertFalse(court.claims(claimId).payoutPending, "paid in the same call, not deferred");
        assertEq(MUSD.balanceOf(borrower) - balBefore, cover + court.bondFor(cover), "payout + bond");
        assertGe(pool.grossAssets(), pool.activeCover(), "remaining cover backed");
    }

    /// 6. The underwriter exits through the cooldown; MUSD is pulled from real sMUSD.
    function _stepExit(uint256 shares) internal {
        vm.prank(underwriter);
        pool.requestWithdraw(shares);
        _warp(block.timestamp + 1 hours);
        uint256 maxOut = pool.maxWithdraw(underwriter);
        assertGt(maxOut, 0);
        vm.prank(underwriter);
        pool.withdraw(maxOut, underwriter, underwriter);
        assertGe(pool.grossAssets(), pool.activeCover(), "cover still backed after exit");
    }
}
