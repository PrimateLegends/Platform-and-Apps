// Player levels. Each step up costs 100 XP more than the one before (280, 380, 480, ...), the same shape as a
// League of Legends match, but without its level 18 stop: levels run up to MAX_LEVEL.
//
//   cost(L -> L+1) = STEP_BASE + STEP_GROWTH * L
//   total(n)       = sum of the costs from level 1 to n - 1 = (n - 1) * (STEP_GROWTH * n / 2 + STEP_BASE)
//
// Everything here is integer math on BigInt-free numbers: the largest total (level 300) is about 4.5 million XP.

export const STEP_BASE = 180;
export const STEP_GROWTH = 100;
export const MAX_LEVEL = 300;

/** XP needed to go from `level` to `level + 1`. */
export function stepCost(level) {
  if (!Number.isInteger(level) || level < 1) throw new RangeError('level must be an integer >= 1');
  return STEP_BASE + STEP_GROWTH * level;
}

/** Total XP a player must have to stand at `level` (level 1 = 0 XP). */
export function totalFor(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError('level out of range');
  return (level - 1) * (STEP_GROWTH * level / 2 + STEP_BASE);
}

/**
 * Where a player stands for an XP total.
 * @param {number} xp
 * @returns {{ xp: number, level: number, inLevel: number, toNext: number, progress: number, maxed: boolean }}
 *   inLevel = XP earned inside the current level, toNext = XP the current step costs (0 at the top),
 *   progress = inLevel / toNext in [0, 1].
 */
export function standing(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  // Solve the quadratic for a first guess, then step to the exact level (float error never matters after this).
  const a = STEP_GROWTH / 2, b = STEP_BASE - STEP_GROWTH / 2, c = -STEP_BASE - total;
  let level = Math.floor((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a));
  level = Math.min(MAX_LEVEL, Math.max(1, level));
  while (level < MAX_LEVEL && totalFor(level + 1) <= total) level++;
  while (level > 1 && totalFor(level) > total) level--;
  const maxed = level === MAX_LEVEL;
  const inLevel = total - totalFor(level);
  const toNext = maxed ? 0 : stepCost(level);
  return { xp: total, level, inLevel, toNext, progress: maxed ? 1 : inLevel / toNext, maxed };
}

/** "Level 7 · 1,240 / 1,880 XP" style label. */
export function standingLabel(xp) {
  const s = standing(xp);
  const n = v => v.toLocaleString('en-US');
  return s.maxed ? 'Level ' + s.level + ' · ' + n(s.xp) + ' XP · max level' : 'Level ' + s.level + ' · ' + n(s.inLevel) + ' / ' + n(s.toNext) + ' XP';
}
