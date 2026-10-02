/**
 * Referral quest rules for the preview.
 *
 * - Any wallet can open a code. A code has `usesPerCode` uses and its owner may spend one on itself.
 * - When every use is spent the owner earns a Bounty and double whitelist chances.
 * - A wallet can earn at most `maxRewards` Bounties this way (a new code opens after one completes).
 * - Applicants stay pending until approved; approved applicants who came in with someone else's
 *   code earn a Bounty and a sealed card (once).
 * - Anti-farming: another person's code can't be used from the network that opened it, and each
 *   network gets a limited number of applications per day.
 *
 * - Batches: the whitelist opens in batches. Between batches everything pauses: no new codes, no
 *   applications, and existing codes don't validate. Codes and earned rewards are kept for later.
 *
 * Pure logic with an injectable clock and random source; the live site keeps this server-side.
 */
const DAY = 24 * 60 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const normalizeCode = raw => {
  const v = String(raw ?? '').trim().toUpperCase();
  return /^PL[A-Z0-9]{6}$/.test(v) ? `PL-${v.slice(2)}` : v;
};
export const isCode = code => /^PL-[A-Z0-9]{6}$/.test(code);

export function createReferralQuest({ usesPerCode = 3, maxRewards = 2, applicationsPerNetworkPerDay = 1, random = Math.random } = {}) {
  const codes = new Map();         // code -> { owner, network, uses, completed }
  const applications = new Map();  // wallet -> { code, own, network, at, rewarded }
  const approved = new Set();
  const events = [];               // rewards, newest last
  let open = true;                 // false between whitelist batches

  const openCodeOf = wallet => [...codes.entries()].find(([, c]) => c.owner === wallet && !c.completed)?.[0] ?? null;
  const rewardsOf = wallet => [...codes.values()].filter(c => c.owner === wallet && c.completed).length;

  function mint() {
    for (;;) {
      let code = 'PL-';
      for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
      if (!codes.has(code)) return code;
    }
  }

  return {
    events,

    /** Opens or closes the current whitelist batch. */
    setOpen(value) { open = !!value; },
    get open() { return open; },

    quest(wallet) {
      const code = openCodeOf(wallet);
      const earned = rewardsOf(wallet);
      return {
        code,
        uses: code ? codes.get(code).uses : 0,
        usesLeft: code ? usesPerCode - codes.get(code).uses : 0,
        earned,
        doubleChances: earned > 0,
        done: earned >= maxRewards,
        applied: applications.has(wallet),
        approved: approved.has(wallet),
        paused: !open
      };
    },

    openCode(wallet, network) {
      if (!open) return { ok: false, reason: 'closed' };
      const current = openCodeOf(wallet);
      if (current) return { ok: true, code: current };
      if (rewardsOf(wallet) >= maxRewards) return { ok: false, reason: 'quest-complete' };
      const code = mint();
      codes.set(code, { owner: wallet, network, uses: 0, completed: false });
      return { ok: true, code };
    },

    check(raw, wallet) {
      if (!open) return { valid: false, reason: 'closed' };
      const code = normalizeCode(raw);
      const entry = codes.get(code);
      if (!isCode(code) || !entry) return { valid: false, reason: 'unknown-code' };
      if (entry.uses >= usesPerCode) return { valid: false, reason: 'used-up' };
      return { valid: true, code, usesLeft: usesPerCode - entry.uses, own: entry.owner === wallet };
    },

    apply(wallet, raw, network, now = Date.now()) {
      if (!open) return { ok: false, reason: 'closed' };
      const code = normalizeCode(raw);
      const entry = codes.get(code);
      if (!entry) return { ok: false, reason: 'unknown-code' };
      if (entry.uses >= usesPerCode) return { ok: false, reason: 'used-up' };
      if (applications.has(wallet)) return { ok: false, reason: 'already-applied' };
      const own = entry.owner === wallet;
      if (!own && network === entry.network) return { ok: false, reason: 'same-network' };
      const today = [...applications.values()].filter(a => a.network === network && now - a.at < DAY).length;
      if (today >= applicationsPerNetworkPerDay) return { ok: false, reason: 'network-limit' };

      entry.uses++;
      applications.set(wallet, { code, own, network, at: now, rewarded: false });
      if (entry.uses === usesPerCode) {
        entry.completed = true;
        events.push({ type: 'quest-bounty', wallet: entry.owner, at: now });
      }
      return { ok: true, own, usesLeft: usesPerCode - entry.uses };
    },

    approve(wallet, now = Date.now()) {
      approved.add(wallet);
      const app = applications.get(wallet);
      if (!app || app.own || app.rewarded) return { rewarded: false };
      app.rewarded = true;
      events.push({ type: 'welcome-bounty-and-card', wallet, at: now });
      return { rewarded: true };
    }
  };
}
