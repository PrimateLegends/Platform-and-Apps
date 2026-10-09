"""Airdrop allocation and the v1 rebalance.

``split`` is the original rule: half of the pool equally between eligible wallets, half pro rata to
the cards each one holds, rounding leftovers to the biggest holder so the total is exact. Future
distributions pass ``max_per_wallet``: anything above the cap stays in the vault instead of
concentrating supply in a few wallets.

``rebalance`` is the one-time correction applied to the first airdrop: every recipient returns half
of what it received to the vault. A wallet that already spent part of it returns what it still holds,
never more, and the shortfall is reported.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from .ledger import Ledger, VAULT


def split(holders: Dict[str, int], total: int, max_per_wallet: Optional[int] = None) -> Dict[str, int]:
    """``holders`` maps wallet -> cards held. Returns wallet -> amount; the sum is ``total`` minus
    whatever the cap keeps back (``total - sum(result)`` stays in the vault)."""
    wallets = sorted(holders)
    if not wallets:
        return {}
    cards = sum(holders.values())
    equal = total // 2 // len(wallets)
    out = {w: equal + (total // 2 * holders[w] // cards if cards else 0) for w in wallets}
    top = sorted(wallets, key=lambda w: (-holders[w], w))[0]
    out[top] += total - sum(out.values())
    if max_per_wallet is not None:
        out = {w: min(a, max_per_wallet) for w, a in out.items()}
    return out


@dataclass(frozen=True)
class Allocation:
    wallet: str
    received: int
    balance: int
    half: int
    returned: int

    @property
    def short(self) -> int:
        return self.half - self.returned


def rebalance(ledger: Ledger, airdrop: Dict[str, int], apply: bool = False) -> List[Allocation]:
    """Plans (and with ``apply=True`` executes, as one batch) the return of half of each airdrop."""
    plan = []
    for wallet, received in sorted(airdrop.items(), key=lambda kv: (-kv[1], kv[0])):
        half = received // 2
        plan.append(Allocation(wallet, received, ledger.balance_of(wallet), half, min(half, ledger.balance_of(wallet))))
    if apply:
        ledger.batch([(a.wallet, VAULT, a.returned) for a in plan if a.returned > 0])
    return plan
