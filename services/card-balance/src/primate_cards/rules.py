"""Battle Cards rules v1: KI stat budget, keyword vocabulary, deck rules and clan accents."""
from __future__ import annotations

import re
from collections import Counter
from typing import Iterable, Mapping

from .catalog import Card

WARRIOR_TYPES = ("attack", "defense", "evasion", "technique")
SHARED_GROUPS = ("neutral", "armory", "wiko")

# Total ATK + DEF a warrior of each KI cost should have before rarity and effects.
BUDGET = {0: (2, 3), 1: (3, 3), 2: (4, 4), 3: (5, 5), 4: (6, 7), 5: (8, 8), 6: (9, 9), 7: (11, 11),
          8: (12, 13), 9: (14, 15), 10: (15, 16)}

# The fixed keyword vocabulary printed on cards.
KEYWORDS = ("FIRST STRIKE", "TWIN STRIKE", "SHADOW", "SHARPEYE", "INTIMIDATE", "BREAKTHROUGH", "CHALLENGE", "DODGE",
            "IRON SKIN", "SPELL WARD", "LIFESTEAL", "REGENERATE", "BLOODLUST", "DEATH POEM", "MIRAGE", "SUPPORT",
            "RAID", "COUNTDOWN", "ASCEND", "STUN", "RETREAT", "CHILL", "SEAL", "IMPRISON")

# What each clan stands out at. An accent, not a limit: every clan has cards of every kind.
CLAN_ACCENTS = {
    "phantom": "evasion", "void": "evasion",
    "prism": "attack", "golden": "attack", "crimson": "attack",
    "earth": "defense", "onyx": "defense",
    "sakura": "healing", "ember": "healing",
}

DECK_SIZE = 40
MAX_COPIES = 3
MAX_CLANS = 2
MAX_LEGENDARY = 6
MAX_EXCLUSIVE = 1


def budget_delta(card: Card) -> int:
    """0 when a warrior's ATK + DEF is inside the budget for its KI; otherwise how many points off it is."""
    if not card.is_warrior:
        return 0
    lo, hi = BUDGET[card.ki]
    total = card.atk + card.defense
    return total - lo if total < lo else total - hi if total > hi else 0


def keywords_in(card: Card) -> list[str]:
    """The vocabulary keywords printed in a card's text."""
    text = card.text.upper()
    return [k for k in KEYWORDS if re.search(r"\b" + re.escape(k) + r"\b", text)]


def validate_deck(cards: Iterable[Card] | Mapping[Card, int]) -> list[str]:
    """Deck rules. Accepts a list of cards (with repeats) or a {card: copies} mapping. Returns the problems."""
    counts = Counter(cards) if not isinstance(cards, Mapping) else Counter(dict(cards))
    problems: list[str] = []
    size = sum(counts.values())
    clans = {c.clan for c in counts if c.clan not in SHARED_GROUPS}
    for card, n in counts.items():
        if n > MAX_COPIES:
            problems.append(f"{card.name}: at most {MAX_COPIES} copies")
        if card.exclusive and n > 1:
            problems.append(f"{card.name}: exclusives are limited to 1 copy")
    legendary = sum(n for c, n in counts.items() if c.rarity == "legendary")
    exclusive = sum(n for c, n in counts.items() if c.exclusive)
    if size != DECK_SIZE:
        problems.append(f"deck has {size} cards, needs {DECK_SIZE}")
    if len(clans) > MAX_CLANS:
        problems.append(f"deck uses {len(clans)} clans, max {MAX_CLANS}")
    if legendary > MAX_LEGENDARY:
        problems.append(f"deck has {legendary} Legendary cards, max {MAX_LEGENDARY}")
    if exclusive > MAX_EXCLUSIVE:
        problems.append(f"deck has {exclusive} Exclusive cards, max {MAX_EXCLUSIVE}")
    return problems
