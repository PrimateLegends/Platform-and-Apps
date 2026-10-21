import unittest

from primate_market.errors import MarketError
from primate_market.progression import (
    Activity, Sale, kings_of_the_hill, score, standing, step_cost, total_for, MAX_LEVEL,
)
from primate_market.eth_topup import ChainTx, check, credit_for, quote, WEI_PER_RYO

T0 = 2_000_000_000


class LevelsTest(unittest.TestCase):
    def test_curve(self):
        lol = [280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360]
        self.assertEqual([total_for(n) for n in range(2, 19)], lol)
        self.assertEqual(step_cost(299), 30080)
        self.assertEqual(total_for(MAX_LEVEL), 4_538_820)

    def test_standing(self):
        self.assertEqual(standing(0).level, 1)
        self.assertEqual((standing(279).level, standing(280).level), (1, 2))
        s = standing(1000)
        self.assertEqual((s.level, s.in_level, s.to_next), (3, 340, 480))
        self.assertTrue(standing(10**12).maxed)
        for xp in (0, 279, 280, 18_359, 18_360, 4_538_819, 4_538_820):
            lv = standing(xp).level
            self.assertTrue(total_for(lv) <= xp, xp)


class XpTest(unittest.TestCase):
    def test_caps_and_bonus(self):
        log = [Activity("daily-claim", T0), Activity("card-bought", T0, 5000)]
        log += [Activity("card-listed", T0 + i) for i in range(8)]
        log += [Activity("solana-linked", T0), Activity("solana-linked", T0 + 1), Activity("nope", T0)]
        s = score(log, boosts=40)
        self.assertEqual(s["card-listed"], 50)
        self.assertEqual(s["card-bought"], 55)
        self.assertEqual(s["solana-linked"], 50)
        self.assertEqual(s["total"], 30 + 55 + 50 + 50 + 40)

    def test_trades_share_a_daily_budget(self):
        log = [Activity("card-bought" if i % 2 else "card-sold", T0 + i, 1000) for i in range(12)]
        s = score(log)
        self.assertEqual(s["card-bought"] // 51 + s["card-sold"] // 41, 10)


class KingsTest(unittest.TestCase):
    def test_board(self):
        h = 3600
        sales = [Sale("0xb", "0xa", 5000, T0 - h), Sale("0xb", "0xc", 3000, T0 - 2 * h, "offer"),
                 Sale("0xvault", "0xd", 9000, T0 - h // 5), Sale("0xa", "0xe", 99000, T0 - 30 * h),
                 Sale(None, "0xa", 7000, T0, "listed")]
        board = kings_of_the_hill(sales, T0, hidden=["0xVAULT"])
        self.assertEqual([(k.wallet, k.volume, k.rank) for k in board], [("0xd", 9000, 1), ("0xb", 8000, 2), ("0xa", 5000, 3)])


class TopUpTest(unittest.TestCase):
    def test_quote(self):
        q = quote(50_000, 20_000)
        self.assertEqual((q.shortfall, q.wei, q.credit), (30_000, 30_000 * WEI_PER_RYO, 30_000))
        small = quote(5_000, 1_000)
        self.assertEqual(small.wei, 450_000_000_000_000)
        self.assertGreater(small.credit, small.shortfall)
        for args, code in (((50_000, 4_999), "need-more-ryo"), ((50_000, 60_000), "enough-ryo")):
            with self.assertRaises(MarketError) as e:
                quote(*args)
            self.assertEqual(e.exception.code, code)

    def test_check(self):
        tx = ChainTx("0xB", "0xV", 100, True, 49)
        kw = dict(buyer="0xb", vault="0xv", wei=100, head=50, tx_hash="0x1", used=set())
        self.assertEqual(check(tx, **kw), "confirmed")
        self.assertEqual(check(ChainTx("0xb", "0xv", 100, True, 50), **kw), "pending")
        self.assertEqual(check(ChainTx("0xb", "0xv", 99, True, 49), **kw), "underpaid")
        self.assertEqual(check(ChainTx("0xc", "0xv", 100, True, 49), **kw), "wrong-sender")
        self.assertEqual(check(ChainTx("0xb", "0xv", 100, False, 49), **kw), "reverted")
        self.assertEqual(check(tx, **{**kw, "used": {"0x1"}}), "used")
        self.assertEqual(credit_for(31_000 * WEI_PER_RYO + 5), 31_000)


if __name__ == "__main__":
    unittest.main()
