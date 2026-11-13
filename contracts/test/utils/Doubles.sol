// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITroveManager, IVotingEscrow} from "../../src/interfaces/IMezo.sol";

/// Unit-test doubles that reproduce the observed behaviour of Mezo's contracts. The fork
/// suite (test/fork) runs the same flows against the real contracts on Mezo testnet.

contract TestMUSD is ERC20 {
    constructor() ERC20("Mezo USD", "MUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Mirrors MUSDSavingsRate: deposit mints 1:1, yield is claimed separately in MUSD.
contract TestSavings {
    IERC20 public immutable musd;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public claimableYield;
    bool public depositsPaused;

    constructor(IERC20 musd_) {
        musd = musd_;
    }

    function yieldToken() external view returns (address) {
        return address(musd);
    }

    function setDepositsPaused(bool paused) external {
        depositsPaused = paused;
    }

    function deposit(uint256 amount) external {
        require(!depositsPaused, "paused");
        musd.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        musd.transfer(msg.sender, amount);
    }

    /// Test hook: credit yield that is already funded in this contract.
    function accrue(address account, uint256 amount) external {
        claimableYield[account] += amount;
    }

    function claimYield() external returns (uint256 amount) {
        amount = claimableYield[msg.sender];
        claimableYield[msg.sender] = 0;
        musd.transfer(msg.sender, amount);
    }
}

contract TestTroveManager {
    mapping(address => ITroveManager.Status) public status;
    mapping(address => uint256) public coll;

    function setTrove(address borrower, ITroveManager.Status s, uint256 c) external {
        status[borrower] = s;
        coll[borrower] = c;
    }

    function getTroveStatus(address borrower) external view returns (ITroveManager.Status) {
        return status[borrower];
    }

    function getTroveColl(address borrower) external view returns (uint256) {
        return coll[borrower];
    }
}

contract TestPriceFeed {
    uint256 public price;

    constructor(uint256 price_) {
        price = price_;
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}

/// Mirrors Tigris VotingEscrow reads used by BACKSTOP. ownerOf returns address(0) for unknown
/// ids instead of reverting, as observed on veBTC testnet.
contract TestVotingEscrow {
    mapping(uint256 => address) internal _owner;
    mapping(uint256 => IVotingEscrow.LockedBalance) internal _locked;

    function setLock(uint256 tokenId, address owner, int128 amount, uint256 end, bool permanent) external {
        _owner[tokenId] = owner;
        _locked[tokenId] = IVotingEscrow.LockedBalance(amount, end, permanent);
    }

    function transfer(uint256 tokenId, address to) external {
        _owner[tokenId] = to;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owner[tokenId];
    }

    function locked(uint256 tokenId) external view returns (IVotingEscrow.LockedBalance memory) {
        return _locked[tokenId];
    }

    function token() external pure returns (address) {
        return address(0);
    }
}
