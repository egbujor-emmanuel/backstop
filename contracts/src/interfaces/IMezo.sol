// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal interfaces for the Mezo contracts BACKSTOP composes with.
/// Every signature below was checked against mezo-org source and against live
/// calls on Mezo testnet (chain 31611) on 2026-11-13.

/// @dev MUSD Savings Rate vault (sMUSD). Not ERC-4626: deposits mint sMUSD 1:1 and
/// yield accrues on a separate index that holders pull with claimYield().
/// Testnet proxy 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16 (the docs' address has no code
/// on testnet). Mainnet proxy 0xb4D498029af77680cD1eF828b967f010d06C51CC.
interface IMUSDSavingsRate {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claimYield() external returns (uint256);
    function claimableYield(address account) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function yieldToken() external view returns (address);
}

/// @dev MUSD TroveManager (Liquity-derived). Status enum order from ITroveManager.sol.
interface ITroveManager {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    function getTroveStatus(address borrower) external view returns (Status);
    function getTroveColl(address borrower) external view returns (uint256);
}

/// @dev MUSD PriceFeed: BTC/USD with 18 decimals, the price MUSD itself uses.
interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

/// @dev Tigris VotingEscrow (veBTC and veMEZO share this base contract).
interface IVotingEscrow {
    struct LockedBalance {
        int128 amount;
        uint256 end;
        bool isPermanent;
    }

    /// @dev Field order from tigris IVotingEscrow.UserPoint; verified against veMEZO testnet.
    struct UserPoint {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
        uint256 permanent;
    }

    function ownerOf(uint256 tokenId) external view returns (address);
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function token() external view returns (address);
    /// @notice Latest checkpoint index of a lock. Every create, merge, split, deposit, unlock-time
    /// change or permanent-lock toggle writes a new checkpoint.
    function userPointEpoch(uint256 tokenId) external view returns (uint256);
    function userPointHistory(uint256 tokenId, uint256 loc) external view returns (UserPoint memory);
}

/// @dev Mezo's veMEZO exposes total voting power (verified on testnet: totalVotingPower()).
interface IVotingPower {
    function totalVotingPower() external view returns (uint256);
}
