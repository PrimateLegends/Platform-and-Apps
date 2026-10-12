// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

import "./PrimatesGate.sol";

interface IRyo {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title RyoSwapPool
/// @notice $RYO <-> ETH swaps for Primate Legends holders, the on-chain version of the /swap-ryo page.
///
/// Constant-product pool (x · y = k) between ETH and $RYO:
///   - Opening price from a starting market cap: the seeder deposits ETH and $RYO in the ratio
///     `marketCap / supply`, so 1,000,000,000 $RYO at a $30,000 market cap opens at $0.00003.
///   - Liquidity can only be ADDED, never removed: there are no LP tokens and no withdraw. The team seeds the
///     pool, then the mint proceeds and the deposits counted by LiquidityVault are added at the current ratio
///     (same price, deeper pool).
///   - Swapping needs at least `minPrimates` warriors in the wallet (2 on the site), checked live.
///   - Every swap takes a minimum output (slippage) and a deadline. No fee, no owner, no pause.
///
/// The page shows the same numbers: price, price impact = amountIn / (reserveIn + amountIn),
/// minimum received = quote × (1 − slippage).
contract RyoSwapPool is PrimatesGate {
    IRyo public immutable ryo;
    /// Allowed to seed and add liquidity (the team's liquidity vault or multisig). Can't take anything out.
    address public immutable liquidityProvider;

    uint256 public reserveEth;
    uint256 public reserveRyo;
    uint256 private _lock = 1;

    event Seeded(uint256 eth, uint256 ryo);
    event LiquidityAdded(uint256 eth, uint256 ryo);
    event Swap(address indexed trader, bool ethIn, uint256 amountIn, uint256 amountOut);

    error NotProvider();
    error AlreadySeeded();
    error NotSeeded();
    error ZeroAmount();
    error Slippage(uint256 amountOut, uint256 minOut);
    error DeadlinePassed();
    error TransferFailed();
    error Reentrant();
    error UseSwap();

    constructor(address ryoToken, address primatesCollection, uint256 minimumPrimates, address provider)
        PrimatesGate(primatesCollection, minimumPrimates)
    {
        if (ryoToken == address(0) || provider == address(0)) revert ZeroAddress();
        ryo = IRyo(ryoToken);
        liquidityProvider = provider;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrant();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyProvider() {
        if (msg.sender != liquidityProvider) revert NotProvider();
        _;
    }

    modifier before(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlinePassed();
        _;
    }

    /* ---------------- liquidity (add only) ---------------- */

    /// Opens the pool: msg.value ETH against `ryoAmount` $RYO sets the starting price. Once.
    function seed(uint256 ryoAmount) external payable onlyProvider nonReentrant {
        if (reserveEth != 0) revert AlreadySeeded();
        if (msg.value == 0 || ryoAmount == 0) revert ZeroAmount();
        reserveEth = msg.value;
        reserveRyo = ryoAmount;
        _pullRyo(msg.sender, ryoAmount);
        emit Seeded(msg.value, ryoAmount);
    }

    /// Adds msg.value ETH plus $RYO at the current ratio (rounded up), so the price doesn't move.
    function addLiquidity() external payable onlyProvider nonReentrant returns (uint256 ryoAdded) {
        if (reserveEth == 0) revert NotSeeded();
        if (msg.value == 0) revert ZeroAmount();
        ryoAdded = (msg.value * reserveRyo + reserveEth - 1) / reserveEth;
        reserveEth += msg.value;
        reserveRyo += ryoAdded;
        _pullRyo(msg.sender, ryoAdded);
        emit LiquidityAdded(msg.value, ryoAdded);
    }

    /* ---------------- quotes (what the page shows) ---------------- */

    /// Output for an exact input. `ethIn` = true sells ETH for $RYO.
    function quote(uint256 amountIn, bool ethIn) public view returns (uint256 amountOut) {
        (uint256 rIn, uint256 rOut) = ethIn ? (reserveEth, reserveRyo) : (reserveRyo, reserveEth);
        if (rIn == 0 || amountIn == 0) return 0;
        amountOut = (rOut * amountIn) / (rIn + amountIn);
    }

    /// Price impact in basis points (1% = 100): amountIn / (reserveIn + amountIn).
    function priceImpactBps(uint256 amountIn, bool ethIn) external view returns (uint256) {
        uint256 rIn = ethIn ? reserveEth : reserveRyo;
        if (amountIn == 0) return 0;
        return (amountIn * 10_000) / (rIn + amountIn);
    }

    /// Spot price: $RYO per 1 ETH (18 decimals each side).
    function ryoPerEth() external view returns (uint256) {
        if (reserveEth == 0) return 0;
        return (reserveRyo * 1e18) / reserveEth;
    }

    /* ---------------- swaps (Primates holders only) ---------------- */

    function swapEthForRyo(uint256 minRyoOut, uint256 deadline)
        external payable onlyPrimatesHolders before(deadline) nonReentrant returns (uint256 out)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (reserveEth == 0) revert NotSeeded();
        out = quote(msg.value, true);
        if (out == 0 || out < minRyoOut) revert Slippage(out, minRyoOut);
        reserveEth += msg.value;
        reserveRyo -= out;
        if (!ryo.transfer(msg.sender, out)) revert TransferFailed();
        emit Swap(msg.sender, true, msg.value, out);
    }

    function swapRyoForEth(uint256 ryoIn, uint256 minEthOut, uint256 deadline)
        external onlyPrimatesHolders before(deadline) nonReentrant returns (uint256 out)
    {
        if (ryoIn == 0) revert ZeroAmount();
        if (reserveEth == 0) revert NotSeeded();
        out = quote(ryoIn, false);
        if (out == 0 || out < minEthOut) revert Slippage(out, minEthOut);
        reserveRyo += ryoIn;
        reserveEth -= out;
        _pullRyo(msg.sender, ryoIn);
        (bool ok, ) = msg.sender.call{value: out}("");
        if (!ok) revert TransferFailed();
        emit Swap(msg.sender, false, ryoIn, out);
    }

    /// Plain ETH isn't liquidity and isn't a swap: refuse it so nothing gets stuck outside the reserves.
    receive() external payable {
        revert UseSwap();
    }

    function _pullRyo(address from, uint256 amount) private {
        if (!ryo.transferFrom(from, address(this), amount)) revert TransferFailed();
    }
}
