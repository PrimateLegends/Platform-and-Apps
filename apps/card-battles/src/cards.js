/**
 * Card definitions for Primate Legends: Card Battles.
 *
 * Kinds:
 *   warrior   - a Primate on the board. Has power (attack) and health.
 *   technique - a one-shot move. Speed decides when it can be played.
 *   relic     - equips a warrior with a permanent bonus.
 *   zone      - a place on the Wiko map that stays in play and triggers each round.
 *
 * Every card belongs to a clan and has a type. The type gives warriors their keyword:
 *   attack  -> Quick Blade : strikes first in combat.
 *   defense -> Iron Skin   : takes 1 less damage from every hit.
 *   evasion -> Shadowstep  : can only be blocked by other Shadowstep warriors.
 *   healing -> Mend        : when it survives combat, heals your Shrine by 1.
 */

export const KEYWORDS = {
  attack: 'quickBlade',
  defense: 'ironSkin',
  evasion: 'shadowstep',
  healing: 'mend'
};

export const SPEED = {
  burst: 'burst',   // resolves at once, the opponent can't answer
  swift: 'swift',   // can be played during combat
  focus: 'focus'    // only outside combat, on an empty stack
};

/** @typedef {{ id:string, name:string, clan:string, kind:'warrior'|'technique'|'relic'|'zone', type:keyof KEYWORDS, cost:number,
 *   power?:number, health?:number, speed?:string, effect?:object, hero?:{ condition:object, power:number, health:number } }} CardDef */

/** @type {CardDef[]} A starter set used by the tests and the demo decks. */
export const CARDS = [
  // Onyx Clan: many cheap recruits that grow stronger together
  { id: 'onyx-recruit',    name: 'Onyx Recruit',     clan: 'onyx',    kind: 'warrior', type: 'defense', cost: 1, power: 1, health: 2 },
  { id: 'onyx-shieldwall', name: 'Shield Wall',      clan: 'onyx',    kind: 'technique', type: 'defense', cost: 2, speed: 'swift', effect: { buffAll: { health: 1 } } },
  { id: 'onyx-captain',    name: 'Onyx Captain',     clan: 'onyx',    kind: 'warrior', type: 'attack',  cost: 4, power: 4, health: 4,
    hero: { condition: { alliesPlayed: 6 }, power: 6, health: 6 } },

  // Crimson Clan: ronin that hit first and hit hard
  { id: 'crimson-ronin',   name: 'Wandering Ronin',  clan: 'crimson', kind: 'warrior', type: 'attack',  cost: 2, power: 3, health: 1 },
  { id: 'crimson-cut',     name: 'Iaido Cut',        clan: 'crimson', kind: 'technique', type: 'attack', cost: 2, speed: 'burst', effect: { damage: 2 } },
  { id: 'crimson-blade',   name: 'Masterless Blade', clan: 'crimson', kind: 'relic',   type: 'attack',  cost: 1, effect: { buff: { power: 2 } } },

  // Sakura Clan: windwalkers that slip past blockers
  { id: 'sakura-scout',    name: 'Canopy Scout',     clan: 'sakura',  kind: 'warrior', type: 'evasion', cost: 2, power: 2, health: 2 },
  { id: 'sakura-gust',     name: 'Leaf Gust',        clan: 'sakura',  kind: 'technique', type: 'evasion', cost: 3, speed: 'swift', effect: { recall: true } },
  { id: 'sakura-windwalker', name: 'Windwalker',     clan: 'sakura',  kind: 'warrior', type: 'evasion', cost: 5, power: 4, health: 3,
    hero: { condition: { attacks: 2 }, power: 6, health: 4 } },

  // Earth Clan: farmers and healers of Wiko
  { id: 'earth-disciple',  name: 'Rice Field Disciple', clan: 'earth', kind: 'warrior', type: 'healing', cost: 2, power: 1, health: 3 },
  { id: 'earth-tea',       name: 'Temple Tea',       clan: 'earth',   kind: 'technique', type: 'healing', cost: 1, speed: 'focus', effect: { healShrine: 3 } },
  { id: 'earth-monolith',  name: 'Wiko Monolith',    clan: 'earth',   kind: 'zone',    type: 'healing', cost: 3, effect: { roundStart: { healShrine: 1 } } }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

export const DECK_SIZE = 40;
export const MAX_COPIES = 3;
export const MAX_CLANS = 2;

/** Checks a deck list ({ cardId: copies }). Returns a list of problems (empty = legal). */
export function validateDeck(list) {
  const problems = [];
  let size = 0;
  const clans = new Set();
  for (const [id, copies] of Object.entries(list)) {
    const card = CARD_BY_ID[id];
    if (!card) { problems.push(`unknown card ${id}`); continue; }
    if (copies > MAX_COPIES) problems.push(`${card.name}: at most ${MAX_COPIES} copies`);
    clans.add(card.clan);
    size += copies;
  }
  if (size !== DECK_SIZE) problems.push(`deck has ${size} cards, needs ${DECK_SIZE}`);
  if (clans.size > MAX_CLANS) problems.push(`deck uses ${clans.size} clans, max ${MAX_CLANS}`);
  return problems;
}
