/**
 * Pack and card rolls: rarity, card back, serial number and the sealed-card hints.
 */
import { BACKS, CARDS_PER_PACK, CARD_TYPES, CLANS, MAX_SERIAL, RARITIES } from '../data/catalog.js';
import { between, random, weighted, weightedDistinct } from './random.js';

const rank = rarity => RARITIES.indexOf(rarity);

/** Six rarities for a pack, honouring its guarantee (e.g. "at least one Rare"). */
export function rollRarities(pack) {
  const out = Array.from({ length: CARDS_PER_PACK }, () => weighted(pack.odds));
  if (pack.guarantee) {
    const best = out.reduce((a, b) => (rank(b) > rank(a) ? b : a));
    if (rank(best) < rank(pack.guarantee)) out[out.length - 1] = pack.guarantee;
  }
  return out.sort((a, b) => rank(a) - rank(b));
}

export function rollBack() {
  return weighted(Object.fromEntries(BACKS.map(b => [b.id, b.weight])));
}

/**
 * Hints shown while a card is sealed: one card type and a guess of its clan.
 * Clan packs always point at their own clan; other cards list three clans weighted by population.
 */
export function rollHints(pack) {
  const types = Object.keys(CARD_TYPES);
  const type = types[Math.floor(random() * types.length)];
  if (pack?.clan) return { type, clans: [[pack.clan, 100]] };

  const picks = weightedDistinct(Object.fromEntries(CLANS.map(c => [c.id, c.population])), 3);
  const first = between(45, 70);
  const second = between(15, 95 - first);
  const shares = [first, second, 100 - first - second].sort((a, b) => b - a);
  return { type, clans: picks.map((id, i) => [id, shares[i]]) };
}

/** A serial number in 1..99999 that is not in `taken`. */
export function rollSerial(taken) {
  for (;;) {
    const n = between(1, MAX_SERIAL);
    if (!taken.has(n)) return n;
  }
}
