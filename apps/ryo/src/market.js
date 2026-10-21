// Pre-Market rules in $RYO: listings are $RYO only (ETH and USDC are paused), the vault buys any card at 80%
// of its estimated value but only 3 times per wallet every 7 days, so most trades happen between players.
import { RYO_PER_ETH } from './ledger.js';

export const PRICE_MIN = 1_000;            // listing floor
export const PRICE_MAX = 10_000_000;       // sanity cap
export const OPEN_CURRENCIES = ['ryo'];
export const VAULT_BUY_SHARE = 0.8;
export const VAULT_SALES_PER_WEEK = 3;
const WEEK = 7 * 24 * 60 * 60 * 1000;

export const ryoFromEth = eth => Math.round(eth * RYO_PER_ETH);
export const ethFromRyo = ryo => ryo / RYO_PER_ETH;

// '' when the listing can be posted, otherwise the reason.
export function listingProblem({ price, currency = 'ryo' }) {
  if (!OPEN_CURRENCIES.includes(currency)) return 'currency-paused';
  if (!Number.isInteger(price) || price < PRICE_MIN || price > PRICE_MAX) return 'bad-price';
  return '';
}

// What the vault pays right now for a card worth `estimateRyo`.
export const vaultQuote = estimateRyo => Math.floor(estimateRyo * VAULT_BUY_SHARE);

// Rolling weekly limit: { left, resetAt } from the times of a wallet's earlier vault sales.
export function vaultSalesLeft(saleTimes, now = Date.now()) {
  const recent = saleTimes.filter(t => t > now - WEEK).sort((a, b) => a - b);
  const left = Math.max(0, VAULT_SALES_PER_WEEK - recent.length);
  return { left, resetAt: left ? null : recent[recent.length - VAULT_SALES_PER_WEEK] + WEEK };
}

/**
 * The vault lists its own cards at their estimated value. That price is stored when it lists, so when estimates
 * move, old vault listings must follow; otherwise a card bought from the vault below today's estimate could be
 * sold straight back at 80% of the new one. Player listings are never touched.
 * @param {Array<{ card: number, seller: string, price: number }>} listings
 * @param {(card: number) => number} estimateOf  today's estimate in $RYO
 * @returns {Array<{ card: number, from: number, to: number }>} the vault listings whose price changes
 */
export function vaultRepricing(listings, estimateOf, vault) {
  return listings
    .filter(l => l.seller === vault)
    .map(l => ({ card: l.card, from: l.price, to: estimateOf(l.card) }))
    .filter(x => x.to > 0 && x.to !== x.from);
}

/** True when buying from the vault and selling the card straight back would pay. */
export const vaultArbitrage = (listPrice, estimateRyo) => vaultQuote(estimateRyo) > listPrice;

/**
 * The vault never bids above the market for the common tiers: Common, Uncommon and Rare cards get the lower of the
 * normal quote and FLOOR_SHARE of the floor of their rarity. With no listing of that rarity the cheapest listing of
 * any card is the reference; with an empty market, 115% of the card's estimate. Legendary and Astral keep the quote.
 * @param {{ rarity: string, estimate: number }} card
 * @param {Record<string, number>} floors  rarity -> cheapest listing, plus `any`
 */
export const FLOOR_CAPPED = Object.freeze(['common', 'uncommon', 'rare']);
export const FLOOR_SHARE = 0.8;
export function vaultBid(card, floors = {}) {
  const full = vaultQuote(card.estimate);
  if (!FLOOR_CAPPED.includes(card.rarity)) return full;
  const ref = floors[card.rarity] ?? floors.any ?? Math.round(card.estimate * 1.15);
  return Math.max(0, Math.min(full, Math.floor(ref * FLOOR_SHARE)));
}
