// Quest board rules for the $RYO quests page: paused quests, the new-account wait, Quest 4 "Clan cashback" and
// Quest 5 "Onyx Recruiting".

// A paused quest stays on the board but takes no new claims; claims already made keep their payout.
export const PAUSE_REASONS = Object.freeze({ 'no-spots': 'No spots left' });

/**
 * What the board shows for one quest.
 * @param {{ id: string, paused?: string, claimed?: boolean }} quest
 * @returns {{ state: 'open' | 'claimed' | 'paused', label: string }}
 */
export function boardState(quest) {
  if (quest.claimed) return { state: 'claimed', label: 'Claimed' };
  if (quest.paused) return { state: 'paused', label: PAUSE_REASONS[quest.paused] || 'Paused' };
  return { state: 'open', label: 'Open' };
}

/**
 * New accounts: quests 4 and 5 only count purchases made `waitMs` after the wallet first showed up on the site.
 * "First showed up" is the earliest of everything the wallet ever did: sign-in, $RYO movement, market sale or
 * listing, card transfer, claimed card or pack. Purchases inside the wait never count, even after it ends.
 */
export const NEW_ACCOUNT_WAIT_MS = 48 * 3600 * 1000;

/**
 * @param {Array<number | null | undefined>} firstTimes  earliest time of each kind of activity (missing = never)
 * @param {number} now  used when the wallet was never seen: the wait starts now
 * @returns {number} ms timestamp from which purchases count
 */
export function questsOpenAt(firstTimes, now, waitMs = NEW_ACCOUNT_WAIT_MS) {
  const seen = firstTimes.filter(t => Number.isFinite(t) && t > 0);
  return (seen.length ? Math.min(...seen) : now) + waitMs;
}

/** "New account · opens in 7h" while waiting, '' once open. */
export function waitLabel(openAt, now) {
  if (openAt <= now) return '';
  return 'New account · opens in ' + Math.max(1, Math.ceil((openAt - now) / 3600000)) + 'h';
}

/**
 * Quest 4: the first listing bought from one of the wallet's 2 quest clans pays part of the price back, once.
 * The payout is the smallest of: `back` of the price, `back` of the card's estimated value (buying your own
 * listing from a second wallet at a silly price gains nothing) and a flat `cap` per wallet.
 */
export const CLAN_CASHBACK = Object.freeze({ back: 0.9, cap: 20000, minEarlierBuys: 2 });

/** @returns {{ amount: number, limitedBy: 'price' | 'estimate' | 'cap' }} */
export function clanCashback(price, estimate, { back = CLAN_CASHBACK.back, cap = CLAN_CASHBACK.cap } = {}) {
  const base = Math.min(price, estimate);
  const raw = Math.floor(base * back);
  if (raw > cap) return { amount: cap, limitedBy: 'cap' };
  return { amount: raw, limitedBy: estimate < price ? 'estimate' : 'price' };
}

/** Quest 5: buy ONYX.slots different Onyx cards on the market (listings or accepted offers), get 1 revealed card. */
export const ONYX = Object.freeze({ slots: 3, clan: 'onyx', reward: 'recruit-odds-card', once: true });

/**
 * Slots filled by a wallet's purchases. A purchase counts when it happened at or after `start`, the card carries the
 * Onyx clan among its clans, and that card number hasn't filled a slot already (buying a card back never counts twice).
 * @param {{ card: number, clans: string[], at: number, via: 'listing' | 'offer' }[]} purchases  oldest first
 * @param {{ start: number, slots?: number }} opts
 */
export function onyxProgress(purchases, { start, slots = ONYX.slots }) {
  const cards = [];
  for (const p of purchases) {
    if (cards.length >= slots) break;
    if (p.at < start || !['listing', 'offer'].includes(p.via)) continue;
    if (!p.clans.includes(ONYX.clan) || cards.includes(p.card)) continue;
    cards.push(p.card);
  }
  const left = slots - cards.length;
  return { cards, filled: cards.length, left, complete: left === 0, message: left ? leftMessage(left) : 'Quest 5 completed' };
}

/** "1 card left to complete Quest 5 Onyx Recruiting" */
export function leftMessage(left) {
  return left + (left === 1 ? ' card' : ' cards') + ' left to complete Quest 5 Onyx Recruiting';
}

/**
 * The reward is paid once per wallet: given who was paid already, returns whether this wallet gets it now.
 * @param {{ complete: boolean }} progress
 * @param {Set<string>} paid  wallets already rewarded
 */
export function rewardDue(wallet, progress, paid) {
  return progress.complete && !paid.has(String(wallet).toLowerCase());
}
