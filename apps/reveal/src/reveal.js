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
export function fit(card, f, used, { strict = true } = {}) {
  const tiers = TIERS[card.rarity];
  if (!tiers) throw new Error('unknown rarity: ' + card.rarity);
  const tier = tiers.indexOf(f.rarity);
  const copies = used.get(f.n) || 0;
  if (tier < 0 || copies >= COPY_CAP[f.rarity]) return -Infinity;
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
