// Pay the rest with ETH. A buyer whose $RYO covers at least MIN_OWN_SHARE of a listing's price can pay the missing
// part in ETH on Ethereum mainnet. The ETH goes to the platform vault, the platform credits the buyer the matching
// $RYO, and the ordinary $RYO purchase runs (seller paid the full price minus the usual royalty).
//
// While the buyer pays, the listing is held for them (HOLD_MS, extended while their transaction confirms), so nobody
// pays ETH for a card someone else just took. If the card is gone anyway by the time the payment confirms, the
// credited $RYO stays with the buyer: ETH is never lost and never needs an on-chain refund.
//
// All amounts are BigInt wei / integer $RYO. Pure functions: pass `now`.

export const WEI_PER_RYO = 98_000_000_000n;        // 100,000 $RYO = 0.0098 ETH
export const MIN_PAYMENT_WEI = 450_000_000_000_000n; // 0.00045 ETH
export const MIN_OWN_SHARE_PCT = 10;               // the buyer's own $RYO must cover 10% of the price
export const HOLD_MS = 30_000;
export const CONFIRMING_HOLD_MS = 10 * 60_000;
export const CONFIRMATIONS = 2;

/**
 * The quote, or the reason there is none.
 * @param {{ price: number, seller: string }} listing
 * @param {{ wallet: string, balance: number }} buyer
 * @returns {{ ok: true, shortfall: number, wei: bigint, credit: number } | { ok: false, reason: string }}
 *   credit = $RYO the buyer will get for `wei` (more than the shortfall when the minimum payment applies)
 */
export function quote(listing, buyer) {
  if (listing.seller === buyer.wallet) return { ok: false, reason: 'own-listing' };
  const shortfall = listing.price - buyer.balance;
  if (shortfall <= 0) return { ok: false, reason: 'enough-ryo' };
  if (buyer.balance * 100 < listing.price * MIN_OWN_SHARE_PCT) return { ok: false, reason: 'need-more-ryo' };
  let wei = BigInt(shortfall) * WEI_PER_RYO;
  if (wei < MIN_PAYMENT_WEI) wei = MIN_PAYMENT_WEI;
  return { ok: true, shortfall, wei, credit: creditFor(wei) };
}

/** $RYO credited for what was actually paid (an overpay is credited too). */
export const creditFor = wei => Number(BigInt(wei) / WEI_PER_RYO);

/** "0.00294" from wei. */
export function formatEth(wei) {
  const s = BigInt(wei).toString().padStart(19, '0');
  return (s.slice(0, -18) + '.' + s.slice(-18)).replace(/0+$/, '').replace(/\.$/, '');
}

/** Who holds a listing right now: holds = [{ buyer, until }], newest last. */
export function holder(holds, now) {
  for (let i = holds.length - 1; i >= 0; i--) if (holds[i].until > now) return holds[i].buyer;
  return null;
}

/** A market action on a held listing is only open to the buyer holding it. */
export function actionAllowed(holds, wallet, now) {
  const h = holder(holds, now);
  return !h || h === wallet;
}

/**
 * Checks the buyer's transaction as the chain reports it.
 * @param {{ from: string, to: string, value: bigint, status: number, block: number | null }} tx  (block null = pending)
 * @returns {'confirmed' | 'pending' | 'wrong-sender' | 'wrong-recipient' | 'underpaid' | 'reverted' | 'used'}
 */
export function checkPayment(tx, { buyer, vault, wei, head, usedTx, hash }) {
  if (usedTx.has(hash)) return 'used';
  if (tx.to.toLowerCase() !== vault.toLowerCase()) return 'wrong-recipient';
  if (tx.from.toLowerCase() !== buyer.toLowerCase()) return 'wrong-sender';
  if (BigInt(tx.value) < BigInt(wei)) return 'underpaid';
  if (tx.block == null) return 'pending';
  if (tx.status !== 1) return 'reverted';
  return head - tx.block + 1 >= CONFIRMATIONS ? 'confirmed' : 'pending';
}

/**
 * What happens once a payment is confirmed.
 * @returns {{ credit: number, buy: boolean, reason?: string }}  buy = run the normal purchase now
 */
export function settle(listing, payment, now, holds = []) {
  const credit = creditFor(payment.paidWei);
  if (!listing || listing.status === 'sold') return { credit, buy: false, reason: 'card-gone' };
  if (listing.price !== payment.price || listing.seller !== payment.seller) return { credit, buy: false, reason: 'listing-changed' };
  if (!actionAllowed(holds, payment.buyer, now)) return { credit, buy: false, reason: 'held-by-someone-else' };
  return { credit, buy: true };
}
