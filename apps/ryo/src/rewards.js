// Team rewards and anti-bot pacing for the $RYO Pre-Market.

// Loyalty reward: every registered wallet gets `base`; wallets with `minClaims`+ free claims get `bonus` on top.
// System wallets never receive it. Paying is resumable: wallets already paid are skipped, so nobody is paid twice.
export const LOYALTY = Object.freeze({ base: 1500, bonus: 3000, minClaims: 3 });

/**
 * @param {string[]} wallets  registered wallets (signed in on the site or hold cards)
 * @param {Record<string, number>} claims  free claims per wallet
 * @param {{ skip?: Iterable<string>, paid?: Iterable<string>, limit?: number }} opts
 * @returns {{ batch: {wallet: string, amount: number}[], remaining: number, total: number }}
 */
export function loyaltyBatch(wallets, claims, { skip = [], paid = [], limit = 300 } = {}) {
  const no = new Set([...skip].map(w => String(w).toLowerCase()));
  const done = new Set([...paid].map(w => String(w).toLowerCase()));
  const rows = [...new Set(wallets.map(w => String(w).toLowerCase()))]
    .filter(w => /^0x[0-9a-f]{40}$/.test(w) && !no.has(w) && !done.has(w))
    .sort()
    .map(wallet => ({ wallet, amount: LOYALTY.base + ((claims[wallet] || 0) >= LOYALTY.minClaims ? LOYALTY.bonus : 0) }));
  const batch = rows.slice(0, Math.max(1, Math.min(400, limit)));
  return { batch, remaining: rows.length - batch.length, total: batch.reduce((s, r) => s + r.amount, 0) };
}

// Captcha pacing: free actions up to RATE_FREE per window, then one solved captcha covers the next
// CAPTCHA_PASSES market actions before it is asked again.
export const RATE_FREE = 3;
export const CAPTCHA_PASSES = 4;

/** Next state after one market action. state = { recent, credit }. Returns { needsCaptcha, state }. */
export function captchaStep(state, solvedCaptcha) {
  const s = { recent: state.recent || 0, credit: state.credit || 0 };
  if (s.recent < RATE_FREE) return { needsCaptcha: false, state: { ...s, recent: s.recent + 1 } };
  if (s.credit > 0) return { needsCaptcha: false, state: { recent: s.recent + 1, credit: s.credit - 1 } };
  if (!solvedCaptcha) return { needsCaptcha: true, state: s };
  return { needsCaptcha: false, state: { recent: s.recent + 1, credit: CAPTCHA_PASSES } };
}

// Team listings seeded from the vault can use a fixed price band (e.g. 3,000-8,000), rounded to 50.
export function bandPrice(lo, hi, rnd = Math.random) {
  if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1000 && lo <= hi)) throw new Error('bad-price');
  return Math.min(hi, Math.max(lo, Math.round((lo + rnd() * (hi - lo)) / 50) * 50));
}
