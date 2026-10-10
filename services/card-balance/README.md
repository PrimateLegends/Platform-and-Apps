# primate-cards · Battle Cards catalog and balance rules

**Status: in development (rules v1).**

The full card catalog (PL-001 … PL-205) and the rules every card is checked against: the KI stat budget, the
keyword vocabulary, the deck rules and the clan accents. Python 3.10+, no dependencies.

```python
from primate_cards import load_catalog, budget_delta, validate_deck

catalog = load_catalog()
monk = next(c for c in catalog if c.name == "WATERFALL MONK")
budget_delta(monk)        # 0: on budget for 4 KI
```

| Module | |
| --- | --- |
| `catalog.py` | `load_catalog()` reads `catalog.json` (number, name, clan, type, rarity, KI, ATK, DEF, ability, text) |
| `rules.py` | `BUDGET`, `KEYWORDS`, `CLAN_ACCENTS`, `budget_delta()`, `keywords_in()`, `validate_deck()` |

The tests (`python -m unittest discover -s services/card-balance/tests -t services/card-balance`) check that:

- regular warriors stay within the budget and exclusives beat every regular card,
- no card prints a retired word, every tactic starts with its speed,
- every clan shows its accent and has early warriors and a 5+ KI finisher,
- the shared cards give every deck removal, damage, card draw, protection and extra KI.
