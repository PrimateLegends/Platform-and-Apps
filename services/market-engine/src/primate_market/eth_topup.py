"""Pay the rest of a $RYO purchase with ETH.

The buyer's $RYO must cover at least MIN_OWN_SHARE_PCT of the price. The missing part is paid in ETH to the platform
vault at WEI_PER_RYO; once the payment has CONFIRMATIONS blocks, the buyer is credited the $RYO for what they paid
and the ordinary purchase runs. The listing is held for the buyer meanwhile. A confirmed payment always ends as
$RYO in the buyer's wallet: if the card is gone by then, the purchase simply doesn't run.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Set

from .errors import MarketError

WEI_PER_RYO = 98_000_000_000          # 100,000 $RYO = 0.0098 ETH
MIN_PAYMENT_WEI = 450_000_000_000_000  # 0.00045 ETH
MIN_OWN_SHARE_PCT = 10
CONFIRMATIONS = 2


@dataclass(frozen=True)
class Quote:
    shortfall: int
    wei: int
    credit: int


def quote(price: int, balance: int, *, own_listing: bool = False) -> Quote:
    """Raises MarketError('own-listing' | 'enough-ryo' | 'need-more-ryo') when there is nothing to quote."""
    if own_listing:
        raise MarketError("own-listing")
    shortfall = price - balance
    if shortfall <= 0:
        raise MarketError("enough-ryo")
    if balance * 100 < price * MIN_OWN_SHARE_PCT:
        raise MarketError("need-more-ryo")
    wei = max(shortfall * WEI_PER_RYO, MIN_PAYMENT_WEI)
    return Quote(shortfall, wei, wei // WEI_PER_RYO)


@dataclass(frozen=True)
class ChainTx:
    sender: str
    recipient: str
    value: int
    ok: bool
    block: Optional[int]                # None while pending


def check(tx: ChainTx, *, buyer: str, vault: str, wei: int, head: int, tx_hash: str, used: Set[str]) -> str:
    """'confirmed' | 'pending' | 'used' | 'wrong-recipient' | 'wrong-sender' | 'underpaid' | 'reverted'."""
    if tx_hash in used:
        return "used"
    if tx.recipient.lower() != vault.lower():
        return "wrong-recipient"
    if tx.sender.lower() != buyer.lower():
        return "wrong-sender"
    if tx.value < wei:
        return "underpaid"
    if tx.block is None:
        return "pending"
    if not tx.ok:
        return "reverted"
    return "confirmed" if head - tx.block + 1 >= CONFIRMATIONS else "pending"


def credit_for(paid_wei: int) -> int:
    """$RYO credited for what was actually paid (an overpay included)."""
    return paid_wei // WEI_PER_RYO
