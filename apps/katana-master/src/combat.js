// Damage and Ki: pure functions over the frozen rules, all in integer units.
import { RULES, UNIT } from './rules.js';

/**
 * Damage of one landed cut, in hundredths of HP.
 * @param {number} comboHits  hits the attacker already landed in this combo
 * @param {{ aerial?: boolean, mulPct?: number }} [o]  aerial: from the air onto a rival below; mulPct: the move's own
 *   multiplier (the shadow kick deals 200)
 */
export function cutDamage(comboHits, { aerial = false, mulPct = 100 } = {}) {
  const base = RULES.hit[Math.max(0, Math.min(RULES.hit.length - 1, comboHits | 0))];
  const air = aerial ? RULES.airBonusPct : 100;
  return Math.floor(base * air * mulPct / 10000);
}

/** The combo after a hit at `now`: a gap longer than comboGapMs starts it over. */
export function nextCombo(combo, lastHitAt, now) {
  return now - lastHitAt > RULES.comboGapMs ? 1 : combo + 1;
}

/**
 * Ki as a wallet with a bank: every gain of `n` Ki adds n x 1.3 to the bank; the whole tenths are spendable and the
 * rest waits for the next gain. Capped at RULES.ki.max.
 * @param {{ ki: number, bank: number }} w   ki and bank in tenths of Ki (bank holds hundredths of a tenth)
 */
export function gainKi(w, n = 1) {
  const bank = w.bank + n * UNIT.ki * RULES.ki.gainPct;   // in hundredths of a tenth
  const whole = Math.floor(bank / 100);
  return { ki: Math.min(RULES.ki.max, w.ki + whole), bank: w.ki + whole >= RULES.ki.max ? 0 : bank - whole * 100 };
}

/** Spend Ki (tenths); null when the wallet can't pay. */
export function spendKi(w, tenths) {
  return w.ki >= tenths ? { ki: w.ki - tenths, bank: w.bank } : null;
}

/**
 * Ki the defender earns from a hit: one per full RULES.ki.perDamage of damage taken (the remainder carries over).
 * @returns {{ gains: number, carry: number }}
 */
export function kiFromDamage(carry, dmg) {
  const total = carry + dmg;
  return { gains: Math.floor(total / RULES.ki.perDamage), carry: total % RULES.ki.perDamage };
}

/**
 * Teleports: each costs Ki; up to `chain` in a row, each within chainWindowMs of the last, then a rest.
 * @param {{ count: number, lastAt: number, restUntil: number }} t
 * @returns {{ ok: boolean, reason?: 'rest' | 'ki', next?: object }}
 */
export function teleport(t, ki, now) {
  if (now < t.restUntil) return { ok: false, reason: 'rest' };
  if (ki < RULES.teleport.ki) return { ok: false, reason: 'ki' };
  const count = now - t.lastAt <= RULES.teleport.chainWindowMs ? t.count + 1 : 1;
  const restUntil = count >= RULES.teleport.chain ? now + RULES.teleport.restMs : 0;
  return { ok: true, next: { count: restUntil ? 0 : count, lastAt: now, restUntil } };
}

/** A guard raised within perfectBlockMs before the blade lands is PERFECT. */
export const isPerfectBlock = (guardAt, hitAt) => hitAt - guardAt >= 0 && hitAt - guardAt <= RULES.perfectBlockMs;
