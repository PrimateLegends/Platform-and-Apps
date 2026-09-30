// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title PreMarketSettlement
/// @notice Optional one-transaction checkout for ETH listings on the Pre-Market.
///
/// Today a buyer pays the seller directly with a plain transfer (the marketplace fee is 0%).
/// If a fee is ever switched on, this contract lets the buyer still sign ONE transaction: it
/// forwards the seller's share and the fee in the same call and keeps nothing. There is no owner,
/// no withdraw function and no upgrade path; the fee and the vault are fixed at deployment and can
/// be read on Etherscan by anyone.
///
/// The game server watches the Settled event: listing id + buyer + amounts tell it which card to
/// move to which profile. A listing can only be settled once, so paying twice by mistake reverts
/// instead of losing funds.
contract PreMarketSettlement {
    uint16 public constant MAX_FEE_BPS = 1_000;   // 10% hard ceiling
    uint16 public immutable feeBps;               // e.g. 0 = free, 690 = 6.9%
    address payable public immutable vault;       // receives the fee (unused while feeBps == 0)

    mapping(bytes32 => bool) public settled;

    uint256 private _lock = 1;

    event Settled(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);

    error FeeTooHigh();
    error ZeroAddress();
    error NothingPaid();
    error AlreadySettled();
    error TransferFailed();
    error Reentrancy();

    constructor(uint16 feeBps_, address payable vault_) {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (feeBps_ > 0 && vault_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        vault = vault_;
    }

    /// @notice Share of `price` that goes to the vault. Rounded down, in the seller's favor.
    function feeFor(uint256 price) public view returns (uint256) {
        return (price * feeBps) / 10_000;
    }

    /// @notice Pays a listing: the seller gets price - fee, the vault gets the fee, all in one call.
    /// @param listingId Pre-Market listing id (keccak256 of the server's listing id).
    function buy(bytes32 listingId, address payable seller) external payable {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        if (msg.value == 0) revert NothingPaid();
        if (seller == address(0)) revert ZeroAddress();
        if (settled[listingId]) revert AlreadySettled();
        settled[listingId] = true;

        uint256 fee = feeFor(msg.value);
        uint256 toSeller = msg.value - fee;

        (bool ok, ) = seller.call{ value: toSeller }("");
        if (!ok) revert TransferFailed();
        if (fee > 0) {
            (ok, ) = vault.call{ value: fee }("");
            if (!ok) revert TransferFailed();
        }
        emit Settled(listingId, msg.sender, seller, msg.value, fee);
        _lock = 1;
    }

    /// @dev Plain ETH sent here by mistake is refused, so nothing can ever get stuck in the contract.
    receive() external payable {
        revert NothingPaid();
    }
}
