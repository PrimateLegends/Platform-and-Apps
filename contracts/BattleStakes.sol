// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title BattleStakes — Primate Legends: Battle Cards match stakes (draft, not deployed)
/// @notice One transaction per player per match. Each player enters a match with a commitment to their 40-card
///         deck (the hash of its Legendary Cards serials) after approving this contract on LegendaryCards.
///         The match itself is played off-chain and replayed by the server (the referee). When it ends, anyone can
///         submit the referee's signed result: the winner takes half of the loser's deck. Draws move nothing.
/// @dev The stake list is chosen off-chain from the match seed (see apps/card-battles settleStake) and signed by the
///      referee; the contract only checks that it is exactly half of the loser's committed deck.
interface ILegendaryCards {
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external;
}

contract BattleStakes {
    struct Match {
        address a;
        address b;
        bytes32 deckA;
        bytes32 deckB;
        bool settled;
    }

    ILegendaryCards public immutable cards;
    address public admin;
    address public referee;
    mapping(bytes32 => Match) public matches;

    /// @dev Half of the secp256k1 group order: signatures with a larger `s` are malleable copies and are rejected.
    uint256 private constant HALF_ORDER = 57896044618658097711785492504343953926418782139537452191302581570759080747168;

    error NotAdmin();
    error ZeroAddress();
    error MatchFull();
    error AlreadyEntered();
    error NotApproved();
    error NotStarted();
    error AlreadySettled();
    error NotAPlayer();
    error BadDeck();
    error BadStake();
    error BadSignature();

    event RefereeChanged(address referee);
    event MatchEntered(bytes32 indexed matchId, address indexed player, bytes32 deckCommitment);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, address indexed loser, uint256[] stake);
    event MatchDrawn(bytes32 indexed matchId);

    constructor(address cards_, address referee_, address admin_) {
        if (cards_ == address(0) || referee_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        cards = ILegendaryCards(cards_);
        referee = referee_;
        admin = admin_;
    }

    function setReferee(address referee_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (referee_ == address(0)) revert ZeroAddress();
        referee = referee_;
        emit RefereeChanged(referee_);
    }

    /// @notice Join a match: the single transaction a player sends for it.
    /// @param deckCommitment keccak256(abi.encodePacked(serials)) of the 40 Legendary Cards serials in the deck, in order.
    function enter(bytes32 matchId, bytes32 deckCommitment) external {
        if (!cards.isApprovedForAll(msg.sender, address(this))) revert NotApproved();
        Match storage m = matches[matchId];
        if (m.a == msg.sender || m.b == msg.sender) revert AlreadyEntered();
        if (m.a == address(0)) { m.a = msg.sender; m.deckA = deckCommitment; }
        else if (m.b == address(0)) { m.b = msg.sender; m.deckB = deckCommitment; }
        else revert MatchFull();
        emit MatchEntered(matchId, msg.sender, deckCommitment);
    }

    /// @notice Settle a finished match with the referee's signature. Callable by anyone, once.
    /// @param winner the winning player, or address(0) for a draw (nothing moves).
    /// @param loserDeck the loser's full deck (must match their commitment).
    /// @param stake the cards the winner takes: exactly half of `loserDeck`, all taken from it, no repeats.
    function settle(bytes32 matchId, address winner, uint256[] calldata loserDeck, uint256[] calldata stake, bytes calldata signature) external {
        Match storage m = matches[matchId];
        if (m.b == address(0)) revert NotStarted();
        if (m.settled) revert AlreadySettled();
        bytes32 digest = resultDigest(matchId, winner, stake);
        if (_recover(digest, signature) != referee) revert BadSignature();
        m.settled = true;
        if (winner == address(0)) { emit MatchDrawn(matchId); return; }
        if (winner != m.a && winner != m.b) revert NotAPlayer();
        (address loser, bytes32 commitment) = winner == m.a ? (m.b, m.deckB) : (m.a, m.deckA);
        if (keccak256(abi.encodePacked(loserDeck)) != commitment) revert BadDeck();
        if (stake.length * 2 != loserDeck.length) revert BadStake();
        uint256[] memory values = new uint256[](stake.length);
        for (uint256 i = 0; i < stake.length; i++) {
            bool found;
            for (uint256 j = 0; j < loserDeck.length; j++) if (loserDeck[j] == stake[i]) { found = true; break; }
            for (uint256 k = 0; k < i; k++) if (stake[k] == stake[i]) revert BadStake();
            if (!found) revert BadStake();
            values[i] = 1;
        }
        cards.safeBatchTransferFrom(loser, winner, stake, values, "");
        emit MatchSettled(matchId, winner, loser, stake);
    }

    /// @notice The message the referee signs (EIP-191 personal message of this hash).
    function resultDigest(bytes32 matchId, address winner, uint256[] calldata stake) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, matchId, winner, keccak256(abi.encodePacked(stake))));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // reject malleable signatures (upper-half s)
        if (uint256(s) > HALF_ORDER) revert BadSignature();
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address signer = ecrecover(ethHash, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
