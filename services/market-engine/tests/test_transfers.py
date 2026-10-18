import unittest

from primate_market.errors import MarketError
from primate_market.ledger import Ledger, VAULT
from primate_market.transfers import Courier, VaultCard, FEE_PER_CARD, BURST, WINDOW_S, PACK_HOLD_S

A, B = "0x" + "a" * 40, "0x" + "b" * 40
NOW = 2_000_000_000


class TransfersTest(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.ledger.transfer(VAULT, A, 1000)
        cards = {n: VaultCard(n, A) for n in range(1, 40)}
        cards[50] = VaultCard(50, A, location="listed")
        cards[51] = VaultCard(51, A, location="escrow")
        cards[52] = VaultCard(52, A, origin="pack", pulled_at=NOW - 3600)
        cards[53] = VaultCard(53, A, origin="daily-claim", pulled_at=NOW - 3600)
        cards[54] = VaultCard(54, A, origin="pack", pulled_at=NOW - PACK_HOLD_S - 1)
        self.c = Courier(cards, self.ledger)

    def code(self, *args, **kw):
        with self.assertRaises(MarketError) as e:
            self.c.send(*args, **kw)
        return e.exception.code

    def test_moves_cards_and_charges_the_fee(self):
        vault = self.ledger.balance_of(VAULT)
        self.assertEqual(self.c.send(A, B, [1, 2, 54], NOW), 3 * FEE_PER_CARD)
        self.assertEqual([self.c.cards[n].owner for n in (1, 2, 54)], [B, B, B])
        self.assertEqual(self.ledger.balance_of(A), 1000 - 15)
        self.assertEqual(self.ledger.balance_of(VAULT), vault + 15)

    def test_refusals_change_nothing(self):
        self.assertEqual(self.code(A, "nope", [1], NOW), "bad-recipient")
        self.assertEqual(self.code(A, A, [1], NOW), "same-wallet")
        self.assertEqual(self.code(A, B, [1, 1], NOW), "bad-cards")
        self.assertEqual(self.code(A, B, list(range(1, 22)), NOW), "too-many-cards")
        self.assertEqual(self.code(A, B, [1, 50], NOW), "listed")
        self.assertEqual(self.code(A, B, [51], NOW), "in-escrow")
        self.assertEqual(self.code(A, B, [52], NOW), "pack-hold")
        self.assertEqual(self.code(A, B, [53], NOW), "claim-hold")
        self.assertEqual(self.code(B, A, [1], NOW), "not-yours")
        self.assertEqual(self.c.cards[1].owner, A)
        self.assertEqual(self.ledger.balance_of(A), 1000)

    def test_not_enough_ryo_moves_no_card(self):
        poor = "0x" + "c" * 40
        self.c.cards[60] = VaultCard(60, poor)
        self.assertEqual(self.code(poor, B, [60], NOW), "insufficient-ryo")
        self.assertEqual(self.c.cards[60].owner, poor)

    def test_captcha_after_the_burst(self):
        for i in range(BURST):
            self.c.send(A, B, [i + 1], NOW + i)
        self.assertEqual(self.code(A, B, [20], NOW + BURST), "captcha-required")
        self.c.send(A, B, [20], NOW + BURST, captcha=True)
        self.c.send(A, B, [21], NOW + BURST + WINDOW_S + 1)   # the window passed


if __name__ == "__main__":
    unittest.main()
