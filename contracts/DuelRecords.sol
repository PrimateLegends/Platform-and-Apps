// SPDX-License-Identifier: UNLICENSED
// DRAFT - not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title DuelRecords
/// @notice Katana Master duel results, written once each and only with the referee's signature.
///
/// The referee is the server that replays both players' input logs (services/duel-referee); the result it signs is
/// the one that counts, whatever a client showed on screen. A record holds the two players, the winner (or a draw),
/// the rounds each side won and the 32-bit replay hash, so anyone holding the logs can replay the duel and check it.
/// Anyone may submit a signed record (usually the winner); a match id can only ever be recorded once, and a
/// signature is bound to this contract and chain. Win/loss/draw counts per player are kept on-chain for rankings.
contract DuelRecords {
    uint8 public constant DRAW = 2;
    // secp256k1 group order / 2: (n - 1) / 2 with n = 2^256 - 432420386565659656852420866390673177327
    uint256 private constant HALF_ORDER = (2**256 - 432420386565659656852420866390673177327 - 1) / 2;

    address public immutable referee;

    struct Result {
        address p0;
        address p1;
        uint8 winner;      // 0 = p0, 1 = p1, 2 = draw
        uint8 wins0;
        uint8 wins1;
        uint32 replayHash;
        uint64 recordedAt;
    }

    struct Tally { uint32 wins; uint32 losses; uint32 draws; }

    mapping(bytes32 => Result) private results;
    mapping(address => Tally) public tally;

    event DuelRecorded(bytes32 indexed matchId, address indexed p0, address indexed p1, uint8 winner, uint8 wins0, uint8 wins1, uint32 replayHash);

    error ZeroAddress();
    error SamePlayer();
    error BadResult();
    error AlreadyRecorded(bytes32 matchId);
    error BadSignature();

    constructor(address referee_) {
        if (referee_ == address(0)) revert ZeroAddress();
        referee = referee_;
    }

    /// @notice What the referee signs (EIP-191 personal message over this digest).
    function resultDigest(bytes32 matchId, address p0, address p1, uint8 winner, uint8 wins0, uint8 wins1, uint32 replayHash)
        public view returns (bytes32)
    {
        return keccak256(abi.encode(address(this), block.chainid, matchId, p0, p1, winner, wins0, wins1, replayHash));
    }

    function record(bytes32 matchId, address p0, address p1, uint8 winner, uint8 wins0, uint8 wins1, uint32 replayHash, bytes calldata sig)
        external
    {
        if (p0 == address(0) || p1 == address(0)) revert ZeroAddress();
        if (p0 == p1) revert SamePlayer();
        // best of three: a winner has 2 round wins and more than the loser; a draw has equal round wins
        if (winner > DRAW || wins0 > 2 || wins1 > 2) revert BadResult();
        if (winner == 0 && !(wins0 == 2 && wins1 < 2)) revert BadResult();
        if (winner == 1 && !(wins1 == 2 && wins0 < 2)) revert BadResult();
        if (winner == DRAW && wins0 != wins1) revert BadResult();
        if (results[matchId].p0 != address(0)) revert AlreadyRecorded(matchId);   // p0 is never zero in a record
        if (_recover(resultDigest(matchId, p0, p1, winner, wins0, wins1, replayHash), sig) != referee) revert BadSignature();

        results[matchId] = Result(p0, p1, winner, wins0, wins1, replayHash, uint64(block.timestamp));
        if (winner == DRAW) { tally[p0].draws++; tally[p1].draws++; }
        else if (winner == 0) { tally[p0].wins++; tally[p1].losses++; }
        else { tally[p1].wins++; tally[p0].losses++; }
        emit DuelRecorded(matchId, p0, p1, winner, wins0, wins1, replayHash);
    }

    function resultOf(bytes32 matchId) external view returns (Result memory) {
        return results[matchId];
    }

    /// @dev 65-byte signatures with a low s only, so a signature can't be reshaped into a second valid one.
    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (uint256(s) > HALF_ORDER) revert BadSignature();
        if (v != 27 && v != 28) revert BadSignature();
        address signer = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)), v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
