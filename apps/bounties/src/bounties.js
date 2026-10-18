// Bounty bags: earned with 7-day daily-claim streaks and referral rewards. Opening one (like a pack) gives
// 1 scarce card, already revealed, with a front the wallet doesn't own yet, plus a random amount of $RYO.

export const BOUNTY = Object.freeze({
  odds: { rare: 80, legendary: 18, astral: 2 },   // sealed tier of the card inside
  ryoMin: 10_000,
  ryoMax: 25_000
});
// Sealed tier -> front tiers it can show (a Rare bag shows an Epic front).
export const FRONT_TIERS = Object.freeze({ rare: ['epic'], legendary: ['legendary'], astral: ['legendary'] });

/** Weighted pick; rnd() in [0, 1). */
export function rollTier(rnd = Math.random, odds = BOUNTY.odds) {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let n = rnd() * total;
  for (const [tier, w] of Object.entries(odds)) { n -= w; if (n < 0) return tier; }
  return Object.keys(odds).at(-1);
}

/** $RYO inside the bag: a whole number in [ryoMin, ryoMax]. */
export const rollRyo = (rnd = Math.random) => BOUNTY.ryoMin + Math.floor(rnd() * (BOUNTY.ryoMax - BOUNTY.ryoMin + 1));

/**
 * Front for the card: one of the tier's fronts the wallet doesn't own, with copies left. Only when the wallet owns
 * every front of the tier, any front with copies left (it gets a second copy).
 * @param {string} tier  sealed tier from rollTier
 * @param {{ n: number, tier: string, cap: number }[]} fronts  the catalog
 * @param {Map<number, number>} copies  copies already out per front
 * @param {Set<number>} owned  fronts the wallet holds (vault, listed or in escrow)
 */
export function pickFront(tier, fronts, copies, owned, rnd = Math.random) {
  const tiers = FRONT_TIERS[tier] || [];
  const room = fronts.filter(f => tiers.includes(f.tier) && (copies.get(f.n) || 0) < f.cap);
  const fresh = room.filter(f => !owned.has(f.n));
  const pool = fresh.length ? fresh : room;
  return pool.length ? { front: pool[Math.floor(rnd() * pool.length)].n, fresh: fresh.length > 0 } : null;
}

/**
 * Opens one bag. state = { bounties, owned:Set }. Returns the result and the next state, or { error }.
 * The bag is spent only when everything inside could be given.
 */
export function openBounty(state, fronts, copies, rnd = Math.random) {
  if (!(state.bounties > 0)) return { error: 'no-bounty' };
  const tier = rollTier(rnd);
  const pick = pickFront(tier, fronts, copies, state.owned, rnd);
  if (!pick) return { error: 'no-front' };
  const ryo = rollRyo(rnd);
  const owned = new Set(state.owned).add(pick.front);
  return { tier, front: pick.front, fresh: pick.fresh, ryo, state: { bounties: state.bounties - 1, owned } };
}
