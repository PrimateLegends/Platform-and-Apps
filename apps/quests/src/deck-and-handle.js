// Quest 8 "Reinforce your deck", the X handle a player sets on the quests page, and the board's closed quests.

/* ---------- Quest 8 "Reinforce your deck" ---------- */

/**
 * The clan a wallet should reinforce: of the clans that have at least one card for sale, the one the wallet holds
 * the fewest cards of (vault, own listings and escrow all count as held). Ties go to the clan with more listings,
 * so the target is the easiest one to buy into; a last tie goes to the clan name, so the choice is stable.
 * @param {Record<string, number>} held      clan -> cards the wallet holds of it (a card counts for its top clan)
 * @param {Record<string, number>} listings  clan -> cards listed on the market right now
 * @returns {string | null}  null when nothing is for sale
 */
export function deckTarget(held, listings) {
  const open = Object.keys(listings).filter(c => listings[c] > 0);
  if (!open.length) return null;
  return open.sort((a, b) => (held[a] || 0) - (held[b] || 0) || listings[b] - listings[a] || a.localeCompare(b))[0];
}

export const DECK = Object.freeze({ reward: 'revealed-card-of-the-clan', odds: 'recruit', once: true });

/**
 * Whether a purchase completes Quest 8: bought after the quest opened for this wallet (start + new-account wait),
 * from a listing or an accepted offer, of a card that carries the target clan among its clans.
 * @param {{ at: number, via: string, clans: string[] }} purchase
 * @param {{ target: string | null, opensAt: number, done: boolean }} state
 */
export function deckCompletes(purchase, state) {
  if (state.done || !state.target || purchase.at < state.opensAt) return false;
  return ['listing', 'offer'].includes(purchase.via) && purchase.clans.includes(state.target);
}

/* ---------- the X handle on the quests page ---------- */

export const HANDLE = Object.freeze({ cooldownMs: 72 * 3600 * 1000, official: 'primatelegends' });

/**
 * A handle as people type it: "@Name", "name", "x.com/Name", "https://twitter.com/Name?s=20" all give "Name".
 * Returns '' when what's left isn't a valid X handle (1-15 letters, digits or underscores).
 */
export function cleanXHandle(input) {
  let s = String(input ?? '').trim();
  const link = s.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#\s]+)/i);
  if (link) s = link[1];
  s = s.replace(/^@+/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(s) ? s : '';
}

/**
 * Why a wallet can't set this handle now, or '' when it can. A handle set by hand is unverified: it shows on the
 * profile but doesn't count for the follow quest. Only the team wallet may set the official handle, and a handle
 * already linked to another wallet stays with it.
 * @param {{ wallet: string, input: string, now: number, lastSetAt?: number, isTeam?: boolean, ownerOf: (handleLower: string) => string | undefined }} req
 */
export function handleProblem({ wallet, input, now, lastSetAt = -Infinity, isTeam = false, ownerOf }) {
  const h = cleanXHandle(input);
  if (!h) return 'bad-handle';
  if (h.toLowerCase() === HANDLE.official && !isTeam) return 'official-handle';
  if (now - lastSetAt < HANDLE.cooldownMs) return 'cooldown';
  const owner = ownerOf(h.toLowerCase());
  if (owner && owner.toLowerCase() !== String(wallet).toLowerCase()) return 'taken';
  return '';
}

/** "Set again in 5h" while the 72 h lock runs, '' after. */
export const handleLockLabel = (lastSetAt, now) => {
  const left = lastSetAt + HANDLE.cooldownMs - now;
  return left > 0 ? 'Set again in ' + Math.ceil(left / 3600000) + 'h' : '';
};

/* ---------- the board ---------- */

/** Quests closed for good once their spots ran out (claims already made are still paid). */
export const CLOSED_QUESTS = Object.freeze(['follow', 'rarest']);
