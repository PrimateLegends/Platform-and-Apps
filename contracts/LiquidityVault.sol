// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title LiquidityVault
/// @notice Secondary vault whose ETH deposits count as $RYO pool liquidity.
///
/// The /swap-ryo page declares pool liquidity as: team seed + mint proceeds + every ETH deposit into this
/// vault. It counts DEPOSITS, not the balance: the keeper later moves the ETH on (to the team's liquidity
/// provider that adds it to RyoSwapPool with the matching $RYO, or to a bridge to build liquidity on Solana)
/// and the deposits still count.
///
///   - Anyone can deposit by sending ETH. `totalDeposited` and `depositCount` only go up.
///   - ETH that comes back during the vault's own `forward` call (a refund or a swap) is not a deposit,
///     the same rule the site applies to transactions the vault sent itself.
///   - Only the keeper can forward ETH out, and every forward is logged with its purpose.
///   - ETH only: tokens sent here are not counted.
contract LiquidityVault {
    address public immutable keeper;

    uint256 public totalDeposited;
    uint256 public depositCount;
    uint256 public totalForwarded;
    bool private _forwarding;

    event Deposited(address indexed from, uint256 amount, uint256 totalDeposited);
    event Forwarded(address indexed to, uint256 amount, bytes32 indexed purpose);

    error ZeroAddress();
    error NotKeeper();
    error ZeroAmount();
    error ForwardFailed();
    error Reentrant();

    constructor(address keeper_) {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
    }

    receive() external payable {
        if (_forwarding) return;   // change from our own forward: not a deposit
        if (msg.value == 0) revert ZeroAmount();
        totalDeposited += msg.value;
        depositCount += 1;
        emit Deposited(msg.sender, msg.value, totalDeposited);
    }

    /// Moves ETH out (to the liquidity provider, a bridge…), optionally with calldata for the receiving contract.
    /// `purpose` is a short label for the log, e.g. "pool" or "solana-bridge".
    function forward(address to, uint256 amount, bytes calldata data, bytes32 purpose) external {
        if (msg.sender != keeper) revert NotKeeper();
        if (_forwarding) revert Reentrant();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _forwarding = true;
        totalForwarded += amount;
        (bool ok, ) = to.call{value: amount}(data);
        _forwarding = false;
        if (!ok) revert ForwardFailed();
        emit Forwarded(to, amount, purpose);
    }

    /// Declared liquidity coming from this vault: every deposit ever, whatever happened to the ETH after.
    function declaredLiquidity() external view returns (uint256) {
        return totalDeposited;
    }
}
