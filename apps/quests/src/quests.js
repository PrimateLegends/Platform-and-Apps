// Quest board rules for the $RYO quests page: paused quests, and Quest 5 "Onyx Recruiting".

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
