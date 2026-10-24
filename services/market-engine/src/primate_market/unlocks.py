"""The $RYO unlock calendar: 2,000,000 $RYO per wallet on the first unlock day (2026-11-08 UTC), +40% a day,
compounding. A tranche is the most $RYO a wallet can sell or transfer from that day. Mirrors apps/ryo/src/unlocks.js.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List

FIRST_DAY = datetime(2026, 11, 8, tzinfo=timezone.utc)
FIRST_TRANCHE = 2_000_000
GROWTH_PCT = 140
SHOWN = 3


def tranche_of(day: int) -> int:
    """The tranche of unlock day `day` (1 = the first), in whole $RYO, with the same integer steps as the site."""
    v = FIRST_TRANCHE
    for _ in range(1, day):
        v = v * GROWTH_PCT // 100
    return v


def unlock_day(now: datetime) -> int:
    return 0 if now < FIRST_DAY else (now - FIRST_DAY).days + 1


def calendar(balance: int, now: datetime) -> Dict[str, object]:
    today = unlock_day(now)
    first = max(1, today)
    rows: List[dict] = []
    for d in range(first, first + SHOWN):
        cap = tranche_of(d)
        fill = min(balance, cap)
        rows.append({"day": d, "date": (FIRST_DAY + timedelta(days=d - 1)).date().isoformat(), "cap": cap,
                     "fill": fill, "pct": fill * 100 // cap, "today": d == today})
    return {"rows": rows, "later": max(0, balance - rows[-1]["cap"])}
