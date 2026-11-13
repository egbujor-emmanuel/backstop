// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

import {BackstopPool} from "./BackstopPool.sol";
import {ITroveManager, IPriceFeed, IVotingEscrow} from "./interfaces/IMezo.sol";

interface IClaimsCourtRewards {
    function notifyRewards(uint256 amount) external;
}

/// @title PolicyManager
/// @notice Sells BACKSTOP cover. Each policy is a non-transferable ERC-721 bound to the buyer.
/// Premiums are paid in MUSD and split between the underwriting pool, the claims court's
/// assessor rewards and the treasury. Policies bound to a Mezo position (a veBTC lock or a
/// MUSD trove) can never insure more than that position is worth at MUSD's own oracle price.
/// Every claim is decided by veMEZO assessors in the ClaimsCourt.
/// @dev The owner curates products and can pause new sales. The owner cannot move funds,
/// change an existing policy, or approve a claim.
contract PolicyManager is ERC721, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    enum PositionKind {
        NONE, // any holder; insurable interest judged by assessors from evidence
        VEBTC, // positionId is a veBTC tokenId owned by the buyer
        TROVE // the buyer's own MUSD trove (positionId must be 0)
    }

    enum Status {
        NONE,
        ACTIVE,
        CLAIMED,
        EXPIRED
    }

    struct Product {
        string name;
        string coveredUri; // what is covered: contracts, docs, terms
        uint16 annualRateBps;
        PositionKind kind;
        bool active;
        uint128 capacity;
        uint128 activeCover;
        uint128 maxCoverPerPolicy;
    }

    struct Policy {
        uint32 productId;
        Status status;
        bool claimOpen;
        uint8 claimsFiled;
        uint8 freeRetries;
        uint64 start;
        uint64 end;
        uint128 cover;
        uint128 premium;
        uint256 positionId;
        address holder;
    }

    uint256 public constant MIN_COVER = 10e18;
    uint256 public constant MIN_DURATION = 7 days;
    uint256 public constant MAX_DURATION = 365 days;
    /// @notice Assessed claims may be filed this long after a policy ends, for incidents that
    /// happened while it was active.
    uint256 public constant CLAIM_GRACE = 14 days;
    uint8 public constant MAX_CLAIMS_PER_POLICY = 2;
    /// @notice Votes that fail for lack of quorum do not count against MAX_CLAIMS_PER_POLICY, up to
    /// this many times per policy, so a claimant cannot re-roll indefinitely.
    uint8 public constant MAX_FREE_RETRIES = 2;
    uint256 public constant PROTOCOL_FEE_BPS = 1_000;
    uint256 public constant ASSESSOR_SHARE_BPS = 500;
    uint256 public constant MAX_RATE_BPS = 5_000;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    BackstopPool public immutable pool;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IVotingEscrow public immutable veBTC;

    address public court;
    address public treasury;

    Product[] private _products;
    mapping(uint256 policyId => Policy) private _policies;
    uint256 public nextPolicyId = 1;

    /// @notice Cover outstanding per insured position (veBTC id, or trove owner), summed across
    /// every product, so one position can never be insured for more than it is worth in total.
    mapping(bytes32 positionKey => uint256) public insured;

    event ProductAdded(uint256 indexed productId, string name, PositionKind kind);
    event ProductUpdated(uint256 indexed productId, uint16 annualRateBps, uint128 capacity, uint128 maxCoverPerPolicy, bool active);
    event TreasurySet(address indexed treasury);
    event CourtSet(address indexed court);
    event PolicyBought(
        uint256 indexed policyId,
        address indexed holder,
        uint256 indexed productId,
        uint256 cover,
        uint256 premium,
        uint256 start,
        uint256 end,
        uint256 positionId
    );
    event PolicyExpired(uint256 indexed policyId);
    event ClaimOpened(uint256 indexed policyId);
    event ClaimClosed(uint256 indexed policyId, bool counted);
    event PolicyPaid(uint256 indexed policyId, address indexed holder, uint256 amount);

    error ZeroAddress();
    error AlreadySet();
    error NotCourt();
    error UnknownProduct();
    error ProductInactive();
    error BadRate();
    error BadCover();
    error BadDuration();
    error CapacityExceeded();
    error NotPositionOwner();
    error EmptyPosition();
    error ExceedsPositionValue(uint256 requested, uint256 available);
    error BadPositionId();
    error PolicyNotActive();
    error ClaimAlreadyOpen();
    error TooManyClaims();
    error ClaimWindowOpen();
    error PremiumTooHigh(uint256 premium, uint256 maxPremium);
    error ZeroPremium();
    error CourtNotSet();
    error BadAmount();
    error PriceUnavailable();
    error LockEndsBeforePolicy();
    error RenounceDisabled();
    error Soulbound();

    modifier onlyCourt() {
        if (msg.sender != court) revert NotCourt();
        _;
    }

    constructor(
        address owner_,
        IERC20 musd_,
        BackstopPool pool_,
        ITroveManager troveManager_,
        IPriceFeed priceFeed_,
        IVotingEscrow veBTC_,
        address treasury_
    ) ERC721("BACKSTOP Policy", "BKSP") Ownable(owner_) {
        if (
            address(musd_) == address(0) || address(pool_) == address(0)
                || address(troveManager_) == address(0) || address(priceFeed_) == address(0)
                || address(veBTC_) == address(0) || treasury_ == address(0)
        ) revert ZeroAddress();
        musd = musd_;
        pool = pool_;
        troveManager = troveManager_;
        priceFeed = priceFeed_;
        veBTC = veBTC_;
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    // ---------------------------------------------------------------------
    // Admin: curation only
    // ---------------------------------------------------------------------

    /// @notice One-time wiring of the ClaimsCourt.
    function setCourt(address court_) external onlyOwner {
        if (court != address(0)) revert AlreadySet();
        if (court_ == address(0)) revert ZeroAddress();
        court = court_;
        emit CourtSet(court_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function addProduct(
        string calldata name,
        string calldata coveredUri,
        uint16 annualRateBps,
        PositionKind kind,
        uint128 capacity,
        uint128 maxCoverPerPolicy
    ) external onlyOwner returns (uint256 productId) {
        if (annualRateBps == 0 || annualRateBps > MAX_RATE_BPS) revert BadRate();
        if (maxCoverPerPolicy < MIN_COVER || capacity < maxCoverPerPolicy) revert BadCover();
        productId = _products.length;
        _products.push(
            Product({
                name: name,
                coveredUri: coveredUri,
                annualRateBps: annualRateBps,
                kind: kind,
                active: true,
                capacity: capacity,
                activeCover: 0,
                maxCoverPerPolicy: maxCoverPerPolicy
            })
        );
        emit ProductAdded(productId, name, kind);
        emit ProductUpdated(productId, annualRateBps, capacity, maxCoverPerPolicy, true);
    }

    /// @notice Changes apply to new policies only; existing policies keep their terms.
    function updateProduct(
        uint256 productId,
        uint16 annualRateBps,
        uint128 capacity,
        uint128 maxCoverPerPolicy,
        bool active
    ) external onlyOwner {
        Product storage p = _product(productId);
        if (annualRateBps == 0 || annualRateBps > MAX_RATE_BPS) revert BadRate();
        if (maxCoverPerPolicy < MIN_COVER || capacity < maxCoverPerPolicy) revert BadCover();
        p.annualRateBps = annualRateBps;
        p.capacity = capacity;
        p.maxCoverPerPolicy = maxCoverPerPolicy;
        p.active = active;
        emit ProductUpdated(productId, annualRateBps, capacity, maxCoverPerPolicy, active);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Buying cover
    // ---------------------------------------------------------------------

    /// @notice Premium for `cover` MUSD over `duration` seconds, rounded up.
    function quote(uint256 productId, uint256 cover, uint256 duration) public view returns (uint256) {
        Product storage p = _product(productId);
        uint256 base = Math.mulDiv(cover, uint256(p.annualRateBps) * duration, BPS * 365 days, Math.Rounding.Ceil);
        return Math.mulDiv(base, utilizationMultiplierBps(cover), BPS, Math.Rounding.Ceil);
    }

    /// @notice Premium multiplier from pool utilization: the average of 1 + 4u^2 over the
    /// utilization this purchase moves the pool through, from u0 (before) to u1 (after). That is
    /// 1 + 4(u0^2 + u0*u1 + u1^2)/3: 1x on an idle pool, 5x at the margin of a full one, and the
    /// same total whether cover is bought at once or in pieces.
    function utilizationMultiplierBps(uint256 cover) public view returns (uint256) {
        uint256 assets = pool.totalAssets();
        uint256 active = pool.activeCover();
        uint256 u0 = assets == 0 ? BPS : Math.min(BPS, Math.mulDiv(active, BPS, assets));
        uint256 u1 = assets == 0 ? BPS : Math.min(BPS, Math.mulDiv(active + cover, BPS, assets));
        return BPS + Math.mulDiv(4, u0 * u0 + u0 * u1 + u1 * u1, 3 * BPS);
    }

    /// @notice MUSD value of a position at MUSD's PriceFeed, minus cover already sold on that
    /// position across every product. Returns type(uint256).max for products not bound to a
    /// position.
    function insurableValue(uint256 productId, address holder, uint256 positionId)
        public
        view
        returns (uint256)
    {
        Product storage p = _product(productId);
        if (p.kind == PositionKind.NONE) return type(uint256).max;
        uint256 value = _positionValue(p.kind, holder, positionId, 0);
        uint256 already = insured[_positionKey(p.kind, holder, positionId)];
        return value > already ? value - already : 0;
    }

    /// @notice Buy `cover` MUSD of cover on a product for `duration` seconds. `positionId` is the
    /// veBTC token id for veBTC products and 0 otherwise. Reverts if the premium (see quote) is
    /// above `maxPremium`, which protects against pool utilization moving before inclusion.
    function buy(uint256 productId, uint256 cover, uint256 duration, uint256 positionId, uint256 maxPremium)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 policyId)
    {
        if (court == address(0)) revert CourtNotSet();
        Product storage p = _product(productId);
        if (!p.active) revert ProductInactive();
        if (cover < MIN_COVER || cover > p.maxCoverPerPolicy) revert BadCover();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert BadDuration();
        if (uint256(p.activeCover) + cover > p.capacity) revert CapacityExceeded();

        _recordInsurableInterest(p.kind, positionId, cover, duration);

        uint256 premium = quote(productId, cover, duration);
        if (premium == 0) revert ZeroPremium();
        if (premium > maxPremium) revert PremiumTooHigh(premium, maxPremium);

        policyId = _createPolicy(productId, cover, duration, positionId, premium);
        p.activeCover += SafeCast.toUint128(cover);

        // Effects done; now move premium. The pool checks free capital before locking cover.
        _distributePremium(premium);
        pool.lockCover(cover);

        _safeMint(msg.sender, policyId);
    }

    function _recordInsurableInterest(
        PositionKind kind,
        uint256 positionId,
        uint256 cover,
        uint256 duration
    ) internal {
        if (kind == PositionKind.NONE) {
            if (positionId != 0) revert BadPositionId();
            return;
        }
        bytes32 key = _positionKey(kind, msg.sender, positionId);
        uint256 value = _positionValue(kind, msg.sender, positionId, block.timestamp + duration);
        uint256 already = insured[key];
        uint256 available = value > already ? value - already : 0;
        if (cover > available) revert ExceedsPositionValue(cover, available);
        insured[key] = already + cover;
    }

    function _createPolicy(
        uint256 productId,
        uint256 cover,
        uint256 duration,
        uint256 positionId,
        uint256 premium
    ) internal returns (uint256 policyId) {
        policyId = nextPolicyId++;
        uint64 start = SafeCast.toUint64(block.timestamp);
        uint64 end = SafeCast.toUint64(block.timestamp + duration);
        _policies[policyId] = Policy({
            productId: SafeCast.toUint32(productId),
            status: Status.ACTIVE,
            claimOpen: false,
            claimsFiled: 0,
            freeRetries: 0,
            start: start,
            end: end,
            cover: SafeCast.toUint128(cover),
            premium: SafeCast.toUint128(premium),
            positionId: positionId,
            holder: msg.sender
        });
        emit PolicyBought(policyId, msg.sender, productId, cover, premium, start, end, positionId);
    }

    function _distributePremium(uint256 premium) internal {
        musd.safeTransferFrom(msg.sender, address(this), premium);
        uint256 fee = Math.mulDiv(premium, PROTOCOL_FEE_BPS, BPS);
        uint256 assessorCut = Math.mulDiv(premium, ASSESSOR_SHARE_BPS, BPS);
        uint256 toPool = premium - fee - assessorCut;

        musd.safeTransfer(treasury, fee);
        musd.safeTransfer(court, assessorCut);
        IClaimsCourtRewards(court).notifyRewards(assessorCut);
        musd.safeTransfer(address(pool), toPool);
        pool.notifyPremium(toPool);
    }

    /// @notice Release cover on a policy that ended and whose claim window closed. Permissionless.
    function expire(uint256 policyId) external nonReentrant {
        Policy storage pol = _activePolicy(policyId);
        if (pol.claimOpen || block.timestamp <= uint256(pol.end) + CLAIM_GRACE) revert ClaimWindowOpen();
        pol.status = Status.EXPIRED;
        _release(pol);
        pool.unlockCover(pol.cover);
        emit PolicyExpired(policyId);
    }

    // ---------------------------------------------------------------------
    // ClaimsCourt hooks
    // ---------------------------------------------------------------------

    function openClaim(uint256 policyId) external onlyCourt {
        Policy storage pol = _activePolicy(policyId);
        if (pol.claimOpen) revert ClaimAlreadyOpen();
        if (pol.claimsFiled >= MAX_CLAIMS_PER_POLICY) revert TooManyClaims();
        pol.claimOpen = true;
        pol.claimsFiled += 1;
        emit ClaimOpened(policyId);
    }

    /// @param countAttempt false when the vote failed for lack of quorum: the claimant did nothing
    /// wrong, so the attempt is not counted against the two-claim limit.
    function closeClaim(uint256 policyId, bool countAttempt) external onlyCourt {
        Policy storage pol = _activePolicy(policyId);
        pol.claimOpen = false;
        bool counted = true;
        if (!countAttempt && pol.freeRetries < MAX_FREE_RETRIES) {
            pol.claimsFiled -= 1;
            pol.freeRetries += 1;
            counted = false;
        }
        emit ClaimClosed(policyId, counted);
    }

    function settleAssessedClaim(uint256 policyId, uint256 amount) external onlyCourt nonReentrant {
        Policy storage pol = _activePolicy(policyId);
        if (amount == 0 || amount > pol.cover) revert BadAmount();
        _settle(policyId, pol, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function productCount() external view returns (uint256) {
        return _products.length;
    }

    function products(uint256 productId) external view returns (Product memory) {
        return _product(productId);
    }

    function policies(uint256 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    function tokenURI(uint256 policyId) public view override returns (string memory) {
        _requireOwned(policyId);
        Policy storage pol = _policies[policyId];
        Product storage p = _products[pol.productId];
        string memory status = pol.status == Status.ACTIVE
            ? (block.timestamp > pol.end ? "ENDED" : "ACTIVE")
            : (pol.status == Status.CLAIMED ? "PAID" : "EXPIRED");
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" rx="18" fill="#0b0d0c"/>',
            '<text x="24" y="44" fill="#f5a524" font-family="monospace" font-size="20">BACKSTOP #',
            policyId.toString(),
            '</text><text x="24" y="84" fill="#e8e6df" font-family="monospace" font-size="14">',
            _escapeXml(p.name),
            '</text><text x="24" y="124" fill="#e8e6df" font-family="monospace" font-size="14">Cover ',
            (uint256(pol.cover) / 1e18).toString(),
            ' MUSD</text><text x="24" y="164" fill="#9a978d" font-family="monospace" font-size="12">Ends ',
            uint256(pol.end).toString(),
            '</text><text x="24" y="204" fill="#f5a524" font-family="monospace" font-size="14">',
            status,
            "</text></svg>"
        );
        string memory json = string.concat(
            '{"name":"BACKSTOP Policy #',
            policyId.toString(),
            '","description":"MUSD cover on Mezo. Non-transferable.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _settle(uint256 policyId, Policy storage pol, uint256 amount) internal {
        pol.status = Status.CLAIMED;
        pol.claimOpen = false;
        _release(pol);
        pool.payClaim(pol.holder, amount, pol.cover);
        emit ClaimClosed(policyId, true);
        emit PolicyPaid(policyId, pol.holder, amount);
    }

    /// @dev Removes the policy's cover from product and position accounting.
    function _release(Policy storage pol) internal {
        Product storage p = _products[pol.productId];
        p.activeCover -= pol.cover;
        if (p.kind != PositionKind.NONE) {
            bytes32 key = _positionKey(p.kind, pol.holder, pol.positionId);
            insured[key] -= pol.cover;
        }
    }

    /// @param minEnd for veBTC: the lock must be permanent or end at or after this time (0 = no check).
    function _positionValue(PositionKind kind, address holder, uint256 positionId, uint256 minEnd)
        internal
        view
        returns (uint256)
    {
        uint256 btcAmount;
        if (kind == PositionKind.VEBTC) {
            // veBTC.ownerOf returns address(0) for unknown ids instead of reverting.
            if (veBTC.ownerOf(positionId) != holder) revert NotPositionOwner();
            IVotingEscrow.LockedBalance memory l = veBTC.locked(positionId);
            if (l.amount <= 0) revert EmptyPosition();
            if (minEnd != 0 && !l.isPermanent && l.end < minEnd) revert LockEndsBeforePolicy();
            btcAmount = uint256(int256(l.amount));
        } else {
            if (positionId != 0) revert BadPositionId();
            if (troveManager.getTroveStatus(holder) != ITroveManager.Status.active) revert NotPositionOwner();
            btcAmount = troveManager.getTroveColl(holder);
            if (btcAmount == 0) revert EmptyPosition();
        }
        uint256 price = priceFeed.fetchPrice();
        if (price == 0) revert PriceUnavailable();
        return Math.mulDiv(btcAmount, price, 1e18);
    }

    /// @notice Key under which cover on a position is tracked in `insured`.
    function positionKey(PositionKind kind, address holder, uint256 positionId) external pure returns (bytes32) {
        return _positionKey(kind, holder, positionId);
    }

    /// @dev Escapes the five XML special characters for the on-chain SVG.
    function _escapeXml(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        bytes memory out;
        for (uint256 i; i < b.length; i++) {
            bytes1 ch = b[i];
            if (ch == "<") out = abi.encodePacked(out, "&lt;");
            else if (ch == ">") out = abi.encodePacked(out, "&gt;");
            else if (ch == "&") out = abi.encodePacked(out, "&amp;");
            else if (ch == '"') out = abi.encodePacked(out, "&quot;");
            else if (ch == "'") out = abi.encodePacked(out, "&apos;");
            else out = abi.encodePacked(out, ch);
        }
        return string(out);
    }

    /// @notice Ownership cannot be renounced: product curation and pausing must stay possible.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    function _positionKey(PositionKind kind, address holder, uint256 positionId)
        internal
        pure
        returns (bytes32)
    {
        return kind == PositionKind.VEBTC
            ? keccak256(abi.encode(kind, positionId))
            : keccak256(abi.encode(kind, holder));
    }

    function _product(uint256 productId) internal view returns (Product storage) {
        if (productId >= _products.length) revert UnknownProduct();
        return _products[productId];
    }

    function _activePolicy(uint256 policyId) internal view returns (Policy storage pol) {
        pol = _policies[policyId];
        if (pol.status != Status.ACTIVE) revert PolicyNotActive();
    }

    /// @dev Policies are bound to the buyer: minting and burning only, no transfers.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
