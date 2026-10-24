// Katana Brawl cards in a duel: a loadout of up to 5 different cards, each one usable once per MATCH (not per
// round), paid in Ki, cast in any state except lying on the ground. Last Breath is never cast by hand: it fires on
// its own, free, the moment its holder drops under 2 HP, and for 5 s nothing takes them below 1 HP.
import { RULES } from './rules.js';

export const AUTO_CARDS = Object.freeze(['last-breath']);

/** Why a loadout is refused, or '' when it is fine. */
export function loadoutProblem(cardIds, catalog) {
  if (!Array.isArray(cardIds)) return 'not-a-list';
  if (cardIds.length > RULES.cards.max) return 'too-many';
  if (new Set(cardIds).size !== cardIds.length) return 'duplicate';
  if (cardIds.some(id => !catalog.has(id))) return 'unknown-card';
  return '';
}

/**
 * A match-long ledger of played cards for one player. Rounds come and go; the ledger stays.
 */
export class CardLedger {
  #used = new Set();
  constructor(cardIds) { this.cards = Object.freeze(cardIds.slice()); }
  used(slot) { return this.#used.has(slot); }
  get usedSlots() { return [...this.#used].sort((a, b) => a - b); }

  /**
   * Try to cast the card in `slot` (0-based).
   * @param {{ state: string, ki: number }} caster
   * @param {(id: string) => { ki: number }} costOf
   * @returns {{ ok: boolean, reason?: string, ki?: number }}
   */
  cast(slot, caster, costOf) {
    const id = this.cards[slot];
    if (id === undefined) return { ok: false, reason: 'empty-slot' };
    if (AUTO_CARDS.includes(id)) return { ok: false, reason: 'auto' };
    if (this.#used.has(slot)) return { ok: false, reason: 'used' };
    if (caster.state === 'down' || caster.state === 'ko') return { ok: false, reason: 'on-the-ground' };
    const cost = costOf(id).ki;
    if (caster.ki < cost) return { ok: false, reason: 'ki' };
    this.#used.add(slot);
    return { ok: true, ki: caster.ki - cost };
  }

  /** Last Breath: fires once, free, when hp drops under the threshold. Returns the slot that fired, or -1. */
  autoCast(hp) {
    if (hp >= RULES.cards.lastBreathBelow) return -1;
    const slot = this.cards.findIndex((id, k) => id === 'last-breath' && !this.#used.has(k));
    if (slot >= 0) this.#used.add(slot);
    return slot;
  }
}
