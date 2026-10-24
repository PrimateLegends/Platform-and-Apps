// The $RYO unlock calendar shown on /swap-ryo.
//
// From the first unlock day, each day frees a bigger tranche: 2,000,000 $RYO per wallet on day 1, then +40% a day,
// compounding (2.8M, 3.92M, ...). A tranche is the most $RYO a wallet can sell or transfer from that date; a bar that
// isn't full doesn't mean tokens stay locked, it means the wallet holds less than the tranche allows.
// Everyone sees the same 3 upcoming tranches (passed ones drop off); the rest waits in a "To be unlocked" row.

export const UNLOCKS = Object.freeze({
  firstDayUtc: Date.UTC(2026, 10, 8),   // 2026-11-08
  firstTranche: 2_000_000,
  growthPct: 140,
  shown: 3,
});
const DAY = 86_400_000;

/** The tranche of unlock day `d` (1 = the first day), in whole $RYO: 2M x 1.4^(d-1), integer steps. */
export function trancheOf(d) {
  let v = UNLOCKS.firstTranche;
  for (let i = 1; i < d; i++) v = Math.floor(v * UNLOCKS.growthPct / 100);
  return v;
}

/** The unlock day `now` falls on (0 before the first one). */
export const unlockDay = now => (now < UNLOCKS.firstDayUtc ? 0 : Math.floor((now - UNLOCKS.firstDayUtc) / DAY) + 1);

/**
 * The rows of the calendar for one wallet.
 * @param {number} balance  the wallet's $RYO
 * @returns {{ rows: { day: number, date: string, cap: number, fill: number, pct: number, today: boolean }[], later: number }}
 *   later: the part of the balance above every shown tranche ("To be unlocked")
 */
export function calendar(balance, now) {
  const today = unlockDay(now), first = Math.max(1, today);
  const rows = [];
  for (let d = first; d < first + UNLOCKS.shown; d++) {
    const cap = trancheOf(d), fill = Math.min(balance, cap);
    rows.push({ day: d, date: new Date(UNLOCKS.firstDayUtc + (d - 1) * DAY).toISOString().slice(0, 10), cap, fill,
      pct: Math.floor(fill * 100 / cap), today: d === today });
  }
  return { rows, later: Math.max(0, balance - rows.at(-1).cap) };
}
