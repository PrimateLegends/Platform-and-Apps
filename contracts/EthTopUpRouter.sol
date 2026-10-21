// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title EthTopUpRouter
/// @notice On-chain side of "Pay the rest with ETH": a buyer short of $RYO for a Pre-Market card pays the missing part
/// in ETH. The platform quotes the payment (signed by its quote signer: buyer, quote id, minimum ETH, expiry), the
/// buyer calls pay() with the ETH, and the router forwards it to the vault in the same transaction and emits TopUp.
/// The platform credits the buyer $RYO from that event: msg.value / WEI_PER_RYO (an overpay is credited too).
///
/// Every quote pays once; expired, foreign (another buyer) or under-funded quotes revert, so nothing reaches the
/// vault. The router never keeps ETH. The owner can rotate the quote signer; the vault and the rate are fixed.
contract EthTopUpRouter {
    uint256 public constant WEI_PER_RYO = 98_000_000_000;        // 100,000 $RYO = 0.0098 ETH
    uint256 public constant MIN_PAYMENT = 450_000_000_000_000;   // 0.00045 ETH
    uint256 private constant HALF_ORDER = 57896044618658097711785492504343953926418782139537452191302581570759080747168;

    address public immutable vault;
    address public owner;
    address public quoteSigner;
    mapping(bytes32 => bool) public used;

    event TopUp(address indexed buyer, bytes32 indexed quoteId, uint256 paid, uint256 ryoCredit);
    event QuoteSignerChanged(address signer);

    error ZeroAddress();
    error NotOwner();
    error Expired();
    error QuoteUsed();
    error Underpaid(uint256 sent, uint256 quoted);
    error BelowMinimum();
    error BadSignature();
    error ForwardFailed();

    constructor(address vault_, address quoteSigner_, address owner_) {
        if (vault_ == address(0) || quoteSigner_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        vault = vault_;
        quoteSigner = quoteSigner_;
        owner = owner_;
    }

    /// @notice The hash the quote signer signs (EIP-191 personal message of it).
    function quoteDigest(address buyer, bytes32 quoteId, uint256 minWei, uint64 expires) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, buyer, quoteId, minWei, expires));
    }

    /// @notice $RYO the platform credits for `paid` wei.
    function creditFor(uint256 paid) public pure returns (uint256) {
        return paid / WEI_PER_RYO;
    }

    /// @notice Pays a quote: the ETH goes straight to the vault.
    function pay(bytes32 quoteId, uint256 minWei, uint64 expires, bytes calldata signature) external payable {
        if (block.timestamp > expires) revert Expired();
        if (used[quoteId]) revert QuoteUsed();
        if (minWei < MIN_PAYMENT || msg.value < MIN_PAYMENT) revert BelowMinimum();
        if (msg.value < minWei) revert Underpaid(msg.value, minWei);
        if (_recover(quoteDigest(msg.sender, quoteId, minWei, expires), signature) != quoteSigner) revert BadSignature();
        used[quoteId] = true;
        (bool ok, ) = vault.call{value: msg.value}("");
        if (!ok) revert ForwardFailed();
        emit TopUp(msg.sender, quoteId, msg.value, creditFor(msg.value));
    }

    function setQuoteSigner(address signer) external {
        if (msg.sender != owner) revert NotOwner();
        if (signer == address(0)) revert ZeroAddress();
        quoteSigner = signer;
        emit QuoteSignerChanged(signer);
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (uint256(s) > HALF_ORDER) revert BadSignature();   // no malleable twins
        address signer = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)), v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
