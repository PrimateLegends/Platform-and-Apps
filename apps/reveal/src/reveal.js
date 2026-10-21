// Revealing sealed cards. A sealed card carries a rarity, a hinted card type and a list of possible clans;
// revealing gives it one of the card fronts. The hint never lies: a front is only given when it is of the
// hinted type (strict mode), sits in the card's rarity tier and still has copies left.
// Everything here is pure: pass your own random source (`rnd`) to get repeatable results.
import { FRONTS } from './fronts.js';

// Sealed rarity -> front tiers it may show, preferred tier first. Common and uncommon share the
// Common + Rare fronts so ~80% of a large supply can be revealed without overusing a few fronts.
export const TIERS = Object.freeze({
  common: ['common', 'rare'],
  uncommon: ['rare', 'common'],
  rare: ['epic'],
  legendary: ['legendary'],
  phantom: ['legendary']
});
// Copies per front.
export const COPY_CAP = Object.freeze({ common: 12, rare: 12, epic: 2, legendary: 2 });
// A newly claimed card comes already revealed this often.
export const CLAIM_REVEAL_ODDS = 0.35;
// Scarcest first, so uncommon takes its Rare fronts before common overflows into them.
export const ORDER = Object.freeze(['phantom', 'legendary', 'rare', 'uncommon', 'common']);

const byNumber = new Map(FRONTS.map(f => [f.n, f]));
export const front = n => byNumber.get(Number(n)) || null;

function clansOf(card) {
  const c = Array.isArray(card.clans) ? card.clans : [];
  return c.filter(x => Array.isArray(x) && typeof x[0] === 'string');
}

/** How well `f` fits `card`, or -Infinity when it may not be given. */
export function fit(card, f, used, { strict = true, capMult = 1 } = {}) {
  const tiers = TIERS[card.rarity];
  if (!tiers) throw new Error('unknown rarity: ' + card.rarity);
  const tier = tiers.indexOf(f.rarity);
  const copies = used.get(f.n) || 0;
  if (tier < 0 || copies >= COPY_CAP[f.rarity] * capMult) return -Infinity;
  const typeOk = !card.type || f.type === card.type;
  if (strict && !typeOk) return -Infinity;
  let s = typeOk ? 20 : 0;
  if (f.clans.length) {
    let best = 0;
    clansOf(card).forEach(([clan, pct], i) => {
      if (f.clans.includes(clan)) best = Math.max(best, (i === 0 ? 8 : 3) + (Number(pct) || 0) / 25);
    });
    s += best;
  } else s += 2;                         // fronts without a primate fit any clan a little
  if (tier === 0) s += 4;                // the card's own tier first
  return s - copies * 0.6;               // spread the copies
}

/** Best front number for one card, or 0 when none has room. */
export function pick(card, used, { strict = true, rnd = Math.random } = {}) {
  let best = 0, bestScore = -Infinity;
  for (const f of FRONTS) {
    const s = fit(card, f, used, { strict });
    if (s === -Infinity) continue;
    const v = s + rnd() * 0.5;
    if (v > bestScore) { bestScore = v; best = f.n; }
  }
  return best;
}

/** A claimed card: revealed with CLAIM_REVEAL_ODDS, strict type first, then any front of its tier. */
export function claimReveal(card, used, rnd = Math.random) {
  if (rnd() >= CLAIM_REVEAL_ODDS) return 0;
  return pick(card, used, { rnd }) || pick(card, used, { strict: false, rnd });
}

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Reveal batch over `cards` ({ id, rarity, type, clans, front }): brings every rarity up to `pct` revealed.
 * Cards that already have a front are never re-rolled. Returns { plan: [{ id, front }], stats, used }.
 */
export function planReveal(cards, { pct = 0.8, strict = true, rnd = Math.random } = {}) {
  if (!(pct > 0 && pct <= 1)) throw new Error('pct must be in (0, 1]');
  const used = new Map();
  for (const c of cards) if (c.front) used.set(c.front, (used.get(c.front) || 0) + 1);
  const plan = [], stats = {};
  for (const rarity of ORDER) {
    const all = cards.filter(c => c.rarity === rarity);
    const already = all.filter(c => c.front).length;
    const target = Math.round(all.length * pct);
    const st = stats[rarity] = { total: all.length, already, target, revealed: 0, typeMatch: 0, short: 0 };
    let need = target - already;
    const open = shuffled(all.filter(c => !c.front), rnd);
    const done = new Set();
    for (const s of strict ? [true] : [true, false]) {
      for (const c of open) {
        if (need <= 0) break;
        if (done.has(c.id)) continue;
        const n = pick(c, used, { strict: s, rnd });
        if (!n) continue;
        done.add(c.id); need--;
        used.set(n, (used.get(n) || 0) + 1);
        plan.push({ id: c.id, front: n });
        st.revealed++;
        if (!c.type || front(n).type === c.type) st.typeMatch++;
      }
    }
    st.short = Math.max(0, need);
  }
  return { plan, stats, used };
}

/**
 * Clan-first reveal of every sealed card of `rarities`. The clan is rolled before the front: `top` of the time the
 * card's most likely hinted clan, otherwise its second one (a single hinted clan is always used). Then the best
 * front of that clan is picked (tier, hinted type, fewest copies). When that clan has no front with room left, the
 * other hinted clan is tried, then any front of the tier; those cards are counted as `fallback`.
 * `capMult` raises every copy cap, for tiers whose fronts are all at their cap.
 * Returns { plan: [{ id, front, clan }], stats, used }.
 */
export const CLAN_TOP_ODDS = 0.8;
export function planClanReveal(cards, { rarities = ['common', 'uncommon', 'rare'], top = CLAN_TOP_ODDS, capMult = 1, rnd = Math.random } = {}) {
  if (!(top >= 0 && top <= 1)) throw new Error('top must be in [0, 1]');
  const used = new Map();
  for (const c of cards) if (c.front) used.set(c.front, (used.get(c.front) || 0) + 1);
  const bestOf = (card, only) => {
    for (const strict of [true, false]) {
      let best = 0, bestScore = -Infinity;
      for (const f of FRONTS) {
        if (only && !f.clans.includes(only)) continue;
        const s = fit(card, f, used, { strict, capMult });
        if (s === -Infinity) continue;
        const v = s + rnd() * 0.5;
        if (v > bestScore) { bestScore = v; best = f.n; }
      }
      if (best) return best;
    }
    return 0;
  };
  const plan = [], stats = {};
  for (const c of shuffled(cards.filter(x => !x.front && rarities.includes(x.rarity)), rnd)) {
    const st = stats[c.rarity] = stats[c.rarity] || { sealed: 0, revealed: 0, topClan: 0, secondClan: 0, fallback: 0, short: 0 };
    st.sealed++;
    const clans = clansOf(c).map(x => x[0]);
    const roll = clans.length > 1 && rnd() >= top ? 1 : 0;
    const order = [clans[roll], clans[1 - roll]].filter(Boolean);
    let n = 0, clan = null;
    for (const k of order) if (!n && (n = bestOf(c, k))) clan = k;
    if (!n) n = bestOf(c, null);
    if (!n) { st.short++; continue; }
    used.set(n, (used.get(n) || 0) + 1);
    plan.push({ id: c.id, front: n, clan });
    st.revealed++;
    if (clan === clans[0]) st.topClan++; else if (clan && clan === clans[1]) st.secondClan++;
    if (clan !== order[0]) st.fallback++;
  }
  return { plan, stats, used };
}

/**
 * Claim promo for new 1 of 1 cards: after `start`, the claims numbered in `slots` (counted site-wide from 1) carry
 * the next unique card still unclaimed; every other claim is a normal one. Returns the unique's number or 0.
 */
export function promoUnique(claimIndex, { slots = [2, 4, 6, 8, 10], uniques = [], taken = new Set() } = {}) {
  if (!slots.includes(claimIndex)) return 0;
  return uniques.find(n => !taken.has(n)) || 0;
}

/**
 * Least-used reveal: every sealed card (any rarity) gets, inside its tiers, the front with the FEWEST copies right
 * now; equal counts go to the best fit (type, clans), then to `rnd`. Spreads the artworks so the same few fronts
 * don't keep coming back. Scarcest rarities pick first. Exclusive fronts never come out of a reveal.
 * @param {Array<{ no: number, rarity: string, type?: string, clans?: Array<[string, number]> }>} sealed
 * @param {Map<number, number>} used  front number -> copies already out (not changed; a copy is returned)
 * @returns {{ plan: Array<{ no: number, front: number }>, used: Map<number, number>, short: number[] }}
 */
export function planSpreadReveal(sealed, used, { rnd = Math.random, fronts = FRONTS } = {}) {
  const counts = new Map(used), plan = [], short = [];
  const cards = [...sealed].sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
  for (const card of cards) {
    let best = null;
    for (const f of fronts) {
      if (f.exclusive) continue;
      const s = fit(card, f, counts, { strict: false, capMult: Infinity });
      if (s === -Infinity) continue;
      const key = [counts.get(f.n) || 0, -s, rnd()];
      if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { f, key };
    }
    if (!best) { short.push(card.no); continue; }
    counts.set(best.f.n, (counts.get(best.f.n) || 0) + 1);
    plan.push({ no: card.no, front: best.f.n });
  }
  return { plan, used: counts, short };
}
