"""Internal card transfers (Pre-Market, before the on-chain migration).

A player sends up to MAX_CARDS cards from their vault to any wallet. The fee (FEE_PER_CARD $RYO per card) goes to
the vault. Listed cards, cards in escrow and cards still on their claim / pack hold can't move. Every check runs
first; then the cards and the fee move together, or nothing moves.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from .errors import MarketError
from .ledger import Ledger, VAULT

FEE_PER_CARD = 5
MAX_CARDS = 20
BURST = 7                      # transfers inside WINDOW_S before a captcha
WINDOW_S = 120
CLAIM_HOLD_S = 48 * 3600
PACK_HOLD_S = 72 * 3600
_ADDRESS = re.compile(r"^0x[0-9a-f]{40}$")


@dataclass
class VaultCard:
    no: int
    owner: str
    location: str = "vault"    # vault | listed | escrow
    origin: str = "recruit"    # pack | claim | daily-claim | ...
    pulled_at: int = 0

    def held_until(self, now: int) -> int:
        hold = PACK_HOLD_S if self.origin == "pack" else CLAIM_HOLD_S if self.origin in ("claim", "daily-claim") else 0
        return self.pulled_at + hold if hold and self.pulled_at + hold > now else 0


@dataclass
class Courier:
    """Cards by number, the $RYO ledger and the transfer log (wallet -> times, for the captcha rule)."""
    cards: Dict[int, VaultCard]
    ledger: Ledger
    log: Dict[str, List[int]] = field(default_factory=dict)

    def needs_captcha(self, wallet: str, now: int) -> bool:
        return sum(1 for t in self.log.get(wallet, []) if now - t < WINDOW_S) >= BURST

    def send(self, sender: str, recipient: str, numbers: Sequence[int], now: int, captcha: bool = False) -> int:
        """Moves the cards and charges the fee. Returns the fee paid. Raises MarketError with nothing changed."""
        sender, recipient = sender.lower(), recipient.lower()
        if not _ADDRESS.match(recipient):
            raise MarketError("bad-recipient")
        if recipient == sender:
            raise MarketError("same-wallet")
        if not numbers or len(set(numbers)) != len(numbers):
            raise MarketError("bad-cards")
        if len(numbers) > MAX_CARDS:
            raise MarketError("too-many-cards", max=MAX_CARDS)
        if self.needs_captcha(sender, now) and not captcha:
            raise MarketError("captcha-required")
        for no in numbers:
            card = self.cards.get(no)
            if card is None or card.owner != sender:
                raise MarketError("not-yours", card=no)
            if card.location != "vault":
                raise MarketError("listed" if card.location == "listed" else "in-escrow", card=no)
            if card.held_until(now):
                raise MarketError("pack-hold" if card.origin == "pack" else "claim-hold", card=no)
        fee = FEE_PER_CARD * len(numbers)
        self.ledger.transfer(sender, VAULT, fee)          # raises insufficient-ryo before any card moves
        for no in numbers:
            self.cards[no].owner = recipient
        self.log.setdefault(sender, []).append(now)
        return fee
