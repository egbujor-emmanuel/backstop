// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {PolicyManager} from "./PolicyManager.sol";
import {IVotingEscrow} from "./interfaces/IMezo.sol";

/// @title ClaimsCourt
/// @notice Decides assessed claims (smart-contract exploits, bridge failures and other events a
/// contract cannot observe by itself). Holders of a policy file a claim with evidence and a small
/// MUSD bond. veMEZO holders vote, weighted by their lock: the longer and larger the lock, the
/// more weight, and a lock must outlast the vote so voters carry the long-term cost of a bad
/// decision. Each veMEZO lock votes once per claim. Voters on the winning side share an assessor
/// reward funded by 5% of premiums and by the bonds of rejected claims.
/// @dev Assessors keep custody of their veMEZO: weight is read from VotingEscrow.locked() at vote
/// time and the vote is recorded against the tokenId, so moving the NFT to another wallet cannot
/// vote twice. There is no admin.
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
    /// @notice veMEZO maximum lock (Mezo docs: 4 years, 1,456 days).
    uint256 public constant MAXTIME = 1_456 days;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    PolicyManager public immutable policyManager;
    IVotingEscrow public immutable veMEZO;
    uint256 public immutable votingPeriod;
    uint256 public immutable quorum;
    uint256 public immutable minLockTail;

    uint256 public rewardPool;
    Claim[] private _claims;
    mapping(uint256 claimId => mapping(uint256 tokenId => Vote)) public votes;

    event RewardsNotified(uint256 amount, uint256 rewardPool);
    event ClaimFiled(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 amount,
        uint256 incidentAt,
        uint256 votingEnds,
        string evidenceURI
    );
    event Voted(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, bool approve, uint256 weight);
    event ClaimFinalized(uint256 indexed claimId, Outcome outcome, uint256 yesWeight, uint256 noWeight, uint256 rewardPot);
    event RewardPaid(uint256 indexed claimId, uint256 indexed tokenId, address indexed voter, uint256 amount);

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

    constructor(
        IERC20 musd_,
        PolicyManager policyManager_,
        IVotingEscrow veMEZO_,
        uint256 votingPeriod_,
        uint256 quorum_,
        uint256 minLockTail_
    ) {
        if (address(musd_) == address(0) || address(policyManager_) == address(0) || address(veMEZO_) == address(0)) {
            revert ZeroAddress();
        }
        if (votingPeriod_ == 0 || quorum_ == 0) revert BadConfig();
        musd = musd_;
        policyManager = policyManager_;
        veMEZO = veMEZO_;
        votingPeriod = votingPeriod_;
        quorum = quorum_;
        minLockTail = minLockTail_;
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

    function bondFor(uint256 amount) public pure returns (uint256) {
        return Math.max(Math.mulDiv(amount, BOND_BPS, BPS), MIN_BOND);
    }

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
        // openClaim reverts unless the policy is ACTIVE, ASSESSED and has no open claim.
        policyManager.openClaim(policyId);

        claimId = _claims.length;
        uint64 votingEnds = SafeCast.toUint64(block.timestamp + votingPeriod);
        _claims.push(
            Claim({
                policyId: policyId,
                claimant: msg.sender,
                amount: SafeCast.toUint128(amount),
                bond: SafeCast.toUint128(bond),
                incidentAt: SafeCast.toUint64(incidentAt),
                filedAt: SafeCast.toUint64(block.timestamp),
                votingEnds: votingEnds,
                outcome: Outcome.PENDING,
                yesWeight: 0,
                noWeight: 0,
                rewardPot: 0,
                evidenceURI: evidenceURI
            })
        );
        musd.safeTransferFrom(msg.sender, address(this), bond);
        emit ClaimFiled(claimId, policyId, msg.sender, amount, incidentAt, votingEnds, evidenceURI);
    }

    // ---------------------------------------------------------------------
    // Voting
    // ---------------------------------------------------------------------

    /// @notice Voting weight of a veMEZO lock for a vote ending at `votingEnds`. Permanent locks
    /// count in full. Other locks count by remaining time and must end at least minLockTail after
    /// the vote closes.
    function voteWeight(uint256 tokenId, uint256 votingEnds) public view returns (uint256) {
        IVotingEscrow.LockedBalance memory l = veMEZO.locked(tokenId);
        if (l.amount <= 0) return 0;
        uint256 amount = uint256(int256(l.amount));
        if (l.isPermanent) return amount;
        if (l.end < votingEnds + minLockTail || l.end <= block.timestamp) return 0;
        uint256 remaining = l.end - block.timestamp;
        return Math.min(amount, Math.mulDiv(amount, remaining, MAXTIME));
    }

    function vote(uint256 claimId, uint256 tokenId, bool approve) external nonReentrant {
        Claim storage c = _claim(claimId);
        if (c.outcome != Outcome.PENDING) revert NotPending();
        if (block.timestamp > c.votingEnds) revert VotingClosed();
        if (veMEZO.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (msg.sender == c.claimant) revert ClaimantCannotVote();
        if (votes[claimId][tokenId].weight != 0) revert AlreadyVoted();

        uint256 weight = voteWeight(tokenId, c.votingEnds);
        if (weight == 0) revert NoWeight();
        uint128 w = SafeCast.toUint128(weight);
        votes[claimId][tokenId] = Vote({voter: msg.sender, weight: w, approve: approve, rewarded: false});
        if (approve) c.yesWeight += w;
        else c.noWeight += w;
        emit Voted(claimId, tokenId, msg.sender, approve, weight);
    }

    // ---------------------------------------------------------------------
    // Outcome and rewards
    // ---------------------------------------------------------------------

    /// @notice Close the vote. Permissionless once voting ends.
    function finalize(uint256 claimId) external nonReentrant returns (Outcome outcome) {
        Claim storage c = _claim(claimId);
        if (c.outcome != Outcome.PENDING) revert NotPending();
        if (block.timestamp <= c.votingEnds) revert VotingOpen();

        uint256 total = uint256(c.yesWeight) + uint256(c.noWeight);
        uint256 bond = c.bond;
        if (total < quorum) {
            outcome = Outcome.NO_QUORUM;
            c.outcome = outcome;
            policyManager.closeClaim(c.policyId);
            musd.safeTransfer(c.claimant, bond);
        } else {
            uint256 slice = Math.mulDiv(rewardPool, REWARD_SLICE_BPS, BPS);
            rewardPool -= slice;
            if (c.yesWeight > c.noWeight) {
                outcome = Outcome.APPROVED;
                c.outcome = outcome;
                c.rewardPot = SafeCast.toUint128(slice);
                policyManager.settleAssessedClaim(c.policyId, c.amount);
                musd.safeTransfer(c.claimant, bond);
            } else {
                outcome = Outcome.REJECTED;
                c.outcome = outcome;
                c.rewardPot = SafeCast.toUint128(slice + bond);
                policyManager.closeClaim(c.policyId);
            }
        }
        emit ClaimFinalized(claimId, outcome, c.yesWeight, c.noWeight, c.rewardPot);
    }

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
