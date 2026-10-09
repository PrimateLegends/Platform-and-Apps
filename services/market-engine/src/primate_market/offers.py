"""Card offers: a $RYO bid on any card, listed or not.

Lifecycle::

    place ──► OPEN ──► ACCEPTED   (holder sells: card to the bidder, $RYO to the holder)
                 ├──► CANCELLED  (bidder takes it back)
                 ├──► REJECTED   (holder declines)
                 ├──► EXPIRED    (deadline passed)
                 └──► VOID       (the bidder ended up holding the card)

Placing an offer moves the amount from the bidder to the ``offers`` account; every way out of OPEN
except ACCEPTED sends it back. An offer belongs to the card, not to whoever held it when the offer
was made: if the card changes hands, the new holder can accept it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

from .errors import MarketError
from .ledger import Ledger, OFFERS, VAULT

DAY = 86_400
AMOUNT_MIN = 1_000
AMOUNT_MAX = 10_000_000
DURATIONS_DAYS = (1, 3, 7, 30)
CLAIM_HOLD = 2 * DAY          # freshly claimed cards trade 48 hours after the claim
ESCROW = "escrow"


class OfferStatus(str, Enum):
    OPEN = "open"
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"
    VOID = "void"


@dataclass
class Card:
    serial: int
    holder: str                        # wallet, VAULT or ESCROW
    listed_price: Optional[int] = None
    claimed_at: Optional[int] = None   # set for claimed cards (48h hold)

    def tradable_at(self) -> int:
        return (self.claimed_at or 0) + CLAIM_HOLD if self.claimed_at is not None else 0


@dataclass
class Offer:
    id: int
    serial: int
    bidder: str
    amount: int
    created_at: int
    expires_at: int
    status: OfferStatus = OfferStatus.OPEN
    closed_at: Optional[int] = None

    def is_live(self, now: int) -> bool:
        return self.status is OfferStatus.OPEN and now < self.expires_at


@dataclass
class OfferBook:
    """Cards, offers and the $RYO they lock. Every public method is atomic."""

    ledger: Ledger
    cards: Dict[int, Card] = field(default_factory=dict)
    offers: Dict[int, Offer] = field(default_factory=dict)
    sales: List[dict] = field(default_factory=list)
    _next_id: int = 1

    # ---------- reads ----------

    def open_for(self, serial: int, now: int) -> List[Offer]:
        """Live offers on a card, best first (ties: oldest first)."""
        live = [o for o in self.offers.values() if o.serial == serial and o.is_live(now)]
        return sorted(live, key=lambda o: (-o.amount, o.created_at))

    def top_offer(self, serial: int, now: int) -> int:
        live = self.open_for(serial, now)
        return live[0].amount if live else 0

    def locked_by(self, bidder: str) -> int:
        return sum(o.amount for o in self.offers.values() if o.bidder == bidder and o.status is OfferStatus.OPEN)

    def received(self, holder: str, now: int) -> List[Offer]:
        mine = {s for s, c in self.cards.items() if c.holder == holder}
        return sorted((o for o in self.offers.values() if o.serial in mine and o.is_live(now)), key=lambda o: -o.created_at)

    # ---------- writes ----------

    def place(self, bidder: str, serial: int, amount: int, days: int, now: int) -> Offer:
        if not isinstance(amount, int) or not AMOUNT_MIN <= amount <= AMOUNT_MAX:
            raise MarketError("bad-amount")
        if days not in DURATIONS_DAYS:
            raise MarketError("bad-days")
        card = self.cards.get(serial)
        if card is None:
            raise MarketError("no-card")
        if card.holder == ESCROW:
            raise MarketError("in-escrow")
        if card.holder == VAULT:
            raise MarketError("vault-card")
        if card.holder == bidder:
            raise MarketError("own-card")

        previous = next((o for o in self.offers.values()
                         if o.serial == serial and o.bidder == bidder and o.status is OfferStatus.OPEN), None)
        # A new offer on the same card replaces the old one: refund + lock in one batch.
        moves = [(OFFERS, bidder, previous.amount)] if previous else []
        moves.append((bidder, OFFERS, amount))
        self.ledger.batch(moves)
        if previous:
            self._close(previous, OfferStatus.CANCELLED, now)

        offer = Offer(self._next_id, serial, bidder, amount, now, now + days * DAY)
        self.offers[offer.id] = offer
        self._next_id += 1
        return offer

    def cancel(self, bidder: str, offer_id: int, now: int) -> None:
        offer = self._open(offer_id)
        if offer.bidder != bidder:
            raise MarketError("not-yours")
        self._refund(offer, OfferStatus.CANCELLED, now)

    def reject(self, holder: str, offer_id: int, now: int) -> None:
        offer = self._owned(holder, offer_id, now)
        self._refund(offer, OfferStatus.REJECTED, now)

    def accept(self, holder: str, offer_id: int, now: int) -> dict:
        offer = self._owned(holder, offer_id, now)
        card = self.cards[offer.serial]
        if card.listed_price is None and now < card.tradable_at():
            raise MarketError("claim-hold", available_at=card.tradable_at())
        self.ledger.transfer(OFFERS, holder, offer.amount)
        card.holder, card.listed_price = offer.bidder, None   # accepting ends any listing
        self._close(offer, OfferStatus.ACCEPTED, now)
        sale = {"serial": offer.serial, "seller": holder, "buyer": offer.bidder, "price": offer.amount, "kind": "offer", "at": now}
        self.sales.append(sale)
        return sale

    def sweep(self, now: int) -> int:
        """Refunds expired offers and offers whose bidder now holds the card. Returns how many closed."""
        closed = 0
        for offer in list(self.offers.values()):
            if offer.status is not OfferStatus.OPEN:
                continue
            if now >= offer.expires_at:
                self._refund(offer, OfferStatus.EXPIRED, now)
                closed += 1
            elif self.cards[offer.serial].holder == offer.bidder:
                self._refund(offer, OfferStatus.VOID, now)
                closed += 1
        return closed

    def move_card(self, serial: int, holder: str) -> None:
        """A transfer outside the offer book (market sale, swap, gift)."""
        self.cards[serial].holder = holder
        self.cards[serial].listed_price = None

    # ---------- internals ----------

    def _open(self, offer_id: int) -> Offer:
        offer = self.offers.get(offer_id)
        if offer is None:
            raise MarketError("no-offer")
        if offer.status is not OfferStatus.OPEN:
            raise MarketError("closed")
        return offer

    def _owned(self, holder: str, offer_id: int, now: int) -> Offer:
        offer = self._open(offer_id)
        if now >= offer.expires_at:
            raise MarketError("closed")
        if self.cards[offer.serial].holder != holder:
            raise MarketError("not-owner")
        return offer

    def _refund(self, offer: Offer, status: OfferStatus, now: int) -> None:
        self.ledger.transfer(OFFERS, offer.bidder, offer.amount)
        self._close(offer, status, now)

    @staticmethod
    def _close(offer: Offer, status: OfferStatus, now: int) -> None:
        offer.status, offer.closed_at = status, now
