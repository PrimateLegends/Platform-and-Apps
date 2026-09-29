/**
 * Free-claim supply for the preview. The free claim hands out a limited number of cards in total.
 * A claim is two steps: the card is first *held* for the wallet (so nobody can re-roll by leaving),
 * then *kept* when the player accepts it. Held cards count against the stock, and a hold that is
 * never accepted goes back to the pool after `holdTtl`.
 *
 * Pure logic, no storage: the live site runs the same idea server-side.
 */
export function createClaimSupply({ cap = 303, holdTtl = 24 * 60 * 60 * 1000 } = {}) {
  const holds = new Map();   // wallet -> { card, at }
  let kept = 0;

  function sweep(now) {
    for (const [wallet, hold] of holds) if (now - hold.at >= holdTtl) holds.delete(wallet);
  }

  return {
    /** { cap, kept, held, left } */
    status(now = Date.now()) {
      sweep(now);
      return { cap, kept, held: holds.size, left: Math.max(0, cap - kept - holds.size) };
    },

    /**
     * Holds a card for `wallet`. `roll()` is only called when the wallet has no hold yet,
     * so asking twice always returns the same card.
     */
    hold(wallet, roll, now = Date.now()) {
      sweep(now);
      const existing = holds.get(wallet);
      if (existing) return { ok: true, card: existing.card, again: true };
      if (kept + holds.size >= cap) return { ok: false, reason: 'sold-out' };
      const card = roll();
      holds.set(wallet, { card, at: now });
      return { ok: true, card, again: false };
    },

    /** Turns the wallet's hold into a kept card. */
    keep(wallet, now = Date.now()) {
      sweep(now);
      const hold = holds.get(wallet);
      if (!hold) return { ok: false, reason: 'nothing-held' };
      holds.delete(wallet);
      kept++;
      return { ok: true, card: hold.card };
    }
  };
}
