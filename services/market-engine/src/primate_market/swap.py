"""$RYO swap quotes (the /swap-ryo page) and the secondary vault's declared liquidity.

Same math as contracts/RyoSwapPool.sol: a constant-product pool whose ETH side is the team seed plus the
mint proceeds plus every ETH deposit into the secondary vault (deposits, not the balance). Trading needs
at least MIN_PRIMATES warriors in the wallet.
"""
from __future__ import annotations

from dataclasses import dataclass

SUPPLY = 1_000_000_000
START_MCAP_USD = 30_000
MIN_PRIMATES = 2


def ryo_price_usd(mcap_usd: float = START_MCAP_USD, supply: int = SUPPLY) -> float:
    return mcap_usd / supply


@dataclass(frozen=True)
class Transfer:
    tx: str
    sender: str
    to: str
    wei: int
    failed: bool = False


def declared_deposits_wei(vault: str, transfers: list[Transfer]) -> int:
    """ETH deposits into the vault: incoming, successful, non-zero, and not inside a tx the vault sent."""
    v = vault.lower()
    sent = {t.tx for t in transfers if t.sender.lower() == v}
    return sum(t.wei for t in transfers
               if t.to.lower() == v and t.sender.lower() != v and t.tx not in sent and not t.failed and t.wei > 0)


@dataclass(frozen=True)
class Pool:
    pool_usd: float          # ETH side of the pool in USD (seed + mint + vault deposits)
    price_usd: float = ryo_price_usd()

    @property
    def ryo_reserve(self) -> float:
        return self.pool_usd / self.price_usd

    def sell_ryo(self, ryo_in: float) -> tuple[float, float]:
        """$RYO in -> (USD out, price impact)."""
        r = self.ryo_reserve
        return self.pool_usd * ryo_in / (r + ryo_in), ryo_in / (r + ryo_in)

    def buy_ryo(self, usd_in: float) -> tuple[float, float]:
        """USD (ETH or USDC) in -> ($RYO out, price impact)."""
        return self.ryo_reserve * usd_in / (self.pool_usd + usd_in), usd_in / (self.pool_usd + usd_in)


def min_received(amount_out: float, slippage: float) -> float:
    return amount_out * (1 - slippage)


def can_trade(primates_held: int) -> bool:
    return primates_held >= MIN_PRIMATES
