import unittest

from primate_market.holders import HeldCard, rank, holder_id, short, page, primates_label, PREVIEW
from primate_market.swap import Pool, Transfer, declared_deposits_wei, min_received, can_trade, ryo_price_usd

A, B, C, TEAM = "0x" + "a" * 40, "0x" + "b" * 40, "0x" + "c" * 40, "0x" + "7" * 40


class HoldersTest(unittest.TestCase):
    def setUp(self):
        cards = [HeldCard(1, A, 900), HeldCard(2, A, 100), HeldCard(3, A, 5000), HeldCard(4, A, 50), HeldCard(5, A, 60),
                 HeldCard(6, B, 300), HeldCard(7, B, 300), HeldCard(8, C, 10)]
        cards += [HeldCard(9 + i, TEAM, 1) for i in range(6)]
        self.rows = rank(cards, ryo={C: 7000}, handles={A: "AliceX"}, hidden={TEAM})

    def test_ranked_by_cards_team_hidden(self):
        self.assertEqual([r.short for r in self.rows], [short(A), short(B), short(C)])
        self.assertEqual([r.rank for r in self.rows], [1, 2, 3])

    def test_no_full_wallet_and_opaque_id(self):
        for r in self.rows:
            self.assertNotIn(A, repr(r))
            self.assertRegex(r.id, r"^[0-9a-f]{12}$")
        self.assertEqual(self.rows[0].id, holder_id(A.upper()))

    def test_preview_value_and_more(self):
        a = self.rows[0]
        self.assertEqual(a.preview, [3, 1, 2, 5])
        self.assertEqual(len(a.preview), PREVIEW)
        self.assertEqual(a.more, 1)
        self.assertEqual(a.value, 900 + 100 + 5000 + 50 + 60)
        self.assertEqual(self.rows[2].value, 10 + 7000)
        self.assertAlmostEqual(a.share(14), 5 / 14 * 100)

    def test_search_and_labels(self):
        self.assertEqual([r.handle for r in page(self.rows, query="@alice")], ["AliceX"])
        self.assertEqual(primates_label(0), "None")
        self.assertEqual(primates_label(3), "3")
        self.assertEqual(primates_label(None), "—")


class SwapTest(unittest.TestCase):
    def test_price_from_market_cap(self):
        self.assertAlmostEqual(ryo_price_usd(), 0.00003)

    def test_constant_product_quotes(self):
        p = Pool(8000)
        usd, impact = p.sell_ryo(200_000)
        self.assertAlmostEqual(impact, 200_000 / (p.ryo_reserve + 200_000))
        self.assertLess(usd, 200_000 * p.price_usd)          # never better than spot
        ryo, impact2 = p.buy_ryo(2561.29)
        self.assertAlmostEqual(impact2, 2561.29 / 10561.29)
        self.assertAlmostEqual(min_received(ryo, 0.005), ryo * 0.995)

    def test_holder_rule(self):
        self.assertFalse(can_trade(1))
        self.assertTrue(can_trade(2))

    def test_deposits_not_balance(self):
        v, x = "0x" + "d" * 40, "0x" + "e" * 40
        t = [Transfer("0x1", x, v, 2 * 10**18),
             Transfer("0x2", x, v, 5 * 10**18, failed=True),
             Transfer("0x3", v, x, 10**18),                        # bridged out: deposits still count
             Transfer("0x4", v, x, 0), Transfer("0x4", x, v, 9 * 10**18),   # change from its own swap: no
             Transfer("0x5", x, v, 3 * 10**17)]
        self.assertEqual(declared_deposits_wei(v, t), 23 * 10**17)


if __name__ == "__main__":
    unittest.main()
