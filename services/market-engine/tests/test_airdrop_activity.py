import unittest

from primate_market import CardRef, Ledger, SUPPLY, VAULT, cards_for, rebalance, split
from primate_market.ledger import AIRDROP


class SplitTest(unittest.TestCase):
    def test_half_equal_half_by_cards(self):
        out = split({"a": 1, "b": 2, "c": 7}, 100_000_000)
        self.assertEqual(sum(out.values()), 100_000_000)
        self.assertEqual(out["a"], 50_000_000 // 3 + 50_000_000 * 1 // 10)
        self.assertGreater(out["c"], out["b"])

    def test_cap_keeps_the_rest_in_the_vault(self):
        out = split({"a": 1, "b": 2, "c": 7}, 100_000_000, max_per_wallet=30_000_000)
        self.assertTrue(all(v <= 30_000_000 for v in out.values()))
        self.assertLess(sum(out.values()), 100_000_000)


class RebalanceTest(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.drop = {"big_holder": 2_246_075, "holder": 924_489, "spender": 924_489}
        self.ledger.batch([(AIRDROP, w, a) for w, a in self.drop.items()])
        self.ledger.transfer("spender", VAULT, 700_000)   # spent most of it on cards

    def test_plan_is_dry(self):
        before = self.ledger.balance_of("big_holder")
        plan = rebalance(self.ledger, self.drop)
        self.assertEqual(self.ledger.balance_of("big_holder"), before)
        by = {a.wallet: a for a in plan}
        self.assertEqual(by["big_holder"].returned, 1_123_037)
        self.assertEqual(by["spender"].returned, 224_489)
        self.assertEqual(by["spender"].short, 462_244 - 224_489)

    def test_apply_returns_half_to_the_vault(self):
        vault = self.ledger.balance_of(VAULT)
        plan = rebalance(self.ledger, self.drop, apply=True)
        returned = sum(a.returned for a in plan)
        self.assertEqual(self.ledger.balance_of(VAULT), vault + returned)
        self.assertEqual(self.ledger.balance_of("holder"), 924_489 - 462_244)
        self.assertEqual(self.ledger.balance_of("spender"), 0)
        self.assertEqual(self.ledger.total(), SUPPLY)


class ActivityTest(unittest.TestCase):
    def test_cards_per_event(self):
        self.assertEqual(cards_for({"kind": "claim", "no": 11, "back": "classic", "design": 0}), [CardRef(11)])
        sale = cards_for({"kind": "offer", "no": 8861, "back": "dark", "design": 82})[0]
        self.assertTrue(sale.revealed)
        self.assertEqual(sale.image(), "cards/fronts/82.png")
        swap = cards_for({"kind": "swap", "given": {"no": 1, "design": 4}, "taken": {"no": 2, "back": "metal"}})
        self.assertEqual([c.serial for c in swap], [1, 2])
        self.assertEqual(swap[1].image(), "cards/backs/metal.png")
        self.assertEqual(cards_for({"kind": "bounty"}), [])

    def test_unknown_back_falls_back_to_classic(self):
        self.assertEqual(cards_for({"kind": "claim", "no": 5, "back": "???"})[0].back, "classic")


if __name__ == "__main__":
    unittest.main()
