// Checkout: a buyer reserves a listing, pays the seller directly (wallet to wallet), and the card
// moves to the buyer's profile once the payment is confirmed on-chain. Nobody holds funds in between.
import { splitPayment } from './money.js';

export const RESERVATION_MS = 15 * 60 * 1000;

/** Reserves an active listing for one buyer. Sellers can't buy their own cards. */
export function reserve(listing, buyer, now) {
  if (listing.seller === buyer) throw new Error('own-listing');
  if (listing.status === 'reserved' && now < listing.reservedUntil) throw new Error('reserved');
  if (listing.status !== 'active' && listing.status !== 'reserved') throw new Error('not-for-sale');
  return { ...listing, status: 'reserved', buyer, reservedUntil: now + RESERVATION_MS };
}

/** A reservation that ran out goes back on the market. */
export function release(listing, now) {
  return listing.status === 'reserved' && now >= listing.reservedUntil
    ? { ...listing, status: 'active', buyer: undefined, reservedUntil: undefined }
    : listing;
}

/** Transfers a buyer has to send, in order. With a 0% fee there is only one. */
export function paymentPlan(listing, feeBps, vault) {
  const { seller, fee } = splitPayment(listing.price, feeBps);
  const plan = [{ to: listing.payTo, amount: seller, currency: listing.currency }];
  if (fee > 0n) plan.push({ to: vault[listing.currency], amount: fee, currency: listing.currency });
  return plan;
}

/**
 * Checks a confirmed payment against the plan. `transfers` are what the chain reports:
 * [{ from, to, amount, currency }]. A payment is accepted even after the reservation ran out,
 * as long as nobody else bought the card in the meantime; otherwise it is flagged for refund.
 */
export function settle(listing, { buyer, transfers, usedTx, tx }, plan, now) {
  if (usedTx.has(tx)) return { ok: false, reason: 'tx-already-used' };
  for (const step of plan) {
    const paid = transfers.filter(t => t.to === step.to && t.currency === step.currency).reduce((a, t) => a + t.amount, 0n);
    if (paid < step.amount) return { ok: false, reason: 'underpaid', refund: transfers.length > 0 };
  }
  const takenByOther = listing.status === 'sold' || (listing.status === 'reserved' && listing.buyer !== buyer && now < listing.reservedUntil);
  if (takenByOther) return { ok: false, reason: 'sold-to-someone-else', refund: true };
  return { ok: true, listing: { ...listing, status: 'sold', buyer, soldAt: now, tx } };
}
