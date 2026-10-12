"""Holders ranking for the market's Holders tab and the holder profile.

Every wallet holding cards, ranked by cards held (then by estimated value). A listed card counts for its
seller and a card in escrow for whoever locked it. Team wallets are left out. Full wallets never leave
the service: a row carries the short form (0x1234…abcd) and an opaque profile id.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

PREVIEW = 4
PAGE = 50


def short(wallet: str) -> str:
    return wallet[:6] + "…" + wallet[-4:]


def holder_id(wallet: str) -> str:
    """Stable 12-hex profile id; the URL never carries the wallet."""
    return hashlib.sha256(("pl-holder:" + wallet.lower()).encode()).hexdigest()[:12]


@dataclass(frozen=True)
class HeldCard:
    no: int
    owner: str            # the real owner (seller of a listing, locker of an escrow card)
    value: int            # estimated value in $RYO


@dataclass
class Holder:
    id: str
    short: str
    handle: str
    count: int
    cards_value: int
    ryo: int
    preview: list[int] = field(default_factory=list)   # card numbers, most valuable first
    primates: int | None = None
    rank: int = 0

    @property
    def value(self) -> int:
        return self.cards_value + self.ryo

    @property
    def more(self) -> int:
        """Cards beyond the preview (shown as "… +N")."""
        return max(0, self.count - len(self.preview))

    def share(self, total_cards: int) -> float:
        return self.count / total_cards * 100 if total_cards else 0.0


def rank(cards: list[HeldCard], ryo: dict[str, int] | None = None, handles: dict[str, str] | None = None,
         hidden: set[str] | None = None) -> list[Holder]:
    ryo, handles, hidden = ryo or {}, handles or {}, {w.lower() for w in (hidden or set())}
    by: dict[str, list[HeldCard]] = {}
    for c in cards:
        w = c.owner.lower()
        if w in hidden:
            continue
        by.setdefault(w, []).append(c)
    out = []
    for w, held in by.items():
        best = sorted(held, key=lambda c: (-c.value, c.no))
        out.append(Holder(id=holder_id(w), short=short(w), handle=handles.get(w, ""), count=len(held),
                          cards_value=sum(c.value for c in held), ryo=ryo.get(w, 0),
                          preview=[c.no for c in best[:PREVIEW]]))
    # ties: higher value first, then the id so the order is stable
    out.sort(key=lambda h: (-h.count, -h.value, h.id))
    for i, h in enumerate(out, 1):
        h.rank = i
    return out


def primates_label(n: int | None) -> str:
    """Primates held as the table shows it."""
    if n is None:
        return "—"
    return f"{n:,}" if n else "None"


def page(holders: list[Holder], offset: int = 0, query: str = "") -> list[Holder]:
    q = query.strip().lower().lstrip("@")
    rows = [h for h in holders if not q or q in h.handle.lower() or q in h.short.lower()]
    return rows[offset:offset + PAGE]
