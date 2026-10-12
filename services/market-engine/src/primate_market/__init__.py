"""Primate Legends Pre-Market engine.

Pure rules, no I/O: the live service keeps the same state in a database and runs every
operation below as one atomic batch. Everything here is deterministic and covered by tests.
"""

from .errors import MarketError
from .ledger import Ledger, SUPPLY, VAULT, OFFERS, LIQUIDITY
from .offers import Card, Offer, OfferBook, OfferStatus
from .airdrop import split, rebalance, Allocation
from .activity import CardRef, cards_for
from .holders import HeldCard, Holder, rank, holder_id
from .swap import Pool, Transfer, declared_deposits_wei, can_trade

__all__ = [
    "MarketError",
    "Ledger", "SUPPLY", "VAULT", "OFFERS", "LIQUIDITY",
    "Card", "Offer", "OfferBook", "OfferStatus",
    "split", "rebalance", "Allocation",
    "CardRef", "cards_for",
    "HeldCard", "Holder", "rank", "holder_id",
    "Pool", "Transfer", "declared_deposits_wei", "can_trade",
]

__version__ = "0.13.0"
