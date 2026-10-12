# $RYO swap

The `/swap-ryo` page prices $RYO against **ETH on Ethereum mainnet** and **USDC on Solana**, both ways.
Trading is open to **holders of at least 2 Primate Legends warriors**. The Primates collection isn't live
yet, so the page quotes trades but no wallet passes the holder check today.

The on-chain version is [`contracts/RyoSwapPool.sol`](../contracts/RyoSwapPool.sol), with the holder rule in
[`contracts/PrimatesGate.sol`](../contracts/PrimatesGate.sol) and the secondary vault in
[`contracts/LiquidityVault.sol`](../contracts/LiquidityVault.sol). The same math in Python lives in
[`services/market-engine`](../services/market-engine/) (`primate_market.swap`).

## Price

| | |
| --- | --- |
| Supply | 1,000,000,000 $RYO (fixed, see `RyoToken.sol`) |
| Starting market cap | $30,000 |
| Starting price | $30,000 / 1,000,000,000 = **$0.00003** per $RYO |

## Pool

A constant-product pool (x · y = k). Its ETH side, in USD, is the declared liquidity:

```
pool liquidity = team seed ($8,000) + mint proceeds + every ETH deposit into the secondary vault
```

- Liquidity is added at the current ratio, so it deepens the pool without moving the price.
- Liquidity is **never removed**: the contract has no LP tokens and no withdraw.
- The **secondary vault** counts **deposits, not its balance**. The team later moves that ETH on, into the
  Ethereum pool or across to Solana to build liquidity there, and the deposits keep counting.
  Deposits are ETH on Ethereum mainnet only. ETH that comes back inside a transaction the vault sent itself
  (a refund, change from a swap) is not a deposit. The live site reads the vault's history from Etherscan.

## Quotes

For an exact input `in` against reserves `R_in` / `R_out`:

```
out           = R_out · in / (R_in + in)
price impact  = in / (R_in + in)
minimum out   = out · (1 − slippage)        slippage: 0.3%, 0.5% (default), 1% or 3%
```

No fee. Every on-chain swap carries the minimum output and a deadline, and reverts if either fails.

## Holder rule

`PrimatesGate` reads `balanceOf` on the Primates collection at the moment of the call: 2 or more warriors
and the swap goes through, fewer and it reverts with `NotEnoughPrimates(held, needed)`. Nothing is cached or
signed off-chain, so moving warriors away closes access right away.
