// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BackstopPool} from "../src/BackstopPool.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {ClaimsCourt} from "../src/ClaimsCourt.sol";
import {IMUSDSavingsRate, ITroveManager, IPriceFeed, IVotingEscrow} from "../src/interfaces/IMezo.sol";

/// Deploys BACKSTOP on Mezo testnet against the real Mezo contracts.
/// forge script script/Deploy.s.sol --rpc-url https://rpc.test.mezo.org --broadcast
contract Deploy is Script {
    // Mezo testnet (chain 31611). Each address verified on-chain on 2026-11-13.
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant SMUSD = 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant VEBTC = 0xB63fcCd03521Cf21907627bd7fA465C129479231;
    address constant VEMEZO = 0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b;

    // Testnet timings, short so a full cycle can be watched in one sitting.
    uint256 constant WITHDRAW_COOLDOWN = 1 hours;
    uint256 constant WITHDRAW_WINDOW = 2 days;
    uint256 constant VOTING_PERIOD = 1 hours;
    uint256 constant MIN_QUORUM = 60e18; // veMEZO weight floor
    // Relative quorum is 0 on testnet only: testnet veMEZO totals ~93M voting power while the team's
    // test locks hold 100. Mainnet sets this to a share of total voting power (e.g. 200 = 2%).
    uint256 constant QUORUM_BPS = 0;
    uint256 constant MIN_VOTERS = 2; // distinct veMEZO locks
    uint256 constant APPROVAL_BPS = 6_000; // 60% of the weight cast must be YES
    uint256 constant MIN_LOCK_TAIL = 1 days;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        require(block.chainid == 31611, "testnet only");

        vm.startBroadcast(pk);
        BackstopPool pool =
            new BackstopPool(IERC20(MUSD), IMUSDSavingsRate(SMUSD), WITHDRAW_COOLDOWN, WITHDRAW_WINDOW);
        PolicyManager pm = new PolicyManager(
            deployer,
            IERC20(MUSD),
            pool,
            ITroveManager(TROVE_MANAGER),
            IPriceFeed(PRICE_FEED),
            IVotingEscrow(VEBTC),
            deployer
        );
        pool.setPolicyManager(address(pm));
        ClaimsCourt court =
            new ClaimsCourt(IERC20(MUSD), pm, IVotingEscrow(VEMEZO), VOTING_PERIOD, MIN_QUORUM, QUORUM_BPS, MIN_VOTERS, APPROVAL_BPS, MIN_LOCK_TAIL);
        pm.setCourt(address(court));

        // Covered products. MUSD core contracts are deliberately excluded: cover paid in MUSD
        // cannot back a failure of MUSD itself.
        pm.addProduct(
            "veBTC lock: VotingEscrow exploit",
            "veBTC 0x7D807e9CE1ef73048FEe9A4214e75e894ea25914 (mainnet) / 0xB63fcCd03521Cf21907627bd7fA465C129479231 (testnet)",
            300,
            PolicyManager.PositionKind.VEBTC,
            1_000e18,
            500e18
        );
        pm.addProduct(
            "Trove collateral: Mezo chain or bridge exploit",
            "BTC held in your MUSD trove's ActivePool; covers loss from a Mezo chain or bridge exploit, not liquidation or redemption",
            400,
            PolicyManager.PositionKind.TROVE,
            1_000e18,
            500e18
        );
        pm.addProduct(
            "Mezo Swap (Tigris) pools exploit",
            "Tigris Router, PoolFactory, CL pools and gauges listed in mezo.org/docs Mezo Pools",
            500,
            PolicyManager.PositionKind.NONE,
            1_000e18,
            500e18
        );
        pm.addProduct(
            "Mezo transaction halt over 2 hours",
            "Pays when permissionless EVM transactions cannot be included on Mezo for 2+ hours while you hold a covered position (example: 2026-10-06, 09:30-15:00 UTC)",
            200,
            PolicyManager.PositionKind.NONE,
            1_000e18,
            500e18
        );
        pm.addProduct(
            "MEZO bridge (Wormhole NTT) exploit",
            "MEZO NTT Manager and Wormhole Transceiver on Mezo, Ethereum, Base and BSC listed in Mezo's contracts reference",
            600,
            PolicyManager.PositionKind.NONE,
            1_000e18,
            500e18
        );
        vm.stopBroadcast();

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployedAtBlock", block.number);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "pool", address(pool));
        vm.serializeAddress(obj, "policyManager", address(pm));
        string memory json = vm.serializeAddress(obj, "claimsCourt", address(court));
        console2.log(json);
    }
}
