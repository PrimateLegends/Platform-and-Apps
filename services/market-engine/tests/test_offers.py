import unittest

from primate_market import Card, Ledger, MarketError, OfferBook, OfferStatus, OFFERS, SUPPLY, VAULT
from primate_market.offers import DAY, ESCROW

NOW = 1_760_000_000
ALICE, BOB, CAROL = "0xa11ce", "0xb0b", "0xca401"


def book() -> OfferBook:
    ledger = Ledger()
    ledger.batch([(VAULT, w, 100_000) for w in (ALICE, BOB, CAROL)])
    b = OfferBook(ledger)
    b.cards = {
        701: Card(701, ALICE),
        702: Card(702, ALICE),
        703: Card(703, CAROL, claimed_at=NOW - 1000),
        704: Card(704, ESCROW),
        705: Card(705, VAULT, listed_price=5_000),
    }
    return b


class PlaceTest(unittest.TestCase):
    def test_locks_the_amount(self):
        b = book()
        o = b.place(BOB, 701, 5_000, 7, NOW)
        self.assertEqual(b.ledger.balance_of(BOB), 95_000)
        self.assertEqual(b.ledger.balance_of(OFFERS), 5_000)
        self.assertEqual(o.expires_at - o.created_at, 7 * DAY)
        self.assertEqual(b.ledger.total(), SUPPLY)

    def test_rules(self):
        b = book()
        cases = [
            ((BOB, 701, 999, 7), "bad-amount"),
            ((BOB, 701, 10_000_001, 7), "bad-amount"),
            ((BOB, 701, 2_000, 5), "bad-days"),
            ((ALICE, 701, 2_000, 1), "own-card"),
            ((BOB, 704, 2_000, 1), "in-escrow"),
            ((BOB, 705, 2_000, 1), "vault-card"),
            ((BOB, 99_999, 2_000, 1), "no-card"),
            ((BOB, 702, 500_000, 1), "insufficient-ryo"),
        ]
        for args, code in cases:
            with self.subTest(code=code, args=args), self.assertRaises(MarketError) as ctx:
                b.place(*args, NOW)
            self.assertEqual(ctx.exception.code, code)
        self.assertEqual(b.ledger.balance_of(BOB), 100_000, "refused offers lock nothing")

    def test_new_offer_replaces_the_old_one(self):
        b = book()
        first = b.place(BOB, 701, 5_000, 7, NOW)
        b.place(BOB, 701, 8_000, 3, NOW + 10)
        self.assertIs(first.status, OfferStatus.CANCELLED)
        self.assertEqual(b.ledger.balance_of(BOB), 92_000)
        self.assertEqual(b.locked_by(BOB), 8_000)
        self.assertEqual(len([o for o in b.offers.values() if o.status is OfferStatus.OPEN]), 1)

    def test_best_offer_first(self):
        b = book()
        b.place(BOB, 701, 8_000, 3, NOW)
        b.place(CAROL, 701, 6_000, 1, NOW)
        self.assertEqual([o.amount for o in b.open_for(701, NOW)], [8_000, 6_000])
        self.assertEqual(b.top_offer(701, NOW), 8_000)
        self.assertEqual(len(b.received(ALICE, NOW)), 2)


class CloseTest(unittest.TestCase):
    def test_cancel_and_reject_refund(self):
        b = book()
        mine = b.place(CAROL, 702, 3_000, 30, NOW)
        with self.assertRaises(MarketError) as ctx:
            b.cancel(BOB, mine.id, NOW)
        self.assertEqual(ctx.exception.code, "not-yours")
        b.cancel(CAROL, mine.id, NOW)
        self.assertEqual(b.ledger.balance_of(CAROL), 100_000)
        with self.assertRaises(MarketError) as ctx:
            b.cancel(CAROL, mine.id, NOW)
        self.assertEqual(ctx.exception.code, "closed")

        other = b.place(BOB, 701, 4_000, 1, NOW)
        with self.assertRaises(MarketError) as ctx:
            b.reject(BOB, other.id, NOW)
        self.assertEqual(ctx.exception.code, "not-owner")
        b.reject(ALICE, other.id, NOW)
        self.assertIs(other.status, OfferStatus.REJECTED)
        self.assertEqual(b.ledger.balance_of(BOB), 100_000)
        self.assertEqual(b.ledger.balance_of(OFFERS), 0)

    def test_accept_moves_card_and_ryo_and_ends_the_listing(self):
        b = book()
        b.cards[701].listed_price = 20_000
        o = b.place(BOB, 701, 8_000, 3, NOW)
        sale = b.accept(ALICE, o.id, NOW + 60)
        self.assertEqual(b.cards[701].holder, BOB)
        self.assertIsNone(b.cards[701].listed_price)
        self.assertEqual(b.ledger.balance_of(ALICE), 108_000)
        self.assertEqual(sale["kind"], "offer")
        self.assertEqual(b.ledger.total(), SUPPLY)
        with self.assertRaises(MarketError) as ctx:
            b.accept(ALICE, o.id, NOW + 61)
        self.assertEqual(ctx.exception.code, "closed")

    def test_claim_hold_blocks_accept_not_offers(self):
        b = book()
        o = b.place(BOB, 703, 2_000, 3, NOW)
        with self.assertRaises(MarketError) as ctx:
            b.accept(CAROL, o.id, NOW)
        self.assertEqual(ctx.exception.code, "claim-hold")
        b.accept(CAROL, o.id, NOW - 1000 + 2 * DAY)
        self.assertEqual(b.cards[703].holder, BOB)

    def test_offer_follows_the_card(self):
        b = book()
        own = b.place(CAROL, 702, 4_000, 7, NOW)
        bob = b.place(BOB, 702, 2_500, 7, NOW)
        b.move_card(702, CAROL)
        self.assertEqual(b.sweep(NOW + 1), 1)
        self.assertIs(own.status, OfferStatus.VOID)
        self.assertEqual(b.ledger.balance_of(CAROL), 100_000)
        b.accept(CAROL, bob.id, NOW + 2)
        self.assertEqual(b.cards[702].holder, BOB)

    def test_expiry(self):
        b = book()
        o = b.place(BOB, 701, 2_000, 1, NOW)
        with self.assertRaises(MarketError):
            b.accept(ALICE, o.id, NOW + DAY)
        self.assertEqual(b.top_offer(701, NOW + DAY), 0)
        self.assertEqual(b.sweep(NOW + DAY), 1)
        self.assertIs(o.status, OfferStatus.EXPIRED)
        self.assertEqual(b.ledger.balance_of(BOB), 100_000)
        self.assertEqual(b.ledger.total(), SUPPLY)


class SnapshotTest(unittest.TestCase):
    def test_locked_offers_count_for_the_bidder(self):
        b = book()
        b.place(BOB, 701, 1_500, 1, NOW)
        snap = b.ledger.snapshot({BOB: b.locked_by(BOB)})
        self.assertEqual(snap[BOB], 100_000)
        self.assertNotIn(OFFERS, snap)


if __name__ == "__main__":
    unittest.main()
