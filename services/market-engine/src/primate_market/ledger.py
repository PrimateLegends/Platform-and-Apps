"""$RYO off-chain ledger.

Fixed supply, whole units. $RYO never appears or disappears: every operation is a transfer
between accounts, so the sum of all balances is always ``SUPPLY``. Besides wallets there are a
few internal accounts:

* ``vault``     market maker: sells cards at their estimated value, buys at 80%
* ``offers``    $RYO locked by open offers, owned by the bidders until the offer closes
* ``liquidity`` reserved for the launch pool, never spent off-chain
"""

from __future__ import annotations

from typing import Dict, Iterable, Tuple

from .errors import MarketError

SUPPLY = 1_000_000_000
VAULT = "vault"
OFFERS = "offers"
LIQUIDITY = "liquidity"
TEAM = "team"
AIRDROP = "airdrop"

GENESIS: Dict[str, int] = {
    VAULT: 600_000_000,
    TEAM: 200_000_000,
    AIRDROP: 100_000_000,
    LIQUIDITY: 100_000_000,
}

INTERNAL = frozenset({VAULT, OFFERS, LIQUIDITY, TEAM, AIRDROP})


class Ledger:
    """Balances by account. ``transfer`` and ``batch`` are all-or-nothing."""

    def __init__(self, genesis: Dict[str, int] | None = None) -> None:
        self._balances: Dict[str, int] = dict(GENESIS if genesis is None else genesis)
        if sum(self._balances.values()) != SUPPLY:
            raise ValueError("genesis must add up to the supply")

    def balance_of(self, account: str) -> int:
        return self._balances.get(account, 0)

    def total(self) -> int:
        return sum(self._balances.values())

    def transfer(self, source: str, target: str, amount: int) -> None:
        self.batch([(source, target, amount)])

    def batch(self, moves: Iterable[Tuple[str, str, int]]) -> None:
        """Applies every move or none of them (an overdraft anywhere cancels the whole batch)."""
        moves = list(moves)
        draft = dict(self._balances)
        for source, target, amount in moves:
            if not isinstance(amount, int) or isinstance(amount, bool) or amount < 1:
                raise MarketError("bad-amount")
            if source == LIQUIDITY:
                raise MarketError("locked")
            if draft.get(source, 0) < amount:
                raise MarketError("insufficient-ryo", account=source)
            draft[source] = draft.get(source, 0) - amount
            draft[target] = draft.get(target, 0) + amount
        self._balances = draft

    def snapshot(self, locked: Dict[str, int] | None = None) -> Dict[str, int]:
        """Wallet balances for the token launch: $RYO locked in open offers counts for its bidder,
        internal accounts other than the vault are left out."""
        out = {a: b for a, b in self._balances.items() if b > 0 and a not in (OFFERS, LIQUIDITY)}
        for wallet, amount in (locked or {}).items():
            out[wallet] = out.get(wallet, 0) + amount
        return out
