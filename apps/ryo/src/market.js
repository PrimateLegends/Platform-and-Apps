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
