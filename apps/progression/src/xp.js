// XP from activity. Nothing is stored: a player's XP is recomputed from the activity log every time, so the scoring
// table can change and every player (early ones included) is re-scored from their full history.
//
// An activity is { kind, wallet, at, value? }. `value` is the $RYO amount for trades.
// Repeatable kinds score only a few times per wallet per UTC day (DAILY_CAPS), so spamming listings or offers
// can't farm levels.

export const DAY_MS = 86_400_000;

/** Flat XP per activity kind. Trades also get a value bonus (tradeBonus). */
export const XP_TABLE = Object.freeze({
  'daily-claim': 30,
  'claim-streak': 100,
  'pack-opened': 25,
  'bounty-opened': 50,
  'card-bought': 50,
  'card-sold': 40,
  'vault-sale': 20,
  'card-listed': 10,
  'offer-placed': 10,
  'escrow-swap': 40,
  'card-sent': 10,
  'quest-done': 150,
  'whitelist-application': 50,
  'referral-completed': 150,
  'code-redeemed': 30,
  'solana-linked': 50
});

/** Per-day limits; trades share one budget between buys and sells. */
export const DAILY_CAPS = Object.freeze({ trade: 10, 'card-listed': 5, 'offer-placed': 5, 'card-sent': 3 });
const capKey = kind => (kind === 'card-bought' || kind === 'card-sold' ? 'trade' : kind);

/** +1 XP per 1,000 $RYO of the trade, at most +100. */
export function tradeBonus(value) {
  return Math.min(100, Math.floor(Math.max(0, Number(value) || 0) / 1000));
}

/** Kinds that only count once per wallet, whatever the log says. */
const ONCE = new Set(['solana-linked']);

/**
 * Scores a wallet's activity.
 * @param {Array<{kind: string, at: number, value?: number}>} log  one wallet's activities, any order
 * @param {{ boosts?: number }} [extra]  XP already fixed elsewhere (e.g. Collector Boost claims), added as is
 * @returns {{ xp: number, byKind: Record<string, { count: number, xp: number }> }}
 */
export function scoreWallet(log, extra = {}) {
  const used = new Map(), seen = new Set(), byKind = {};
  let xp = 0;
  for (const a of [...log].sort((x, y) => x.at - y.at)) {
    const base = XP_TABLE[a.kind];
    if (base === undefined) continue;
    if (ONCE.has(a.kind)) { if (seen.has(a.kind)) continue; seen.add(a.kind); }
    const key = capKey(a.kind), cap = DAILY_CAPS[key];
    if (cap !== undefined) {
      const slot = key + ':' + Math.floor(a.at / DAY_MS);
      const n = used.get(slot) || 0;
      if (n >= cap) continue;
      used.set(slot, n + 1);
    }
    const got = base + (key === 'trade' ? tradeBonus(a.value) : 0);
    xp += got;
    const k = byKind[a.kind] || (byKind[a.kind] = { count: 0, xp: 0 });
    k.count++; k.xp += got;
  }
  const boosts = Math.max(0, Math.floor(extra.boosts || 0));
  if (boosts) byKind['collector-boost'] = { count: 1, xp: boosts };
  return { xp: xp + boosts, byKind };
}

/**
 * Ranks every wallet of a mixed log. Team wallets never rank.
 * @returns {Array<{ wallet: string, xp: number, rank: number }>}
 */
export function leaderboard(log, { hidden = [], boosts = {} } = {}) {
  const hide = new Set(hidden.map(w => w.toLowerCase())), by = new Map();
  for (const a of log) {
    const w = String(a.wallet || '').toLowerCase();
    if (!w || hide.has(w)) continue;
    if (!by.has(w)) by.set(w, []);
    by.get(w).push(a);
  }
  return [...by.entries()]
    .map(([wallet, l]) => ({ wallet, xp: scoreWallet(l, { boosts: boosts[wallet] }).xp }))
    .filter(r => r.xp > 0)
    .sort((a, b) => b.xp - a.xp || (a.wallet < b.wallet ? -1 : 1))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
