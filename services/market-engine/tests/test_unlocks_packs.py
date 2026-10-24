import unittest
from datetime import timedelta

from primate_market.activity import cards_for, pack_opened
from primate_market.unlocks import FIRST_DAY, calendar, tranche_of, unlock_day


class UnlockCalendarTest(unittest.TestCase):
    def test_tranches_compound_by_forty_percent(self):
        self.assertEqual([tranche_of(d) for d in (1, 2, 3, 4)], [2_000_000, 2_800_000, 3_920_000, 5_488_000])

    def test_three_rows_from_today_and_the_rest_later(self):
        c = calendar(10_000_000, FIRST_DAY + timedelta(days=2, hours=1))
        self.assertEqual(unlock_day(FIRST_DAY + timedelta(days=2, hours=1)), 3)
        self.assertEqual([(r["day"], r["today"]) for r in c["rows"]], [(3, True), (4, False), (5, False)])
        self.assertEqual(c["rows"][0]["date"], "2026-11-10")
        self.assertEqual(c["later"], 10_000_000 - tranche_of(5))

    def test_small_balance_fills_part_of_a_bar(self):
        row = calendar(120_000, FIRST_DAY - timedelta(days=1))["rows"][0]
        self.assertEqual((row["day"], row["pct"], row["today"]), (1, 6, False))


class PackOpenedTest(unittest.TestCase):
    def test_best_card_is_the_thumbnail(self):
        event = {"kind": "pack", "pack": "Onyx Pack", "cards": [
            {"no": 40, "rarity": "common", "design": 12},
            {"no": 41, "rarity": "rare"},
            {"no": 39, "rarity": "rare", "design": 300},
        ]}
        row = pack_opened(event)
        self.assertEqual((row["pack"], row["count"], row["best"].serial), ("Onyx Pack", 3, 39))
        self.assertEqual(cards_for(event)[0].image(), "cards/fronts/300.png")

    def test_empty_pack_is_refused(self):
        with self.assertRaises(ValueError):
            pack_opened({"pack": "Recruit Pack", "cards": []})


if __name__ == "__main__":
    unittest.main()
