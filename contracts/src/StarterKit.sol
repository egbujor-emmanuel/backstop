// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StarterKit (Mezo testnet only)
/// @notice Gives a new wallet enough test MUSD and test BTC gas to try BACKSTOP, once per address.
/// The relayer pays the gas to deliver the kit, so the visitor needs nothing to start.
/// The one-kit-per-address rule is enforced here, not by the relayer.
contract StarterKit is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    uint256 public immutable musdPerKit;
    uint256 public immutable gasPerKit;
    address public relayer;

    mapping(address => bool) public claimed;
    uint256 public kitsGiven;

    event KitSent(address indexed to, uint256 musd, uint256 gas);
    event RelayerSet(address indexed relayer);

    error NotRelayer();
    error AlreadyClaimed();
    error Empty();
    error GasTransferFailed();

    constructor(address owner_, IERC20 musd_, uint256 musdPerKit_, uint256 gasPerKit_, address relayer_)
        Ownable(owner_)
    {
        musd = musd_;
        musdPerKit = musdPerKit_;
        gasPerKit = gasPerKit_;
        relayer = relayer_;
        emit RelayerSet(relayer_);
    }

    receive() external payable {}

    function setRelayer(address relayer_) external onlyOwner {
        relayer = relayer_;
        emit RelayerSet(relayer_);
    }

    function kitsLeft() external view returns (uint256) {
        uint256 byMusd = musd.balanceOf(address(this)) / musdPerKit;
        uint256 byGas = gasPerKit == 0 ? type(uint256).max : address(this).balance / gasPerKit;
        return byMusd < byGas ? byMusd : byGas;
    }

    function send(address to) external nonReentrant {
        if (msg.sender != relayer) revert NotRelayer();
        if (claimed[to]) revert AlreadyClaimed();
        if (musd.balanceOf(address(this)) < musdPerKit || address(this).balance < gasPerKit) revert Empty();
        claimed[to] = true;
        kitsGiven += 1;
        musd.safeTransfer(to, musdPerKit);
        (bool ok,) = to.call{value: gasPerKit}("");
        if (!ok) revert GasTransferFailed();
        emit KitSent(to, musdPerKit, gasPerKit);
    }

    /// @notice Owner recovers leftover test funds.
    function sweep(address to) external onlyOwner {
        musd.safeTransfer(to, musd.balanceOf(address(this)));
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert GasTransferFailed();
    }
}
