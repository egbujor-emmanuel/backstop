// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {PolicyManager} from "./PolicyManager.sol";
import {IVotingEscrow, IVotingPower} from "./interfaces/IMezo.sol";

/// @title ClaimsCourt
/// @notice Decides claims (smart-contract exploits, bridge failures, transaction halts and other
/// events a contract cannot observe by itself). A policy holder files a claim with evidence and a
/// small MUSD bond. veMEZO holders vote with the weight their lock had just before the claim was
/// filed. A claim passes with a supermajority, a quorum and a minimum number of distinct locks.
/// Voters on the winning side share an assessor reward funded by 5% of premiums and by the bonds
/// of rejected claims.
/// @dev Vote integrity:
/// - Weight is read from the lock's own checkpoint history at `filedAt - 1` (binary search over
///   VotingEscrow.userPointHistory, the same maths as VotingEscrow.balanceOfNFTAt). Nothing done
///   at or after filing changes it: not a merge, split, top-up by anyone (`depositFor` is
///   permissionless), or extension. Burned locks cannot vote, and locks created after filing have
///   no history before it.
/// - Each lock id votes once per claim; the claimant's address cannot vote on its own claim.
/// - Quorum is the larger of a floor and a share of veMEZO total voting power, fixed at filing. If
///   total voting power cannot be read, filing reverts rather than falling back to the floor.
/// - The assessor rewards a policy's claims can draw, in total, never exceed the assessor cut that
///   policy paid in (5% of its premium). Filing claims and voting on them yourself cannot pull out
///   what other buyers paid.
/// There is no admin. Payout is retryable, so a paused sMUSD can delay a payout but never lose a
/// decided claim. A bond refund that cannot be delivered is held for the claimant to withdraw, so
/// it never blocks a decision.
contract ClaimsCourt is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Outcome {
        PENDING,
        APPROVED,
        REJECTED,
        NO_QUORUM
    }

    struct Claim {
        uint256 policyId;
        address claimant;
        uint128 amount;
        uint128 bond;
        uint64 incidentAt;
        uint64 filedAt;
        uint64 votingEnds;
        Outcome outcome;
        bool payoutPending;
        uint32 voters;
        uint128 quorum;
        uint128 yesWeight;
        uint128 noWeight;
        uint128 rewardPot;
        string evidenceURI;
    }

    struct Vote {
        address voter;
        uint128 weight;
        bool approve;
        bool rewarded;
    }

    uint256 public constant BOND_BPS = 100; // 1% of the amount claimed
    uint256 public constant MIN_BOND = 1e18; // 1 MUSD
    uint256 public constant REWARD_SLICE_BPS = 2_000; // share of the reward pool per decided claim
    uint256 public constant MAX_EVIDENCE_LENGTH = 512;
    /// @notice Gas a finalize call must still hold before attempting a payout, so a caller cannot
    /// starve the payout on purpose to force a deferral.
    uint256 public constant MIN_PAYOUT_GAS = 500_000;
    uint256 private constant BPS = 10_000;
    /// @dev Bytes of a payout revert reason kept in PayoutDeferred.
    uint256 private constant MAX_REASON_BYTES = 256;

    IERC20 public immutable musd;
    PolicyManager public immutable policyManager;
    IVotingEscrow public immutable veMEZO;
    uint256 public immutable votingPeriod;
    /// @notice Absolute quorum floor, in veMEZO weight.
    uint256 public immutable minQuorum;
    /// @notice Quorum as a share of veMEZO total voting power at filing, in basis points.
    uint256 public immutable quorumBps;
    /// @notice Distinct veMEZO locks that must vote for a decision.
    uint256 public immutable minVoters;
    /// @notice Share of the weight cast that must be YES to approve, in basis points (> 50%).
    uint256 public immutable approvalBps;
    /// @notice A non-permanent lock must end at least this long after the vote closes.
    uint256 public immutable minLockTail;

    uint256 public rewardPool;
    Claim[] private _claims;
    mapping(uint256 claimId => mapping(uint256 tokenId => Vote)) public votes;
    /// @notice Assessor rewards already allotted to claims on each policy.
    mapping(uint256 policyId => uint256) public rewardsDrawn;
    /// @notice Bond refunds that could not be delivered, by claim, for the claimant to withdraw.
    mapping(uint256 claimId => uint256) public bondOwed;

    event RewardsNotified(uint256 amount, uint256 rewardPool);
    event ClaimFiled(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 amount,
        uint256 incidentAt,
        uint256 votingEnds,
        uint256 quorum,
        string evidenceURI
    );
    event Voted(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, bool approve, uint256 weight);
    event ClaimFinalized(uint256 indexed claimId, Outcome outcome, uint256 yesWeight, uint256 noWeight, uint256 rewardPot);
    event PayoutDeferred(uint256 indexed claimId, bytes reason);
    event PayoutCompleted(uint256 indexed claimId, uint256 amount);
    event RewardPaid(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, uint256 amount);
    event BondHeld(uint256 indexed claimId, uint256 amount);
    event BondWithdrawn(uint256 indexed claimId, address indexed claimant, uint256 amount);

    error NotPolicyManager();
    error ZeroAddress();
    error BadConfig();
    error NotHolder();
    error BadIncidentTime();
    error ClaimWindowClosed();
    error BadAmount();
    error BadEvidence();
    error UnknownClaim();
    error NotPending();
    error VotingClosed();
    error VotingOpen();
    error NotTokenOwner();
    error ClaimantCannotVote();
    error AlreadyVoted();
    error NoWeight();
    error NothingToClaim();
    error NoPayoutPending();
    error QuorumUnavailable();
    error InsufficientGas();

    constructor(
        IERC20 musd_,
        PolicyManager policyManager_,
        IVotingEscrow veMEZO_,
        uint256 votingPeriod_,
        uint256 minQuorum_,
        uint256 quorumBps_,
        uint256 minVoters_,
        uint256 approvalBps_,
        uint256 minLockTail_
    ) {
        if (address(musd_) == address(0) || address(policyManager_) == address(0) || address(veMEZO_) == address(0)) {
            revert ZeroAddress();
        }
        if (address(veMEZO_).code.length == 0) revert ZeroAddress();
        if (
            votingPeriod_ == 0 || minQuorum_ == 0 || quorumBps_ > BPS || minVoters_ == 0 || approvalBps_ <= BPS / 2
                || approvalBps_ > BPS
        ) revert BadConfig();
        musd = musd_;
        policyManager = policyManager_;
        veMEZO = veMEZO_;
        votingPeriod = votingPeriod_;
        minQuorum = minQuorum_;
        quorumBps = quorumBps_;
        minVoters = minVoters_;
        approvalBps = approvalBps_;
        minLockTail = minLockTail_;
        if (quorumBps_ > 0) currentQuorum(); // reverts now if total voting power is unreadable
    }

    /// @notice Called by the PolicyManager after it transferred `amount` of premium here.
    function notifyRewards(uint256 amount) external {
        if (msg.sender != address(policyManager)) revert NotPolicyManager();
        rewardPool += amount;
        emit RewardsNotified(amount, rewardPool);
    }

    // ---------------------------------------------------------------------
    // Filing
    // ---------------------------------------------------------------------

    /// @notice Bond required to claim `amount`: 1%, at least 1 MUSD.
    function bondFor(uint256 amount) public pure returns (uint256) {
        return Math.max(Math.mulDiv(amount, BOND_BPS, BPS), MIN_BOND);
    }

    /// @notice Quorum a claim filed now would need. Reverts if a relative quorum is configured and
    /// veMEZO total voting power cannot be read: the court fails closed, never down to the floor.
    function currentQuorum() public view returns (uint256) {
        if (quorumBps == 0) return minQuorum;
        (bool ok, bytes memory ret) =
            address(veMEZO).staticcall(abi.encodeWithSelector(IVotingPower.totalVotingPower.selector));
        if (!ok || ret.length < 32) revert QuorumUnavailable();
        uint256 total = abi.decode(ret, (uint256));
        if (total == 0) revert QuorumUnavailable();
        return Math.max(minQuorum, Math.mulDiv(total, quorumBps, BPS));
    }

    /// @notice File a claim on your policy for an incident inside its coverage, with an https
    /// evidence link and a bond (see bondFor). Approve the bond to this contract first.
    function fileClaim(uint256 policyId, uint256 amount, uint256 incidentAt, string calldata evidenceURI)
        external
        nonReentrant
        returns (uint256 claimId)
    {
        PolicyManager.Policy memory pol = policyManager.policies(policyId);
        if (msg.sender != pol.holder) revert NotHolder();
        if (incidentAt < pol.start || incidentAt > pol.end || incidentAt > block.timestamp) {
            revert BadIncidentTime();
        }
        if (block.timestamp > uint256(pol.end) + policyManager.CLAIM_GRACE()) revert ClaimWindowClosed();
        if (amount == 0 || amount > pol.cover) revert BadAmount();
        uint256 len = bytes(evidenceURI).length;
        if (len == 0 || len > MAX_EVIDENCE_LENGTH) revert BadEvidence();

        uint256 bond = bondFor(amount);
        uint256 quorum = currentQuorum();
        // openClaim reverts unless the policy is ACTIVE with no open claim and attempts left.
        policyManager.openClaim(policyId);

        claimId = _claims.length;
        Claim storage c = _claims.push();
        c.policyId = policyId;
        c.claimant = msg.sender;
        c.amount = SafeCast.toUint128(amount);
        c.bond = SafeCast.toUint128(bond);
        c.incidentAt = SafeCast.toUint64(incidentAt);
        c.filedAt = SafeCast.toUint64(block.timestamp);
        c.votingEnds = SafeCast.toUint64(block.timestamp + votingPeriod);
        c.quorum = SafeCast.toUint128(quorum);
        c.evidenceURI = evidenceURI;

        musd.safeTransferFrom(msg.sender, address(this), bond);
        emit ClaimFiled(claimId, policyId, msg.sender, amount, incidentAt, c.votingEnds, quorum, evidenceURI);
    }

    // ---------------------------------------------------------------------
    // Voting
    // ---------------------------------------------------------------------

    /// @notice Weight `tokenId` carries on `claimId`.
    function voteWeight(uint256 claimId, uint256 tokenId) public view returns (uint256) {
        Claim storage c = _claim(claimId);
        return weightAt(tokenId, c.filedAt, c.votingEnds);
    }

    /// @notice Weight of a veMEZO lock for a claim filed at `filedAt`: the lock's voting power one
    /// second before filing, from its checkpoint history. Zero if the lock had no checkpoint before
    /// filing, has since been burned, or (unless permanent) ends less than minLockTail after the
    /// vote closes.
    function weightAt(uint256 tokenId, uint256 filedAt, uint256 votingEnds) public view returns (uint256 weight) {
        if (filedAt == 0) return 0;
        uint256 t = filedAt - 1;
        (bool found, IVotingEscrow.UserPoint memory pt) = _pointAt(tokenId, t);
        if (!found) return 0;
        if (pt.permanent > 0) {
            weight = pt.permanent;
        } else {
            int256 b = int256(pt.bias) - int256(pt.slope) * SafeCast.toInt256(t - pt.ts);
            if (b <= 0) return 0;
            weight = uint256(b);
        }
        IVotingEscrow.LockedBalance memory l = veMEZO.locked(tokenId);
        if (l.amount <= 0) return 0;
        if (!l.isPermanent && l.end < votingEnds + minLockTail) return 0;
    }

    /// @dev Latest user checkpoint of `tokenId` with ts <= t.
    function _pointAt(uint256 tokenId, uint256 t) internal view returns (bool, IVotingEscrow.UserPoint memory) {
        IVotingEscrow.UserPoint memory none;
        uint256 hi = veMEZO.userPointEpoch(tokenId);
        if (hi == 0) return (false, none);
        IVotingEscrow.UserPoint memory last = veMEZO.userPointHistory(tokenId, hi);
        if (last.ts <= t) return (true, last); // common case: no change since before filing
        if (veMEZO.userPointHistory(tokenId, 1).ts > t) return (false, none);
        uint256 lo = 1;
        hi -= 1;
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (veMEZO.userPointHistory(tokenId, mid).ts <= t) lo = mid;
            else hi = mid - 1;
        }
        return (true, veMEZO.userPointHistory(tokenId, lo));
    }

    /// @notice Vote on an open claim with a veMEZO lock you own.
    function vote(uint256 claimId, uint256 tokenId, bool approve) external nonReentrant {
        Claim storage c = _claim(claimId);
        if (c.outcome != Outcome.PENDING) revert NotPending();
        if (block.timestamp > c.votingEnds) revert VotingClosed();
        if (veMEZO.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (msg.sender == c.claimant) revert ClaimantCannotVote();
        if (votes[claimId][tokenId].weight != 0) revert AlreadyVoted();

        uint256 weight = weightAt(tokenId, c.filedAt, c.votingEnds);
        if (weight == 0) revert NoWeight();
        uint128 w = SafeCast.toUint128(weight);
        votes[claimId][tokenId] = Vote({voter: msg.sender, weight: w, approve: approve, rewarded: false});
        c.voters += 1;
        if (approve) c.yesWeight += w;
        else c.noWeight += w;
        emit Voted(claimId, tokenId, msg.sender, approve, weight);
    }

    // ---------------------------------------------------------------------
    // Outcome, payout and rewards
    // ---------------------------------------------------------------------

    /// @notice Close the vote. Permissionless once voting ends.
    function finalize(uint256 claimId) external nonReentrant returns (Outcome outcome) {
        Claim storage c = _claim(claimId);
        if (c.outcome != Outcome.PENDING) revert NotPending();
        if (block.timestamp <= c.votingEnds) revert VotingOpen();

        uint256 total = uint256(c.yesWeight) + uint256(c.noWeight);
        if (total < c.quorum || c.voters < minVoters) {
            outcome = Outcome.NO_QUORUM;
            c.outcome = outcome;
            policyManager.closeClaim(c.policyId, false);
            _refundBond(claimId, c);
            emit ClaimFinalized(claimId, outcome, c.yesWeight, c.noWeight, 0);
            return outcome;
        }

        uint256 slice = _takeRewardSlice(c.policyId);

        if (uint256(c.yesWeight) * BPS >= total * approvalBps) {
            outcome = Outcome.APPROVED;
            c.outcome = outcome;
            c.rewardPot = SafeCast.toUint128(slice);
            c.payoutPending = true;
            emit ClaimFinalized(claimId, outcome, c.yesWeight, c.noWeight, c.rewardPot);
            if (gasleft() < MIN_PAYOUT_GAS) revert InsufficientGas();
            _tryPayout(claimId, c);
        } else {
            outcome = Outcome.REJECTED;
            c.outcome = outcome;
            c.rewardPot = SafeCast.toUint128(slice + c.bond);
            policyManager.closeClaim(c.policyId, true);
            emit ClaimFinalized(claimId, outcome, c.yesWeight, c.noWeight, c.rewardPot);
        }
    }

    /// @notice Retry the payout of an approved claim whose payout could not complete (for example
    /// while sMUSD withdrawals were paused). Permissionless; the money goes to the claimant.
    function retryPayout(uint256 claimId) external nonReentrant {
        Claim storage c = _claim(claimId);
        if (!c.payoutPending) revert NoPayoutPending();
        policyManager.settleAssessedClaim(c.policyId, c.amount);
        _completePayout(claimId, c);
    }

    /// @notice Withdraw a bond refund that could not be delivered when the claim closed.
    /// Permissionless; the money goes to the claimant.
    function withdrawBond(uint256 claimId) external nonReentrant {
        Claim storage c = _claim(claimId);
        uint256 amount = bondOwed[claimId];
        if (amount == 0) revert NothingToClaim();
        bondOwed[claimId] = 0;
        musd.safeTransfer(c.claimant, amount);
        emit BondWithdrawn(claimId, c.claimant, amount);
    }

    /// @dev A decided claim takes a slice of the reward pool. The slices of all claims on one
    /// policy are capped at the assessor cut that policy paid in.
    function _takeRewardSlice(uint256 policyId) internal returns (uint256 slice) {
        uint256 paidIn = Math.mulDiv(
            policyManager.policies(policyId).premium, policyManager.ASSESSOR_SHARE_BPS(), BPS
        );
        uint256 drawn = rewardsDrawn[policyId];
        uint256 left = paidIn > drawn ? paidIn - drawn : 0;
        slice = Math.min(Math.mulDiv(rewardPool, REWARD_SLICE_BPS, BPS), left);
        rewardsDrawn[policyId] = drawn + slice;
        rewardPool -= slice;
    }

    function _tryPayout(uint256 claimId, Claim storage c) internal {
        try policyManager.settleAssessedClaim(c.policyId, c.amount) {
            _completePayout(claimId, c);
        } catch {
            emit PayoutDeferred(claimId, _boundedRevertReason());
        }
    }

    function _completePayout(uint256 claimId, Claim storage c) internal {
        c.payoutPending = false;
        _refundBond(claimId, c);
        emit PayoutCompleted(claimId, c.amount);
    }

    /// @dev Return the bond, or hold it for withdrawBond if the transfer fails (for example the
    /// claimant's address is blocked by the token), so a refund can never block a decision.
    function _refundBond(uint256 claimId, Claim storage c) internal {
        if (!musd.trySafeTransfer(c.claimant, c.bond)) {
            bondOwed[claimId] = c.bond;
            emit BondHeld(claimId, c.bond);
        }
    }

    /// @dev The first MAX_REASON_BYTES of the last call's revert data, so an oversized revert
    /// payload cannot exhaust gas while it is copied.
    function _boundedRevertReason() private pure returns (bytes memory reason) {
        assembly ("memory-safe") {
            let size := returndatasize()
            if gt(size, MAX_REASON_BYTES) { size := MAX_REASON_BYTES }
            reason := mload(0x40)
            mstore(reason, size)
            returndatacopy(add(reason, 0x20), 0, size)
            mstore(0x40, add(add(reason, 0x20), and(add(size, 0x1f), not(0x1f))))
        }
    }

    /// @notice Reward still owed to the vote cast with `tokenId` on `claimId`.
    function pendingReward(uint256 claimId, uint256 tokenId) public view returns (uint256) {
        Claim storage c = _claim(claimId);
        Vote storage v = votes[claimId][tokenId];
        if (v.weight == 0 || v.rewarded) return 0;
        if (c.outcome == Outcome.APPROVED && v.approve) {
            return Math.mulDiv(c.rewardPot, v.weight, c.yesWeight);
        }
        if (c.outcome == Outcome.REJECTED && !v.approve) {
            return Math.mulDiv(c.rewardPot, v.weight, c.noWeight);
        }
        return 0;
    }

    /// @notice Pay a winning voter's share to the address that cast the vote. Permissionless.
    function claimReward(uint256 claimId, uint256 tokenId) external nonReentrant returns (uint256 amount) {
        amount = pendingReward(claimId, tokenId);
        if (amount == 0) revert NothingToClaim();
        Vote storage v = votes[claimId][tokenId];
        v.rewarded = true;
        musd.safeTransfer(v.voter, amount);
        emit RewardPaid(claimId, tokenId, v.voter, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function claimCount() external view returns (uint256) {
        return _claims.length;
    }

    function claims(uint256 claimId) external view returns (Claim memory) {
        return _claim(claimId);
    }

    function _claim(uint256 claimId) internal view returns (Claim storage) {
        if (claimId >= _claims.length) revert UnknownClaim();
        return _claims[claimId];
    }
}
