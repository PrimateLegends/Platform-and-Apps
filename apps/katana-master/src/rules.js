// Katana Master: the rules of a duel, in one frozen table.
//
// Every number the referee needs lives here, in integer units so a duel replays identically in any language:
// HP and damage in hundredths (50 HP = 5000), Ki in tenths (10 Ki = 100), time in milliseconds, distance in
// sixteenths of an art pixel. Nothing in this file is ever written at run time: the table and its sub-tables are
// deep-frozen, so a script that imports the module cannot raise damage or shorten a cooldown.

const deepFreeze = o => {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
};

export const UNIT = deepFreeze({ hp: 100, ki: 10, px: 16 });

export const RULES = deepFreeze({
  tickMs: 10,                       // the referee steps the duel in fixed 10 ms ticks
  hp: 50 * UNIT.hp,
  // a basic cut deals 1; each further hit of an unbroken combo deals x1.25 more, growing up to the 5th hit
  hit: [100, 125, 156, 195, 244],   // floor(100 * 1.25^n), n = hits already in the combo (0..4)
  comboGapMs: 1100,                 // a combo breaks after this long without a hit
  airBonusPct: 120,                 // from the air onto a rival below
  attack: { windupMs: 120, activeMs: 80, recoverMs: 100, reachPx: 46, minGapMs: 185 },   // at most 5.4 cuts a second
  blockStunMs: 100,
  perfectBlockMs: 150,              // a guard raised this close to the blade lands a PERFECT block (+1 Ki)
  ki: {
    max: 10 * UNIT.ki,
    gainPct: 130,                   // every Ki gain is worth 1.3 Ki; fractions stay banked
    perDamage: 4 * UNIT.hp,         // the defender charges 1 Ki for every 4 damage taken
    perBlocks: 3,                   // ... and 1 Ki for every 3 blocked cuts
    comboAt: 2,                     // a combo that reaches 2 hits charges 1 Ki
  },
  teleport: { ki: 1 * UNIT.ki, chain: 4, chainWindowMs: 3000, restMs: 10000 },
  dash: { px: 57, ms: 150 },
  backflip: { px: 60, ms: 292 },
  walkPxPerS: 74,
  round: { limitMs: 210000, toWin: 2, max: 3 },   // best of three, 3:30 a round; the third round is fought in a storm
  arena: { minPx: 24, maxPx: 680, startGapPx: 72 },
  cards: { max: 5, lastBreathBelow: 2 * UNIT.hp, lastBreathGraceMs: 5000 },
});

export const STATES = deepFreeze(['idle', 'walk', 'attack', 'block', 'hit', 'dash', 'down', 'ko']);
