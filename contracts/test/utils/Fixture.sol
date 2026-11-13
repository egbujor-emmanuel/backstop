// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BackstopPool} from "../../src/BackstopPool.sol";
import {PolicyManager} from "../../src/PolicyManager.sol";
import {ClaimsCourt} from "../../src/ClaimsCourt.sol";
import {IMUSDSavingsRate, ITroveManager, IPriceFeed, IVotingEscrow} from "../../src/interfaces/IMezo.sol";
import {TestMUSD, TestSavings, TestTroveManager, TestPriceFeed, TestVotingEscrow} from "./Doubles.sol";

abstract contract Fixture is Test {
    uint256 internal constant BTC_PRICE = 70_000e18;
    uint256 internal constant COOLDOWN = 1 days;
    uint256 internal constant WINDOW = 2 days;
    uint256 internal constant VOTING_PERIOD = 3 days;
    uint256 internal constant QUORUM = 1_000e18;
    uint256 internal constant MIN_LOCK_TAIL = 7 days;
    uint256 internal constant MIN_VOTERS = 2;
    uint256 internal constant APPROVAL_BPS = 6_000;

    TestMUSD internal musd;
    TestSavings internal savings;
    TestTroveManager internal troves;
    TestPriceFeed internal feed;
    TestVotingEscrow internal veBTC;
    TestVotingEscrow internal veMEZO;

    BackstopPool internal pool;
    PolicyManager internal pm;
    ClaimsCourt internal court;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal underwriter = makeAddr("underwriter");
    address internal buyer = makeAddr("buyer");
    address internal assessorA = makeAddr("assessorA");
    address internal assessorB = makeAddr("assessorB");
    address internal stranger = makeAddr("stranger");

    uint256 internal assessedProduct; // NONE kind, assessed
    uint256 internal veBTCProduct; // VEBTC kind, assessed
    uint256 internal troveProduct; // TROVE kind, assessed
    uint256 internal haltProduct; // NONE kind, assessed, cheaper rate

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        vm.roll(1_000_000);

        musd = new TestMUSD();
        savings = new TestSavings(IERC20(address(musd)));
        troves = new TestTroveManager();
        feed = new TestPriceFeed(BTC_PRICE);
        veBTC = new TestVotingEscrow();
        veMEZO = new TestVotingEscrow();

        pool = new BackstopPool(IERC20(address(musd)), IMUSDSavingsRate(address(savings)), COOLDOWN, WINDOW);
        pm = new PolicyManager(
            owner,
            IERC20(address(musd)),
            pool,
            ITroveManager(address(troves)),
            IPriceFeed(address(feed)),
            IVotingEscrow(address(veBTC)),
            treasury
        );
        pool.setPolicyManager(address(pm));
        court = new ClaimsCourt(
            IERC20(address(musd)), pm, IVotingEscrow(address(veMEZO)), VOTING_PERIOD, QUORUM, 0, MIN_VOTERS, APPROVAL_BPS, MIN_LOCK_TAIL
        );

        vm.startPrank(owner);
        pm.setCourt(address(court));
        assessedProduct = pm.addProduct(
            "Tigris pools exploit", "ipfs://tigris", 500, PolicyManager.PositionKind.NONE, 1_000_000e18, 100_000e18
        );
        veBTCProduct = pm.addProduct(
            "veBTC lock exploit", "ipfs://vebtc", 300, PolicyManager.PositionKind.VEBTC, 1_000_000e18, 100_000e18
        );
        troveProduct = pm.addProduct(
            "Trove collateral exploit", "ipfs://trove", 400, PolicyManager.PositionKind.TROVE, 1_000_000e18, 100_000e18
        );
        haltProduct = pm.addProduct(
            "Mezo transaction halt", "ipfs://halt", 200, PolicyManager.PositionKind.NONE, 1_000_000e18, 100_000e18
        );
        vm.stopPrank();

        musd.mint(underwriter, 1_000_000e18);
        musd.mint(buyer, 100_000e18);
        musd.mint(address(savings), 1_000_000e18); // funds yield the double pays out
        vm.prank(buyer);
        musd.approve(address(pm), type(uint256).max);
        vm.prank(buyer);
        musd.approve(address(court), type(uint256).max);
    }

    function _underwrite(uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(underwriter);
        musd.approve(address(pool), amount);
        shares = pool.deposit(amount, underwriter);
        vm.stopPrank();
    }

    function _buy(uint256 productId, uint256 cover, uint256 duration, uint256 positionId)
        internal
        returns (uint256 policyId)
    {
        vm.prank(buyer);
        policyId = pm.buy(productId, cover, duration, positionId, type(uint256).max);
    }

    function _giveVeMEZO(uint256 tokenId, address to, int128 amount, uint256 end, bool permanent) internal {
        veMEZO.setLock(tokenId, to, amount, end, permanent);
    }
}
