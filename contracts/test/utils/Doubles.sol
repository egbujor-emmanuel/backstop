// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITroveManager, IVotingEscrow} from "../../src/interfaces/IMezo.sol";

/// Unit-test doubles that reproduce the observed behaviour of Mezo's contracts. The fork
/// suite (test/fork) runs the same flows against the real contracts on Mezo testnet.

contract TestMUSD is ERC20 {
    mapping(address => bool) public frozen;

    constructor() ERC20("Mezo USD", "MUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// Test hook: make transfers to `who` revert, to simulate a payout that cannot complete.
    function setFrozen(address who, bool f) external {
        frozen[who] = f;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!frozen[to], "frozen");
        super._update(from, to, value);
    }
}

/// Mirrors MUSDSavingsRate: deposit mints 1:1, yield is claimed separately in MUSD.
contract TestSavings {
    IERC20 public immutable musd;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) internal _claimable;

    function claimableYield(address account) external view returns (uint256) {
        require(!yieldReverts, "yield read paused");
        return _claimable[account];
    }
    bool public depositsPaused;
    bool public yieldReverts;

    constructor(IERC20 musd_) {
        musd = musd_;
    }

    function yieldToken() external view returns (address) {
        return address(musd);
    }

    function setDepositsPaused(bool paused) external {
        depositsPaused = paused;
    }

    function setYieldReverts(bool r) external {
        yieldReverts = r;
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
        _claimable[account] += amount;
    }

    function claimYield() external returns (uint256 amount) {
        amount = _claimable[msg.sender];
        _claimable[msg.sender] = 0;
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
    /// Same lock maths as Tigris VotingEscrow: bias = amount * (end - ts) / MAXTIME,
    /// slope = amount / MAXTIME, and permanent locks carry their amount in `permanent`.
    uint256 public constant MAXTIME = 1_456 days;

    mapping(uint256 => address) internal _owner;
    mapping(uint256 => IVotingEscrow.LockedBalance) internal _locked;
    mapping(uint256 => uint256) internal _epoch;
    mapping(uint256 => mapping(uint256 => IVotingEscrow.UserPoint)) internal _points;
    uint256 internal _totalVotingPower;
    bool public votingPowerReverts;

    /// Creates or changes a lock now and writes a user checkpoint, as VotingEscrow does on create,
    /// merge, split, deposit, extension or permanent toggle. A second change in the same second
    /// overwrites that second's checkpoint, as Tigris does.
    function setLock(uint256 tokenId, address owner, int128 amount, uint256 end, bool permanent) public {
        _owner[tokenId] = owner;
        _locked[tokenId] = IVotingEscrow.LockedBalance(amount, end, permanent);
        IVotingEscrow.UserPoint memory pt;
        pt.ts = block.timestamp;
        pt.blk = block.number;
        if (amount > 0) {
            uint256 a = uint256(int256(amount));
            if (permanent) {
                pt.permanent = a;
            } else if (end > block.timestamp) {
                pt.slope = int128(int256(a / MAXTIME));
                pt.bias = int128(int256(a / MAXTIME * (end - block.timestamp)));
            }
        }
        uint256 e = _epoch[tokenId];
        if (e == 0 || _points[tokenId][e].ts != block.timestamp) {
            e += 1;
            _epoch[tokenId] = e;
        }
        _points[tokenId][e] = pt;
    }

    /// Anyone can top up any lock in Tigris; this writes a checkpoint on someone else's lock.
    function depositFor(uint256 tokenId, int128 value) external {
        IVotingEscrow.LockedBalance memory l = _locked[tokenId];
        setLock(tokenId, _owner[tokenId], l.amount + value, l.end, l.isPermanent);
    }

    /// Burn (merge source or withdraw).
    function burn(uint256 tokenId) external {
        _owner[tokenId] = address(0);
        _locked[tokenId] = IVotingEscrow.LockedBalance(0, 0, false);
    }

    function setTotalVotingPower(uint256 v) external {
        _totalVotingPower = v;
    }

    function setVotingPowerReverts(bool r) external {
        votingPowerReverts = r;
    }

    function totalVotingPower() external view returns (uint256) {
        require(!votingPowerReverts, "voting power unavailable");
        return _totalVotingPower;
    }

    function userPointEpoch(uint256 tokenId) external view returns (uint256) {
        return _epoch[tokenId];
    }

    function userPointHistory(uint256 tokenId, uint256 loc) external view returns (IVotingEscrow.UserPoint memory) {
        return _points[tokenId][loc];
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
