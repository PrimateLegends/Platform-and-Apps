"""Activity feed: which card(s) each event moved, for the feed's Card column.

The feed shows a crop of the card art: the revealed front (PL-xxx design) or the sealed back. Every
card in the game is public in the market, so events carry the card serial and the feed can open it.
Rarity is never sent with a claim: a sealed card's rarity is only known to its holder.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Mapping

BACKS = ("classic", "sakura", "indigo", "dark", "metal")


@dataclass(frozen=True)
class CardRef:
    serial: int
    back: str = "classic"
    design: int = 0          # PL number of the revealed front, 0 while sealed

    @property
    def revealed(self) -> bool:
        return self.design > 0

    def image(self) -> str:
        return f"cards/fronts/{self.design}.png" if self.revealed else f"cards/backs/{self.back}.png"


def _ref(raw: Mapping) -> CardRef:
    back = raw.get("back") if raw.get("back") in BACKS else "classic"
    return CardRef(int(raw["no"]), back, int(raw.get("design") or 0))


def cards_for(event: Mapping) -> List[CardRef]:
    """Claims and market events move one card; an escrow swap moves two (given, then taken)."""
    kind = event.get("kind")
    if kind in ("claim", "listed", "sale", "vault-buy", "offer"):
        return [_ref(event)]
    if kind == "swap":
        return [_ref(event["given"]), _ref(event["taken"])]
    return []
