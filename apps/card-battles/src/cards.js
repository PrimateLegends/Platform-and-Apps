/**
 * Card definitions for Primate Legends: Card Battles (rules v1).
 *
 * Kinds
 *   warrior   - a Primate on the board with ATK and DEF (DEF is its health). Its style is one of
 *               attack / defense / evasion / technique and says what the warrior is built for.
 *   tactic    - a one-shot action with a speed: instant (no answer possible, you keep the action),
 *               swift (can be played in combat, the rival may answer), ritual (outside combat only).
 *   equipment - weapons and armor: equip to a warrior; returns to your hand if that warrior falls.
 *   item      - food, charms, scrolls: `attach` items stick to one warrior, `inPlay` items sit on the board.
 *   location  - places of the archipelago: take a board slot, can't attack, block or be damaged.
 *
 * Keywords (fixed vocabulary, see docs/card-battles.md):
 *   firstStrike, twinStrike, shadow, sharpeye, intimidate, breakthrough, challenge, dodge, ironSkin,
 *   spellWard, lifesteal, regenerate, bloodlust, mirage
 *
 * Stat budget for warriors (ATK + DEF by KI cost): 1:3 2:4 3:5 4:6-7 5:8 6:9 7:11 8:12-13 9:14-15.
 * Strong effects cost 1-2 points, drawbacks give 1-2 back, Legendary +1, Exclusive +3-4 at KI 8-9.
 */

export const KEYWORDS = ['firstStrike', 'twinStrike', 'shadow', 'sharpeye', 'intimidate', 'breakthrough', 'challenge',
  'dodge', 'ironSkin', 'spellWard', 'lifesteal', 'regenerate', 'bloodlust', 'mirage'];

export const SPEED = {
  instant: 'instant', // resolves at once, the rival can't answer, you keep the action
  swift: 'swift',     // can be played during combat, the rival may answer
  ritual: 'ritual'    // only outside combat, the rival may answer
};

/** Clans and what each one stands out at (an accent, not a limit: every clan has every kind of card). */
export const CLANS = {
  phantom: 'evasion', void: 'evasion',
  prism: 'attack', golden: 'attack', crimson: 'attack',
  earth: 'defense', onyx: 'defense',
  sakura: 'healing', ember: 'healing'
};
/** Cards from these groups fit any deck and never count toward the 2-clan limit. */
export const SHARED = ['neutral', 'armory', 'wiko'];

/** @typedef {{ id:string, name:string, clan:string, kind:'warrior'|'tactic'|'equipment'|'item'|'location',
 *   rarity:'common'|'rare'|'epic'|'legendary', exclusive?:boolean, cost:number, style?:string,
 *   atk?:number, def?:number, keywords?:string[], speed?:string, effect?:object,
 *   ascend?:{ when:object, atk:number, def:number, keywords?:string[] } }} CardDef */

/** @type {CardDef[]} A starter set taken from the real catalog (used by the tests and the demo decks). */
export const CARDS = [
  // Crimson (attack & burst): duelists
  { id: 'wandering-blade', name: 'Wandering Blade', clan: 'crimson', kind: 'warrior', rarity: 'common', cost: 1, style: 'attack', atk: 2, def: 1, keywords: ['firstStrike'] },
  { id: 'crimson-duelist', name: 'Crimson Duelist', clan: 'crimson', kind: 'warrior', rarity: 'legendary', cost: 4, style: 'attack', atk: 4, def: 3, keywords: ['challenge'],
    ascend: { when: { kills: 2 }, atk: 2, def: 2, keywords: ['firstStrike'] } },
  { id: 'red-storm-ronin', name: 'Red Storm Ronin', clan: 'crimson', kind: 'warrior', rarity: 'epic', cost: 5, style: 'attack', atk: 5, def: 3, keywords: ['bloodlust'] },
  // Golden (attack & burst): teachers and banners
  { id: 'golden-novice', name: 'Golden Novice', clan: 'golden', kind: 'warrior', rarity: 'common', cost: 2, style: 'attack', atk: 3, def: 1 },
  { id: 'golden-general', name: 'Golden General', clan: 'golden', kind: 'warrior', rarity: 'legendary', cost: 5, style: 'attack', atk: 5, def: 4,
    effect: { onPlay: { buffOthers: { atk: 1, def: 1 } } }, ascend: { when: { strikes: 2 }, atk: 1, def: 1 } },
  // Earth (defense + escapes): farmers and monks
  { id: 'harvest-guard', name: 'Harvest Guard', clan: 'earth', kind: 'warrior', rarity: 'common', cost: 2, style: 'defense', atk: 1, def: 3, keywords: ['ironSkin'] },
  { id: 'waterfall-monk', name: 'Waterfall Monk', clan: 'earth', kind: 'warrior', rarity: 'epic', cost: 4, style: 'defense', atk: 2, def: 5, keywords: ['ironSkin', 'regenerate'] },
  { id: 'sky-disciple', name: 'Sky Disciple', clan: 'earth', kind: 'warrior', rarity: 'common', cost: 2, style: 'evasion', atk: 2, def: 2, keywords: ['intimidate'] },
  // Onyx (defense + escapes): ninjas who vanish
  { id: 'moon-watch', name: 'Moon Watch', clan: 'onyx', kind: 'warrior', rarity: 'epic', cost: 4, style: 'defense', atk: 2, def: 5, keywords: ['sharpeye', 'ironSkin'] },
  // Void / Phantom (evasion)
  { id: 'phase-thief', name: 'Phase Thief', clan: 'void', kind: 'warrior', rarity: 'common', cost: 2, style: 'evasion', atk: 2, def: 1, keywords: ['shadow'] },
  { id: 'wisp-dancer', name: 'Wisp Dancer', clan: 'phantom', kind: 'warrior', rarity: 'rare', cost: 2, style: 'evasion', atk: 2, def: 2, keywords: ['dodge'] },
  // Sakura / Ember (healing + attack)
  { id: 'flame-drinker', name: 'Flame Drinker', clan: 'ember', kind: 'warrior', rarity: 'rare', cost: 3, style: 'attack', atk: 3, def: 2, keywords: ['lifesteal'] },
  { id: 'ember-berserker', name: 'Ember Berserker', clan: 'ember', kind: 'warrior', rarity: 'epic', cost: 5, style: 'attack', atk: 5, def: 2, keywords: ['twinStrike'] },
  { id: 'petal-healer', name: 'Petal Healer', clan: 'sakura', kind: 'warrior', rarity: 'common', cost: 1, style: 'technique', atk: 1, def: 2, effect: { roundEnd: { healWeakest: 2 } } },
  // Shared tactics, equipment, items and locations (any deck)
  { id: 'kunai-volley', name: 'Kunai Volley', clan: 'neutral', kind: 'tactic', rarity: 'common', cost: 2, speed: 'swift', effect: { damage: 2, orPoints: true } },
  { id: 'iaijutsu', name: 'Iaijutsu', clan: 'neutral', kind: 'tactic', rarity: 'epic', cost: 6, speed: 'swift', effect: { defeat: true } },
  { id: 'iron-resolve', name: 'Iron Resolve', clan: 'neutral', kind: 'tactic', rarity: 'common', cost: 1, speed: 'instant', effect: { buff: { def: 3 }, grant: 'ironSkin', thisRound: true } },
  { id: 'ofuda-seal', name: 'Ofuda Seal', clan: 'neutral', kind: 'tactic', rarity: 'rare', cost: 2, speed: 'swift', effect: { seal: true } },
  { id: 'shuriken-storm', name: 'Shuriken Storm', clan: 'neutral', kind: 'tactic', rarity: 'epic', cost: 5, speed: 'ritual', effect: { damageAllEnemies: 2 } },
  { id: 'war-conch', name: 'War Conch', clan: 'neutral', kind: 'tactic', rarity: 'rare', cost: 3, speed: 'ritual', effect: { takeToken: true } },
  { id: 'midnight-study', name: 'Midnight Study', clan: 'neutral', kind: 'tactic', rarity: 'common', cost: 3, speed: 'ritual', effect: { draw: 2 } },
  { id: 'golden-katana', name: 'Golden Katana', clan: 'armory', kind: 'equipment', rarity: 'legendary', cost: 3, effect: { buff: { atk: 3 }, grant: 'breakthrough' } },
  { id: 'echo-katana', name: 'Echo Katana', clan: 'armory', kind: 'equipment', rarity: 'legendary', cost: 4, effect: { buff: { atk: 2 }, echo: true } },
  { id: 'lacquer-armor', name: 'Lacquer Armor', clan: 'armory', kind: 'equipment', rarity: 'rare', cost: 3, effect: { buff: { def: 3 }, grant: 'ironSkin' } },
  { id: 'healers-kit', name: "Healer's Kit", clan: 'neutral', kind: 'item', rarity: 'common', cost: 1, effect: { attach: { def: 1 }, grant: 'regenerate' } },
  { id: 'spirit-tea', name: 'Spirit Tea', clan: 'neutral', kind: 'item', rarity: 'common', cost: 1, effect: { inPlay: true, roundStart: { healAllies: 1 } } },
  { id: 'spirit-spring', name: 'Spirit Spring', clan: 'wiko', kind: 'location', rarity: 'epic', cost: 4, effect: { roundStart: { spareKi: 1 } } },
  { id: 'nine-valleys', name: 'The Nine Valleys', clan: 'wiko', kind: 'location', rarity: 'epic', cost: 4, effect: { roundStart: { buffAllies: { def: 1 } } } },
  // An exclusive (3 copies exist in the world): expensive and stronger than any Legendary
  { id: 'the-cloak', name: 'The Cloak', clan: 'neutral', kind: 'warrior', rarity: 'legendary', exclusive: true, cost: 9, style: 'attack', atk: 9, def: 9,
    effect: { onPlay: { damageAllEnemies: 1 } } },
  // Starter scrolls: free basic commons that fill any collection up to a legal deck
  { id: 'starter-recruit', name: 'Starter Recruit', clan: 'neutral', kind: 'warrior', rarity: 'common', starter: true, cost: 2, style: 'attack', atk: 2, def: 2 },
  { id: 'starter-guard', name: 'Starter Guard', clan: 'neutral', kind: 'warrior', rarity: 'common', starter: true, cost: 3, style: 'defense', atk: 1, def: 4 }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

export const DECK_SIZE = 40;
export const MAX_COPIES = 3;
export const MAX_CLANS = 2;
export const MAX_LEGENDARY = 6;
export const MAX_EXCLUSIVE = 1;

/** Stat budget: the ATK+DEF range a warrior of this cost should land in (before rarity and effects). */
export const BUDGET = { 0: [2, 3], 1: [3, 3], 2: [4, 4], 3: [5, 5], 4: [6, 7], 5: [8, 8], 6: [9, 9], 7: [11, 11], 8: [12, 13], 9: [14, 15], 10: [15, 16] };

/** How far a warrior is from the budget (0 = on budget). Exclusives may sit 3-4 above, Legendaries 1 above. */
export function budgetDelta(card) {
  if (card.kind !== 'warrior') return 0;
  const [lo, hi] = BUDGET[card.cost];
  const total = card.atk + card.def;
  return total < lo ? total - lo : total > hi ? total - hi : 0;
}

/** Checks a deck list ({ cardId: copies }). Returns a list of problems (empty = legal). */
export function validateDeck(list) {
  const problems = [];
  let size = 0, legendary = 0, exclusive = 0;
  const clans = new Set();
  for (const [id, copies] of Object.entries(list)) {
    const card = CARD_BY_ID[id];
    if (!card) { problems.push(`unknown card ${id}`); continue; }
    if (copies > MAX_COPIES && !card.starter) problems.push(`${card.name}: at most ${MAX_COPIES} copies`);
    if (card.exclusive && copies > 1) problems.push(`${card.name}: exclusives are limited to 1 copy`);
    if (!SHARED.includes(card.clan)) clans.add(card.clan);
    if (card.rarity === 'legendary') legendary += copies;
    if (card.exclusive) exclusive += copies;
    size += copies;
  }
  if (size !== DECK_SIZE) problems.push(`deck has ${size} cards, needs ${DECK_SIZE}`);
  if (clans.size > MAX_CLANS) problems.push(`deck uses ${clans.size} clans, max ${MAX_CLANS}`);
  if (legendary > MAX_LEGENDARY) problems.push(`deck has ${legendary} Legendary cards, max ${MAX_LEGENDARY}`);
  if (exclusive > MAX_EXCLUSIVE) problems.push(`deck has ${exclusive} Exclusive cards, max ${MAX_EXCLUSIVE}`);
  return problems;
}

/** Fills a short collection with Starter scrolls so every player has a legal 40-card deck. */
export function fillWithStarters(list) {
  const out = { ...list };
  let size = Object.values(out).reduce((a, b) => a + b, 0);
  const starters = CARDS.filter(c => c.starter);
  for (let i = 0; size < DECK_SIZE; i++, size++) {
    const id = starters[i % starters.length].id;
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}
