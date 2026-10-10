import unittest
from collections import Counter

from primate_cards import (CLAN_ACCENTS, KEYWORDS, SHARED_GROUPS, budget_delta, keywords_in, load_catalog,
                           validate_deck)

CATALOG = load_catalog()
BY_NUMBER = {c.number: c for c in CATALOG}
CLANS = set(CLAN_ACCENTS)


class CatalogTests(unittest.TestCase):
    def test_catalog_is_complete_and_numbered(self):
        self.assertEqual([c.number for c in CATALOG], list(range(1, 206)))
        self.assertTrue(all(c.clan in CLANS or c.clan in SHARED_GROUPS for c in CATALOG))

    def test_exclusives_are_the_collab_cards(self):
        self.assertEqual([c.number for c in CATALOG if c.exclusive], list(range(149, 156)))
        self.assertTrue(all(c.ki >= 8 for c in CATALOG if c.exclusive), "exclusives are expensive")


class BudgetTests(unittest.TestCase):
    def test_regular_warriors_stay_close_to_the_budget(self):
        for c in CATALOG:
            if not c.is_warrior or c.exclusive:
                continue
            limit_hi = 1 if c.rarity == "legendary" else 1
            self.assertGreaterEqual(budget_delta(c), -3, f"{c.code} {c.name} is too weak for its KI")
            self.assertLessEqual(budget_delta(c), limit_hi, f"{c.code} {c.name} is above the budget")

    def test_most_warriors_are_exactly_on_budget(self):
        warriors = [c for c in CATALOG if c.is_warrior and not c.exclusive]
        on = sum(1 for c in warriors if budget_delta(c) == 0)
        self.assertGreater(on / len(warriors), 0.65)

    def test_exclusives_beat_every_regular_card(self):
        best_regular = max(c.atk + c.defense for c in CATALOG if c.is_warrior and not c.exclusive)
        for c in CATALOG:
            if c.exclusive:
                self.assertGreater(c.atk + c.defense, best_regular)
                self.assertIn(budget_delta(c), (3, 4))


class VocabularyTests(unittest.TestCase):
    RETIRED = ("FLYING", "STEALTH", "PROVOKE", "WEATHER", "RAIN", "ON THE GROUND", "RANGED", "COLLAB", "EDITIONS")

    def test_no_retired_words_on_any_card(self):
        for c in CATALOG:
            for w in self.RETIRED:
                self.assertNotIn(w, (c.text + " " + c.tag).upper(), f"{c.code} {c.name} still says {w}")

    def test_tactics_start_with_their_speed(self):
        for c in CATALOG:
            if c.type == "tactic":
                self.assertRegex(c.text, r"^(INSTANT|SWIFT|RITUAL)\.", f"{c.code} {c.name}")

    def test_every_clan_has_its_accent_keywords(self):
        accent_words = {"evasion": ("SHADOW", "DODGE", "SPELL WARD", "RETREAT"),
                        "attack": ("FIRST STRIKE", "TWIN STRIKE", "CHALLENGE", "DEAL"),
                        "defense": ("IRON SKIN", "SHARPEYE", "REGENERATE", "RETREAT"),
                        "healing": ("HEAL", "LIFESTEAL", "REGENERATE")}
        for clan, accent in CLAN_ACCENTS.items():
            texts = " ".join(c.text for c in CATALOG if c.clan == clan).upper()
            self.assertTrue(any(w in texts for w in accent_words[accent]), f"{clan} lacks its {accent} accent")

    def test_keywords_are_found(self):
        self.assertIn("IRON SKIN", keywords_in(BY_NUMBER[57]))      # Waterfall Monk
        self.assertTrue(set(keywords_in(BY_NUMBER[192])) >= {"SHADOW", "IMPRISON", "ASCEND"})
        self.assertTrue(all(k == k.upper() for k in KEYWORDS))


class EveryClanCanBuildADeck(unittest.TestCase):
    """No useless decks: every clan, alone or with shared cards, has early warriors, interaction and a finisher."""

    def test_every_clan_pool_has_a_curve(self):
        for clan in CLAN_ACCENTS:
            pool = [c for c in CATALOG if c.clan == clan and not c.exclusive]
            costs = Counter(c.ki for c in pool if c.is_warrior)
            self.assertGreater(sum(n for k, n in costs.items() if k <= 2), 0, f"{clan}: no 1-2 KI warrior")
            self.assertGreater(sum(n for k, n in costs.items() if k >= 5), 0, f"{clan}: no 5+ KI finisher")

    def test_shared_cards_give_every_deck_answers(self):
        shared = [c for c in CATALOG if c.clan in SHARED_GROUPS]
        texts = " ".join(c.text for c in shared).upper()
        for need in ("DEFEAT", "DEAL 2", "DRAW", "IRON SKIN", "MAX KI"):
            self.assertIn(need, texts)


class DeckRuleTests(unittest.TestCase):
    def test_a_two_clan_deck_with_shared_cards_is_legal(self):
        picks = [n for n in range(1, 206) if BY_NUMBER[n].clan in ("crimson", "golden", "neutral", "armory")
                 and BY_NUMBER[n].rarity != "legendary"][:14]
        deck = Counter({BY_NUMBER[n]: 3 for n in picks[:13]})
        deck[BY_NUMBER[picks[13]]] = 1
        self.assertEqual(validate_deck(deck), [])

    def test_limits(self):
        legendaries = [c for c in CATALOG if c.rarity == "legendary" and not c.exclusive and c.clan in SHARED_GROUPS]
        deck = Counter({legendaries[0]: 3, legendaries[1]: 3, legendaries[2]: 1})
        self.assertIn("deck has 7 Legendary cards, max 6", validate_deck(deck))
        self.assertIn("THE CLOAK: exclusives are limited to 1 copy", validate_deck(Counter({BY_NUMBER[152]: 2})))
        three = [next(c for c in CATALOG if c.clan == k) for k in ("onyx", "earth", "void")]
        self.assertIn("deck uses 3 clans, max 2", validate_deck(three))


if __name__ == "__main__":
    unittest.main()
