"""Primate Legends · Battle Cards: the card catalog and its balance rules (rules v1).

- `load_catalog()`  every card front (PL-001..PL-205) with its KI cost, stats, type, rarity and text.
- `budget_delta()`  how far a warrior sits from the KI stat budget.
- `validate_deck()` the deck rules (40 cards, 3 copies, 2 clans, 6 Legendary, 1 Exclusive).
- `CLAN_ACCENTS`    what each clan stands out at.
"""
from .catalog import Card, load_catalog
from .rules import (BUDGET, CLAN_ACCENTS, DECK_SIZE, KEYWORDS, MAX_CLANS, MAX_COPIES, MAX_EXCLUSIVE,
                    MAX_LEGENDARY, SHARED_GROUPS, WARRIOR_TYPES, budget_delta, keywords_in, validate_deck)

__all__ = ["Card", "load_catalog", "BUDGET", "CLAN_ACCENTS", "DECK_SIZE", "KEYWORDS", "MAX_CLANS", "MAX_COPIES",
           "MAX_EXCLUSIVE", "MAX_LEGENDARY", "SHARED_GROUPS", "WARRIOR_TYPES", "budget_delta", "keywords_in", "validate_deck"]
