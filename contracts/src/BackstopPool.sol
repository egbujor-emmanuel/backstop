// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IMUSDSavingsRate} from "./interfaces/IMezo.sol";

/// @title BackstopPool
/// @notice Underwriting capital for BACKSTOP cover. Underwriters deposit MUSD and receive
/// bsMUSD shares. Idle MUSD is parked in Mezo's MUSD Savings Rate vault (sMUSD), so capital
/// earns the savings rate plus cover premiums. Every unit of active cover is backed 1:1 by
/// pool assets; underwriters can only withdraw capital that no active policy depends on, and
/// only after a cooldown, so they cannot flee when an incident becomes known.
/// @dev Nothing in this contract lets an owner or admin move funds. MUSD leaves the pool only
/// through ERC-4626 withdrawals by share owners or through payClaim() from the PolicyManager.
contract BackstopPool is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Premiums vest linearly over this period so a deposit made just before a
    /// premium arrives cannot capture it.
    uint256 public constant PREMIUM_VEST = 7 days;
    /// @notice Share of gross assets kept as liquid MUSD; the rest is parked in sMUSD.
    uint256 public constant BUFFER_BPS = 1_000;
    uint256 private constant BPS = 10_000;

    IMUSDSavingsRate public immutable savings;
    uint256 public immutable withdrawCooldown;
    uint256 public immutable withdrawWindow;
    address private immutable _deployer;

    address public policyManager;

    /// @notice Total cover currently backed by this pool.
    uint256 public activeCover;
    /// @notice Unvested premium as of lastPremiumUpdate.
    uint256 public lockedPremium;
    uint256 public lastPremiumUpdate;

    struct WithdrawRequest {
        uint128 shares;
        uint64 unlockAt;
    }

    mapping(address owner => WithdrawRequest) public withdrawRequests;

    event PolicyManagerSet(address indexed policyManager);
    event WithdrawRequested(address indexed owner, uint256 shares, uint256 unlockAt);
    event CoverLocked(uint256 amount, uint256 activeCover);
    event CoverUnlocked(uint256 amount, uint256 activeCover);
    event PremiumReceived(uint256 amount, uint256 lockedPremium);
    event ClaimPaid(address indexed to, uint256 amount, uint256 coverReleased);
    event Parked(uint256 amount);
    event Unparked(uint256 amount);
    event ParkFailed(uint256 amount);
    event YieldHarvested(uint256 amount);

    error NotPolicyManager();
    error NotDeployer();
    error AlreadySet();
    error ZeroAddress();
    error InsufficientFreeCapital(uint256 requested, uint256 available);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error WithdrawNotRequested();
    error ExceedsBalance();

    modifier onlyPolicyManager() {
        if (msg.sender != policyManager) revert NotPolicyManager();
        _;
    }

    constructor(
        IERC20 musd_,
        IMUSDSavingsRate savings_,
        uint256 withdrawCooldown_,
        uint256 withdrawWindow_
    ) ERC20("BACKSTOP Underwriter MUSD", "bsMUSD") ERC4626(musd_) {
        if (address(musd_) == address(0) || address(savings_) == address(0)) revert ZeroAddress();
        savings = savings_;
        withdrawCooldown = withdrawCooldown_;
        withdrawWindow = withdrawWindow_;
        _deployer = msg.sender;
        lastPremiumUpdate = block.timestamp;
    }

    /// @notice One-time wiring of the PolicyManager (the two contracts reference each other).
    function setPolicyManager(address policyManager_) external {
        if (msg.sender != _deployer) revert NotDeployer();
        if (policyManager != address(0)) revert AlreadySet();
        if (policyManager_ == address(0)) revert ZeroAddress();
        policyManager = policyManager_;
        emit PolicyManagerSet(policyManager_);
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    /// @notice MUSD held directly, plus sMUSD principal (1:1), plus claimable sMUSD yield.
    function grossAssets() public view returns (uint256) {
        IERC20 musd = IERC20(asset());
        return musd.balanceOf(address(this)) + savings.balanceOf(address(this))
            + savings.claimableYield(address(this));
    }

    /// @notice Premium that has not vested yet.
    function unvestedPremium() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastPremiumUpdate;
        if (elapsed >= PREMIUM_VEST) return 0;
        return Math.mulDiv(lockedPremium, PREMIUM_VEST - elapsed, PREMIUM_VEST);
    }

    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        uint256 gross = grossAssets();
        uint256 unvested = unvestedPremium();
        return gross > unvested ? gross - unvested : 0;
    }

    /// @notice Assets not needed to back active cover.
    function freeCapital() public view returns (uint256) {
        uint256 assets = totalAssets();
        return assets > activeCover ? assets - activeCover : 0;
    }

    /// @notice Active cover as a fraction of pool assets, in basis points.
    function utilizationBps() external view returns (uint256) {
        uint256 assets = totalAssets();
        if (assets == 0) return activeCover == 0 ? 0 : BPS;
        return Math.min(BPS, Math.mulDiv(activeCover, BPS, assets));
    }

    // ---------------------------------------------------------------------
    // Underwriter withdrawals: cooldown + free-capital limit
    // ---------------------------------------------------------------------

    /// @notice Start the cooldown for withdrawing `shares`. A new request replaces the old one.
    function requestWithdraw(uint256 shares) external {
        if (shares > balanceOf(msg.sender)) revert ExceedsBalance();
        uint64 unlockAt = SafeCast.toUint64(block.timestamp + withdrawCooldown);
        withdrawRequests[msg.sender] = WithdrawRequest(SafeCast.toUint128(shares), unlockAt);
        emit WithdrawRequested(msg.sender, shares, unlockAt);
    }

    /// @notice Shares `owner` may redeem right now.
    function maxRedeem(address owner) public view override returns (uint256) {
        WithdrawRequest memory r = withdrawRequests[owner];
        if (r.shares == 0) return 0;
        if (block.timestamp < r.unlockAt || block.timestamp > r.unlockAt + withdrawWindow) {
            return 0;
        }
        uint256 shares = Math.min(r.shares, balanceOf(owner));
        uint256 freeShares = _convertToShares(freeCapital(), Math.Rounding.Floor);
        return Math.min(shares, freeShares);
    }

    /// @notice Assets `owner` may withdraw right now.
    function maxWithdraw(address owner) public view override returns (uint256) {
        return _convertToAssets(maxRedeem(owner), Math.Rounding.Floor);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant {
        WithdrawRequest storage r = withdrawRequests[owner];
        if (r.shares < shares) revert WithdrawNotRequested();
        r.shares -= SafeCast.toUint128(shares);
        _ensureLiquid(assets);
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        super._deposit(caller, receiver, assets, shares);
        _park();
    }

    /// @dev Virtual-share offset hardens the vault against the ERC-4626 inflation attack.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------------
    // PolicyManager hooks
    // ---------------------------------------------------------------------

    function lockCover(uint256 amount) external onlyPolicyManager {
        uint256 available = freeCapital();
        if (amount > available) revert InsufficientFreeCapital(amount, available);
        activeCover += amount;
        emit CoverLocked(amount, activeCover);
    }

    function unlockCover(uint256 amount) external onlyPolicyManager {
        activeCover -= amount;
        emit CoverUnlocked(amount, activeCover);
    }

    /// @notice Called after the PolicyManager has transferred `amount` of premium in.
    function notifyPremium(uint256 amount) external onlyPolicyManager nonReentrant {
        lockedPremium = unvestedPremium() + amount;
        lastPremiumUpdate = block.timestamp;
        emit PremiumReceived(amount, lockedPremium);
        _park();
    }

    /// @notice Pays an approved claim and releases the cover that backed it.
    function payClaim(address to, uint256 amount, uint256 coverReleased)
        external
        onlyPolicyManager
        nonReentrant
    {
        activeCover -= coverReleased;
        _ensureLiquid(amount);
        IERC20(asset()).safeTransfer(to, amount);
        emit ClaimPaid(to, amount, coverReleased);
    }

    // ---------------------------------------------------------------------
    // sMUSD parking
    // ---------------------------------------------------------------------

    /// @notice Pull accrued sMUSD yield into the pool as liquid MUSD. Permissionless.
    function harvest() external nonReentrant returns (uint256 amount) {
        amount = savings.claimYield();
        emit YieldHarvested(amount);
        _park();
    }

    /// @notice Re-park liquid MUSD above the buffer. Permissionless.
    function rebalance() external nonReentrant {
        _park();
    }

    function _park() internal {
        IERC20 musd = IERC20(asset());
        uint256 liquid = musd.balanceOf(address(this));
        uint256 target = Math.mulDiv(grossAssets(), BUFFER_BPS, BPS);
        if (liquid <= target) return;
        uint256 amount = liquid - target;
        musd.forceApprove(address(savings), amount);
        try savings.deposit(amount) {
            emit Parked(amount);
        } catch {
            // If sMUSD is paused or reverts, keep the MUSD liquid; the pool keeps working.
            musd.forceApprove(address(savings), 0);
            emit ParkFailed(amount);
        }
    }

    function _ensureLiquid(uint256 amount) internal {
        IERC20 musd = IERC20(asset());
        uint256 liquid = musd.balanceOf(address(this));
        if (liquid >= amount) return;
        uint256 parked = savings.balanceOf(address(this));
        uint256 need = amount - liquid;
        uint256 pull = Math.min(need, parked);
        if (pull > 0) {
            savings.withdraw(pull);
            emit Unparked(pull);
        }
        liquid = musd.balanceOf(address(this));
        if (liquid < amount && savings.claimableYield(address(this)) > 0) {
            savings.claimYield();
            liquid = musd.balanceOf(address(this));
        }
        if (liquid < amount) revert InsufficientLiquidity(amount, liquid);
    }
}
