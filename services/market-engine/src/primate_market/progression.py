"""Player levels, XP and the King of the Hill board.

Levels follow an arithmetic curve: each step costs STEP_GROWTH more XP than the previous one (280, 380, 480, ...),
up to MAX_LEVEL. XP is never stored by this engine; it is recomputed from a wallet's activity, so changing the
table below re-scores every wallet over its full history (early players keep the credit for what they did).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from math import isqrt
from typing import Dict, Iterable, List, Mapping, Optional, Sequence

STEP_BASE = 180
STEP_GROWTH = 100
MAX_LEVEL = 300
DAY_S = 86_400

XP_TABLE: Mapping[str, int] = {
    "daily-claim": 30, "claim-streak": 100, "pack-opened": 25, "bounty-opened": 50,
    "card-bought": 50, "card-sold": 40, "vault-sale": 20, "card-listed": 10, "offer-placed": 10,
    "escrow-swap": 40, "card-sent": 10, "quest-done": 150, "whitelist-application": 50,
    "referral-completed": 150, "code-redeemed": 30, "solana-linked": 50,
}
DAILY_CAPS: Mapping[str, int] = {"trade": 10, "card-listed": 5, "offer-placed": 5, "card-sent": 3}
ONCE = frozenset({"solana-linked"})
_TRADES = frozenset({"card-bought", "card-sold"})


def step_cost(level: int) -> int:
    """XP from `level` to `level + 1`."""
    if level < 1:
        raise ValueError("level must be >= 1")
    return STEP_BASE + STEP_GROWTH * level


def total_for(level: int) -> int:
    """Total XP to stand at `level` (level 1 = 0)."""
    if not 1 <= level <= MAX_LEVEL:
        raise ValueError("level out of range")
    return (level - 1) * (STEP_GROWTH * level // 2 + STEP_BASE) if STEP_GROWTH % 2 == 0 else sum(step_cost(l) for l in range(1, level))


@dataclass(frozen=True)
class Standing:
    xp: int
    level: int
    in_level: int
    to_next: int
    maxed: bool


def standing(xp: int) -> Standing:
    """Level and progress for an XP total; exact integer math (no float rounding)."""
    total = max(0, int(xp))
    # 50 n^2 + 130 n - (180 + xp) = 0, solved with an integer square root, then nudged to the exact level
    a, b = STEP_GROWTH // 2, STEP_BASE - STEP_GROWTH // 2
    disc = b * b + 4 * a * (STEP_BASE + total)
    level = max(1, min(MAX_LEVEL, (isqrt(disc) - b) // (2 * a)))
    while level < MAX_LEVEL and total_for(level + 1) <= total:
        level += 1
    while level > 1 and total_for(level) > total:
        level -= 1
    maxed = level == MAX_LEVEL
    return Standing(total, level, total - total_for(level), 0 if maxed else step_cost(level), maxed)


@dataclass(frozen=True)
class Activity:
    kind: str
    at: int                      # unix seconds
    value: int = 0               # $RYO, for trades


def trade_bonus(value: int) -> int:
    """+1 XP per 1,000 $RYO of a trade, at most +100."""
    return min(100, max(0, int(value)) // 1000)


def score(activities: Iterable[Activity], boosts: int = 0) -> Dict[str, int]:
    """XP per kind for one wallet, plus 'total'. Daily caps count per UTC day; trades share one budget."""
    used: Dict[tuple, int] = {}
    seen: set = set()
    out: Dict[str, int] = {}
    for a in sorted(activities, key=lambda x: x.at):
        base = XP_TABLE.get(a.kind)
        if base is None:
            continue
        if a.kind in ONCE:
            if a.kind in seen:
                continue
            seen.add(a.kind)
        key = "trade" if a.kind in _TRADES else a.kind
        cap = DAILY_CAPS.get(key)
        if cap is not None:
            slot = (key, a.at // DAY_S)
            if used.get(slot, 0) >= cap:
                continue
            used[slot] = used.get(slot, 0) + 1
        got = base + (trade_bonus(a.value) if key == "trade" else 0)
        out[a.kind] = out.get(a.kind, 0) + got
    if boosts > 0:
        out["collector-boost"] = int(boosts)
    out["total"] = sum(v for k, v in out.items())
    return out


@dataclass(frozen=True)
class Sale:
    buyer: Optional[str]
    seller: str
    price: int
    at: int
    kind: str = "sale"           # sale | offer count; listed / cancel never do


@dataclass(frozen=True)
class King:
    wallet: str
    volume: int
    trades: int
    rank: int


def kings_of_the_hill(sales: Sequence[Sale], now: int, hidden: Iterable[str] = (), window_s: int = DAY_S, top: int = 3) -> List[King]:
    """Top wallets by card volume in the last window: both sides of every sale count at the full price."""
    hide = {h.lower() for h in hidden}
    vol: Dict[str, List[int]] = {}
    for s in sales:
        if s.kind not in ("sale", "offer") or not (now - window_s < s.at <= now):
            continue
        for w in (s.buyer, s.seller):
            if not w or w.lower() in hide:
                continue
            row = vol.setdefault(w.lower(), [0, 0])
            row[0] += s.price
            row[1] += 1
    ranked = sorted(vol.items(), key=lambda kv: (-kv[1][0], -kv[1][1], kv[0]))[:top]
    return [King(w, v, t, i + 1) for i, (w, (v, t)) in enumerate(ranked)]
