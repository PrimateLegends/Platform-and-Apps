// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

interface ICards1155 {
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external;
}

interface IRyo {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title CardCourier
/// @notice External card transfers once the cards are on-chain: one transaction sends up to MAX_CARDS Legendary
/// Cards to any address and pays a flat $RYO fee per card to the vault. It is the on-chain twin of the Pre-Market
/// "Internal transfer" (same fee, same per-transfer cap).
///
/// The sender approves this contract once on both tokens (setApprovalForAll on the cards, approve on $RYO).
/// The courier never holds cards or $RYO: both move straight from the sender. No owner, no pause; the fee, the
/// vault and the token addresses are fixed at deployment.
contract CardCourier {
    uint256 public constant MAX_CARDS = 20;

    ICards1155 public immutable cards;
    IRyo public immutable ryo;
    address public immutable vault;
    uint256 public immutable feePerCard;   // in $RYO base units (18 decimals)

    event CardsSent(address indexed from, address indexed to, uint256[] ids, uint256 fee);

    error ZeroAddress();
    error NoCards();
    error TooManyCards(uint256 count, uint256 max);
    error SelfTransfer();
    error FeeFailed();

    constructor(address cards_, address ryo_, address vault_, uint256 feePerCard_) {
        if (cards_ == address(0) || ryo_ == address(0) || vault_ == address(0)) revert ZeroAddress();
        cards = ICards1155(cards_);
        ryo = IRyo(ryo_);
        vault = vault_;
        feePerCard = feePerCard_;
    }

    /// @notice Fee for sending `count` cards.
    function feeFor(uint256 count) public view returns (uint256) {
        return count * feePerCard;
    }

    /// @notice Sends one copy of each card in `ids` from the caller to `to`, charging the fee first.
    function send(address to, uint256[] calldata ids) external {
        if (to == address(0)) revert ZeroAddress();
        if (to == msg.sender) revert SelfTransfer();
        uint256 n = ids.length;
        if (n == 0) revert NoCards();
        if (n > MAX_CARDS) revert TooManyCards(n, MAX_CARDS);

        uint256 fee = feeFor(n);
        if (fee > 0 && !ryo.transferFrom(msg.sender, vault, fee)) revert FeeFailed();

        uint256[] memory ones = new uint256[](n);
        for (uint256 i = 0; i < n; i++) ones[i] = 1;
        // reverts (and undoes the fee) if the caller doesn't own a card or hasn't approved the courier
        cards.safeBatchTransferFrom(msg.sender, to, ids, ones, "");
        emit CardsSent(msg.sender, to, ids, fee);
    }
}
