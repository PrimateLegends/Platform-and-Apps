// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title CollectorBoost
/// @notice On-chain record of Collector Boost claims. A player who holds an NFT of a partner collection claims its
/// boost once; the contract checks balanceOf at claim time and records it. The XP itself lives off-chain: the game
/// reads BoostClaimed (collection + bps) and adds bps / 10_000 of the player's earned XP at that moment.
///
/// Nothing is automatic: the player decides when to claim (more XP earned first = a bigger boost). The owner manages
/// the partner list; removing a partner never erases past claims.
contract CollectorBoost {
    uint16 public constant DEFAULT_BPS = 2_500;   // +25%
    uint16 public constant MAX_BPS = 10_000;

    address public owner;
    mapping(address => uint16) public boostBps;                       // collection -> bps (0 = not a partner)
    mapping(address => mapping(address => bool)) public claimed;     // player -> collection -> claimed

    event PartnerSet(address indexed collection, uint16 bps);
    event BoostClaimed(address indexed player, address indexed collection, uint16 bps);

    error NotOwner();
    error ZeroAddress();
    error BadBps();
    error NotAPartner(address collection);
    error AlreadyClaimed(address collection);
    error NotHeld(address collection);
    error NothingToClaim();

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
    }

    /// @notice Adds, updates (bps > 0) or removes (bps = 0) a partner collection.
    function setPartner(address collection, uint16 bps) external {
        if (msg.sender != owner) revert NotOwner();
        if (collection == address(0)) revert ZeroAddress();
        if (bps > MAX_BPS) revert BadBps();
        boostBps[collection] = bps;
        emit PartnerSet(collection, bps);
    }

    /// @notice Claims every listed collection the caller holds and hasn't claimed. Reverts if none qualifies.
    /// A collection the caller doesn't hold (or already claimed) is skipped, so one call can try them all.
    function claim(address[] calldata collections) external returns (uint256 count) {
        for (uint256 i = 0; i < collections.length; i++) {
            address c = collections[i];
            uint16 bps = boostBps[c];
            if (bps == 0 || claimed[msg.sender][c]) continue;
            if (IERC721Balance(c).balanceOf(msg.sender) == 0) continue;
            claimed[msg.sender][c] = true;
            count++;
            emit BoostClaimed(msg.sender, c, bps);
        }
        if (count == 0) revert NothingToClaim();
    }

    /// @notice Strict single claim with a reason on failure.
    function claimOne(address collection) external {
        uint16 bps = boostBps[collection];
        if (bps == 0) revert NotAPartner(collection);
        if (claimed[msg.sender][collection]) revert AlreadyClaimed(collection);
        if (IERC721Balance(collection).balanceOf(msg.sender) == 0) revert NotHeld(collection);
        claimed[msg.sender][collection] = true;
        emit BoostClaimed(msg.sender, collection, bps);
    }
}
