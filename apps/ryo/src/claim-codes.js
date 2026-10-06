// WL Batch 3: farm $RYO by sharing a claim code. Each code has 20 uses and pays its owner 100 $RYO per use;
// a fresh wallet that redeems a code gets 1 sealed card + 50 $RYO now and 50 more after the team review.
export const CODE_USES = 20;
export const PER_USE = 100;
export const WELCOME_NOW = 50;
export const WELCOME_AFTER_REVIEW = 50;
export const CODE_RE = /^PL-[A-Z0-9]{6}$/;

export const normalizeCode = c => String(c || '').trim().toUpperCase().replace(/^PL(?=[A-Z0-9]{6}$)/, 'PL-');

// '' when `wallet` may redeem `code`, otherwise the reason. Fresh = starting from zero.
export function redeemProblem({ code, owner, uses }, wallet, history) {
  if (!CODE_RE.test(code)) return 'bad-code';
  if (owner === wallet) return 'own-code';
  if (uses >= CODE_USES) return 'code-used-up';
  if (history.cards || history.ryoReceived || history.redeemed || history.ownsCode) return 'not-fresh';
  return '';
}

// The owner's notice after a use (`usesAfter` counts this one).
export const ownerNotice = (code, usesAfter) => 'Your code ' + code + ' was used. ' + (CODE_USES - usesAfter) + ' of ' + CODE_USES + ' uses left.';

// Post template for X: the code in the text (it's small on the image) and the share link with the preview.
export function postText(code, site = 'https://primatelegends.world') {
  return 'Grinding for more RYO coins 🫡🔥 @PrimateLegends\n\nUse my code ' + code + ' & let’s win together.\n\nLFG.\n\n' + site + '/c/' + code;
}
