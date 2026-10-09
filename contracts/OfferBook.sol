// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

interface IERC20Like {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IERC1155Like {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
}

/// @title OfferBook
/// @notice $RYO offers on Legendary Cards, the on-chain version of the Pre-Market offers.
///
/// A bidder offers an amount of $RYO for one card (token id = card serial) with an expiry of 1, 3,
/// 7 or 30 days. The amount is held by this contract until the offer closes:
///   - accept:  whoever holds the card at that moment sells it; the card goes to the bidder and the
///              $RYO to the seller in the same transaction (the seller approves this contract once).
///   - cancel:  the bidder takes the $RYO back.
///   - reject:  the current holder declines; the $RYO goes back to the bidder.
///   - reclaim: after expiry anyone can send the $RYO back to the bidder.
/// An offer belongs to the card, not to the holder at offer time. One open offer per bidder and
/// card: a new one replaces the old one in the same call. No owner, no fee, no upgrade path.
contract OfferBook {
    IERC20Like public immutable ryo;
    IERC1155Like public immutable cards;

    uint256 public constant MIN_AMOUNT = 1_000 * 10 ** 18;
    uint256 public constant MAX_AMOUNT = 10_000_000 * 10 ** 18;

    enum Status { None, Open, Accepted, Cancelled, Rejected, Expired }

    struct Offer {
        address bidder;
        uint64 expiresAt;
        Status status;
        uint256 cardId;
        uint256 amount;
    }

    mapping(uint256 => Offer) public offers;
    /// keccak256(cardId, bidder) => id of the open offer (0 = none)
    mapping(bytes32 => uint256) public openOfferOf;
    uint256 public offerCount;
    uint256 private _lock = 1;

    event OfferPlaced(uint256 indexed id, uint256 indexed cardId, address indexed bidder, uint256 amount, uint64 expiresAt);
    event OfferClosed(uint256 indexed id, Status status);
    event OfferAccepted(uint256 indexed id, uint256 indexed cardId, address seller, address indexed bidder, uint256 amount);

    error BadAmount();
    error BadDuration();
    error OwnCard();
    error NotOpen();
    error NotBidder();
    error NotHolder();
    error Expired();
    error NotExpired();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(IERC20Like ryo_, IERC1155Like cards_) {
        ryo = ryo_;
        cards = cards_;
    }

    function durationAllowed(uint256 days_) public pure returns (bool) {
        return days_ == 1 || days_ == 3 || days_ == 7 || days_ == 30;
    }

    /// @notice Offers `amount` $RYO for card `cardId`, open for `days_` days. Needs a $RYO allowance.
    function placeOffer(uint256 cardId, uint256 amount, uint256 days_) external nonReentrant returns (uint256 id) {
        if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) revert BadAmount();
        if (!durationAllowed(days_)) revert BadDuration();
        if (cards.balanceOf(msg.sender, cardId) != 0) revert OwnCard();

        bytes32 key = keccak256(abi.encode(cardId, msg.sender));
        uint256 previous = openOfferOf[key];
        uint256 refund;
        if (previous != 0) {
            Offer storage old = offers[previous];
            old.status = Status.Cancelled;
            refund = old.amount;
            emit OfferClosed(previous, Status.Cancelled);
        }

        id = ++offerCount;
        uint64 expiresAt = uint64(block.timestamp + days_ * 1 days);
        offers[id] = Offer(msg.sender, expiresAt, Status.Open, cardId, amount);
        openOfferOf[key] = id;
        emit OfferPlaced(id, cardId, msg.sender, amount, expiresAt);

        // Only the difference moves when an offer is raised or lowered.
        if (amount > refund) _pull(msg.sender, amount - refund);
        else if (refund > amount) _pay(msg.sender, refund - amount);
    }

    function cancelOffer(uint256 id) external nonReentrant {
        Offer storage o = _open(id);
        if (o.bidder != msg.sender) revert NotBidder();
        _refund(id, o, Status.Cancelled);
    }

    function rejectOffer(uint256 id) external nonReentrant {
        Offer storage o = _open(id);
        if (cards.balanceOf(msg.sender, o.cardId) == 0) revert NotHolder();
        _refund(id, o, Status.Rejected);
    }

    function reclaim(uint256 id) external nonReentrant {
        Offer storage o = _open(id);
        if (block.timestamp < o.expiresAt) revert NotExpired();
        _refund(id, o, Status.Expired);
    }

    /// @notice Sells your card to the offer's bidder. This contract must be approved for your cards.
    function acceptOffer(uint256 id) external nonReentrant {
        Offer storage o = _open(id);
        if (block.timestamp >= o.expiresAt) revert Expired();
        if (cards.balanceOf(msg.sender, o.cardId) == 0) revert NotHolder();
        (address bidder, uint256 cardId, uint256 amount) = (o.bidder, o.cardId, o.amount);
        o.status = Status.Accepted;
        delete openOfferOf[keccak256(abi.encode(cardId, bidder))];
        emit OfferAccepted(id, cardId, msg.sender, bidder, amount);
        emit OfferClosed(id, Status.Accepted);
        cards.safeTransferFrom(msg.sender, bidder, cardId, 1, "");
        _pay(msg.sender, amount);
    }

    function _open(uint256 id) private view returns (Offer storage o) {
        o = offers[id];
        if (o.status != Status.Open) revert NotOpen();
    }

    function _refund(uint256 id, Offer storage o, Status status) private {
        o.status = status;
        delete openOfferOf[keccak256(abi.encode(o.cardId, o.bidder))];
        emit OfferClosed(id, status);
        _pay(o.bidder, o.amount);
    }

    function _pull(address from, uint256 amount) private {
        if (!ryo.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _pay(address to, uint256 amount) private {
        if (!ryo.transfer(to, amount)) revert TransferFailed();
    }
}
