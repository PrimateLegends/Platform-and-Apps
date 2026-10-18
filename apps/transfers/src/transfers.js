// Internal card transfers inside the Pre-Market (off-chain, before the cards migrate on-chain).
// A player sends cards from their vault to any wallet address. A wallet that never signed in still receives them:
// the page only warns, and the cards wait in that wallet's vault until its first sign-in.

export const TRANSFER = Object.freeze({
  feePerCard: 5,          // $RYO per card, paid to the vault
  maxCards: 20,           // cards per signed transfer
  burst: 7,               // transfers allowed inside the window before a captcha is asked
  windowMs: 2 * 60 * 1000,
  claimHoldMs: 48 * 3600 * 1000,
  packHoldMs: 72 * 3600 * 1000,
  // A card that arrived by transfer can be listed at once, but sold to the vault only after this wait: otherwise a
  // fresh wallet could take over the weekly vault-sale allowance of another one.
  vaultSaleWaitMs: 7 * 24 * 3600 * 1000
});
const ADDRESS = /^0x[0-9a-f]{40}$/;
const CLAIMED = new Set(['claim', 'daily-claim']);

export const fee = count => count * TRANSFER.feePerCard;

/** ms timestamp when a card may move, or 0 when it can move now. card = { origin: 'pack' | 'claim' | ..., pulledAt } */
export function heldUntil(card, now) {
  const hold = card.origin === 'pack' ? TRANSFER.packHoldMs : CLAIMED.has(card.origin) ? TRANSFER.claimHoldMs : 0;
  const until = card.pulledAt + hold;
  return hold && until > now ? until : 0;
}

/** ms timestamp when the vault buys a card received by transfer, or 0 when it can sell now. receivedAt: null = not transferred. */
export function vaultSaleOpensAt(receivedAt, now) {
  if (!Number.isFinite(receivedAt)) return 0;
  const at = receivedAt + TRANSFER.vaultSaleWaitMs;
  return at > now ? at : 0;
}

/**
 * Escrow swaps follow the same holds as the market: a card on its pack or claim hold can't be locked or swapped.
 * @returns {string} '' or the hold code
 */
export function escrowProblem(card, now) {
  if (card.location !== 'vault') return card.location === 'listed' ? 'listed' : 'in-escrow';
  if (heldUntil(card, now)) return card.origin === 'pack' ? 'pack-hold' : 'claim-hold';
  return '';
}

/**
 * First problem with a transfer, or '' when it can go. Every check runs before anything moves.
 * @param {{ from: string, to: string, cards: number[], vault: Map<number, {location: 'vault'|'listed'|'escrow', origin: string, pulledAt: number}>,
 *           balance: number, now: number }} t
 */
export function transferProblem({ from, to, cards, vault, balance, now }) {
  from = String(from).toLowerCase(); to = String(to).toLowerCase();
  if (!ADDRESS.test(to)) return 'bad-recipient';
  if (to === from) return 'same-wallet';
  if (!cards.length || new Set(cards).size !== cards.length) return 'bad-cards';
  if (cards.length > TRANSFER.maxCards) return 'too-many-cards';
  for (const no of cards) {
    const c = vault.get(no);
    if (!c) return 'not-yours';
    if (c.location === 'listed') return 'listed';
    if (c.location === 'escrow') return 'in-escrow';
    if (heldUntil(c, now)) return c.origin === 'pack' ? 'pack-hold' : 'claim-hold';
  }
  if (balance < fee(cards.length)) return 'insufficient-ryo';
  return '';
}

/** Burst rule: the (burst + 1)th transfer inside the window needs a solved captcha. times = past transfer times. */
export function needsCaptcha(times, now) {
  return times.filter(t => now - t < TRANSFER.windowMs).length >= TRANSFER.burst;
}

/** Recipient notice. registered = the wallet signed in on the site at least once. */
export function recipientNotice(cards, fromShort, registered) {
  const what = cards.length === 1 ? 'Card #' + String(cards[0]).padStart(5, '0') : cards.length + ' cards';
  return { title: 'Card received', text: what + ' arrived from ' + fromShort, waiting: !registered };
}

/**
 * A wallet's own activity for the transfer page: transfers sent / received and cards bought, newest first.
 * @param {string} wallet
 * @param {{ from: string, to: string, cards: number[], at: number }[]} transfers
 * @param {{ buyer: string, seller: string, card: number, price: number, at: number, via: 'listing' | 'offer' }[]} sales
 */
export function walletActivity(wallet, transfers, sales, limit = 40) {
  const me = String(wallet).toLowerCase();
  const rows = [];
  for (const t of transfers) {
    if (t.from === me) rows.push({ kind: 'sent', other: t.to, cards: t.cards, at: t.at });
    else if (t.to === me) rows.push({ kind: 'received', other: t.from, cards: t.cards, at: t.at });
  }
  for (const s of sales) if (s.buyer === me) rows.push({ kind: s.via === 'offer' ? 'offer-won' : 'bought', other: s.seller, cards: [s.card], price: s.price, at: s.at });
  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}
