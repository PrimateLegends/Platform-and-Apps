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


RARITY_ORDER = ("common", "uncommon", "rare", "legendary", "astral")


def cards_for(event: Mapping) -> List[CardRef]:
    """Claims and market events move one card; an escrow swap moves two (given, then taken).
    A pack opening shows its best card only (see pack_opened)."""
    kind = event.get("kind")
    if kind in ("claim", "listed", "sale", "vault-buy", "offer"):
        return [_ref(event)]
    if kind == "swap":
        return [_ref(event["given"]), _ref(event["taken"])]
    if kind == "pack":
        return [pack_opened(event)["best"]]
    return []


def pack_opened(event: Mapping) -> dict:
    """A "Pack opened" row: the pack's name, how many cards came out and the best of them as the thumbnail.
    Best = highest rarity, then a revealed front over a sealed back, then the lowest serial (stable)."""
    cards = list(event["cards"])
    if not cards:
        raise ValueError("a pack opens into at least one card")

    def rank(c: Mapping):
        r = c.get("rarity")
        return (-(RARITY_ORDER.index(r) if r in RARITY_ORDER else -1), 0 if c.get("design") else 1, int(c["no"]))

    best = min(cards, key=rank)
    return {"pack": str(event["pack"]), "count": len(cards), "best": _ref(best)}
