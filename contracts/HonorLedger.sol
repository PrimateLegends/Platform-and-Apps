// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title HonorLedger
/// @notice Seasonal Honor points for Primate Legends: Card Battles.
/// Matches are played off-chain and replayed by the game server from their seed and actions.
/// At the end of each season the server commits one Merkle root holding every player's final
/// Honor. Anyone can then prove a player's total on-chain, and the player can claim it once
/// into a permanent, non-transferable balance.
contract HonorLedger {
    struct Season {
        bytes32 root;        // Merkle root of keccak256(abi.encodePacked(player, honor))
        uint64 closedAt;     // block timestamp when the season was committed
        string uri;          // public file with every leaf, so anyone can rebuild the tree
    }

    address public immutable gameServer;
    uint256 public seasonCount;
    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public lifetimeHonor;

    event SeasonCommitted(uint256 indexed season, bytes32 root, string uri);
    event HonorClaimed(uint256 indexed season, address indexed player, uint256 honor);

    error NotGameServer();
    error UnknownSeason();
    error AlreadyClaimed();
    error InvalidProof();

    constructor(address server) {
        gameServer = server;
    }

    /// @notice Closes a season. Seasons are append-only: a committed root can never change.
    function commitSeason(bytes32 root, string calldata uri) external returns (uint256 season) {
        if (msg.sender != gameServer) revert NotGameServer();
        season = ++seasonCount;
        seasons[season] = Season(root, uint64(block.timestamp), uri);
        emit SeasonCommitted(season, root, uri);
    }

    /// @notice Adds a season's Honor to the caller's lifetime balance (once per season).
    function claim(uint256 season, uint256 honor, bytes32[] calldata proof) external {
        Season storage s = seasons[season];
        if (s.root == bytes32(0)) revert UnknownSeason();
        if (claimed[season][msg.sender]) revert AlreadyClaimed();
        if (!verify(s.root, keccak256(abi.encodePacked(msg.sender, honor)), proof)) revert InvalidProof();
        claimed[season][msg.sender] = true;
        lifetimeHonor[msg.sender] += honor;
        emit HonorClaimed(season, msg.sender, honor);
    }

    /// @notice True when `leaf` is in the tree with this `root` (sorted-pair hashing).
    function verify(bytes32 root, bytes32 leaf, bytes32[] calldata proof) public pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            hash = hash < p ? keccak256(abi.encodePacked(hash, p)) : keccak256(abi.encodePacked(p, hash));
        }
        return hash == root;
    }
}
