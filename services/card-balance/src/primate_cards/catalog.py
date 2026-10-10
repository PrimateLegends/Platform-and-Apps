"""The card catalog shipped with the package (catalog.json, generated from the card fronts)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Optional


@dataclass(frozen=True)
class Card:
    number: int
    name: str
    clan: str            # a clan, or neutral / armory / wiko for cards that fit any deck
    type: str            # attack / defense / evasion / technique (warriors), tactic, equipment, item, location
    rarity: str          # common / rare / epic / legendary
    exclusive: bool      # collab cards: 3 copies exist, never in random reveals
    ki: int
    atk: Optional[int]
    defense: Optional[int]
    bonus: bool          # True when atk/defense are bonuses granted by equipment or items
    ability: str
    text: str
    tag: str

    @property
    def code(self) -> str:
        return f"PL-{self.number:03d}"

    @property
    def is_warrior(self) -> bool:
        return self.type in ("attack", "defense", "evasion", "technique") and self.atk is not None and not self.bonus


@lru_cache(maxsize=1)
def load_catalog() -> tuple[Card, ...]:
    raw = json.loads(resources.files(__package__).joinpath("catalog.json").read_text(encoding="utf-8"))
    return tuple(Card(**row) for row in raw)
