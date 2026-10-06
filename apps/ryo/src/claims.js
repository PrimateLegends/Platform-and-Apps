// Claims after the Early Primates claim (303 cards, sold out): a daily claim with no total cap. Every claim
// mints a new sealed card; 7 days in a row adds a Bounty or a Dojo Book.
export const EARLY_CAP = 303;
export const STREAK_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export const claimKind = earlyClaimed => (earlyClaimed < EARLY_CAP ? 'early' : 'daily');
export const canClaim = (lastClaimAt, now = Date.now()) => !lastClaimAt || now - lastClaimAt >= DAY;

// Current streak from claim times: each claim within 48h of the previous one keeps it alive.
export function streak(times, now = Date.now()) {
  const t = times.slice().sort((a, b) => a - b);
  if (!t.length || now - t[t.length - 1] >= 2 * DAY) return 0;
  let run = 1;
  for (let i = t.length - 1; i > 0 && t[i] - t[i - 1] < 2 * DAY; i--) run++;
  return run;
}
// Reward on the claim that completes a 7-day run; `rand` in [0, 1).
export const streakReward = (run, rand = Math.random()) => (run > 0 && run % STREAK_DAYS === 0 ? (rand < 0.5 ? 'bounty' : 'dojo_book') : null);
