// Pre-Market listings: sealed Legendary Cards listed by players for a fixed price in one currency.
// Pure functions over plain objects, so the same rules run in the browser, the server and tests.
import { currency } from './money.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'phantom'];
export const CARD_TYPES = ['attack', 'defense', 'evasion', 'healing'];
export const CLANS = ['ghost', 'rainbow', 'golden', 'ember', 'void', 'sakura', 'crimson', 'earth', 'onyx'];

/** Cards are off-chain until the on-chain migration; this is the ID shown everywhere until then. */
export function preMarketId(serial) {
  if (!Number.isInteger(serial) || serial < 1 || serial > 99_999) throw new RangeError('Card serials run from 1 to 99999');
  return `PM-${String(serial).padStart(5, '0')}`;
}

/** A sealed card only hints its clan; the market files it under the most likely one. */
export function likelyClan(card) {
  const hints = (card.hints && card.hints.clans) || [];
  return hints.reduce((best, h) => (!best || h[1] > best[1] ? h : best), null)?.[0] ?? null;
}

/**
 * Builds a listing. `payTo` is where the buyer sends the money: the seller's ETH address for ETH
 * listings, or one of the seller's linked Solana wallets for USDC listings.
 */
export function createListing({ id, card, seller, currency: code, price, payTo, listedAt }) {
  currency(code);
  if (typeof price !== 'bigint' || price <= 0n) throw new RangeError('Price must be a positive bigint');
  if (!/^0x[0-9a-f]{40}$/.test(seller)) throw new RangeError('Seller must be a lowercase ETH address');
  if (code === 'eth' && payTo !== seller) throw new RangeError('ETH listings are paid to the seller address');
  if (code === 'usdc' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payTo || '')) throw new RangeError('USDC listings need a Solana payout address');
  return Object.freeze({ id, card, seller, currency: code, price, payTo, listedAt, status: 'active' });
}

function matches(listing, f, skip) {
  const c = listing.card;
  if (f.currency && listing.currency !== f.currency) return false;
  if (f.currency && f.min != null && listing.price < f.min) return false;
  if (f.currency && f.max != null && listing.price > f.max) return false;
  if (skip !== 'rarity' && f.rarities?.length && !f.rarities.includes(c.rarity)) return false;
  if (skip !== 'type' && f.types?.length && !f.types.includes(c.hints?.type)) return false;
  if (skip !== 'clan' && f.clans?.length && !f.clans.includes(likelyClan(c))) return false;
  if (f.search && !String(c.serial).includes(String(f.search).replace(/^0+/, ''))) return false;
  return true;
}

const SORTS = {
  recent: (a, b) => b.listedAt - a.listedAt,
  // Prices in different currencies never compare by amount (no oracle): ETH first, then USDC.
  priceLow: (a, b) => (a.currency === b.currency ? (a.price < b.price ? -1 : a.price > b.price ? 1 : 0) : a.currency === 'eth' ? -1 : 1),
  priceHigh: (a, b) => (a.currency === b.currency ? (a.price > b.price ? -1 : a.price < b.price ? 1 : 0) : a.currency === 'eth' ? -1 : 1),
  rarity: (a, b) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity) || b.listedAt - a.listedAt,
  serial: (a, b) => a.card.serial - b.card.serial
};

/** Active listings that pass the filters, sorted. Price bounds only apply with a currency picked. */
export function query(listings, filters = {}, sort = 'recent') {
  const cmp = SORTS[sort];
  if (!cmp) throw new RangeError(`Unknown sort: ${sort}`);
  return listings.filter(l => l.status === 'active' && matches(l, filters)).sort(cmp);
}

/**
 * Counts for each filter option, like a marketplace sidebar: each group is counted with every
 * other filter applied but its own, so picking "Rare" doesn't zero out "Legendary".
 */
export function facets(listings, filters = {}) {
  const out = { rarity: {}, type: {}, clan: {} };
  for (const l of listings) {
    if (l.status !== 'active') continue;
    if (matches(l, filters, 'rarity')) out.rarity[l.card.rarity] = (out.rarity[l.card.rarity] || 0) + 1;
    const t = l.card.hints?.type;
    if (t && matches(l, filters, 'type')) out.type[t] = (out.type[t] || 0) + 1;
    const k = likelyClan(l.card);
    if (k && matches(l, filters, 'clan')) out.clan[k] = (out.clan[k] || 0) + 1;
  }
  return out;
}

/** Lowest active price per currency, or null. */
export function floor(listings, code) {
  let low = null;
  for (const l of listings) if (l.status === 'active' && l.currency === code && (low === null || l.price < low)) low = l.price;
  return low;
}
