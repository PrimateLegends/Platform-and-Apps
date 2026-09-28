/**
 * Static game data for the Legendary Cards preview: clans, rarities, card types and packs.
 * Numbers mirror the public collection (3,003 Primates). Odds are illustrative.
 */

export const TOTAL_SUPPLY = 3003;

/** @typedef {{ id: string, name: string, rank: string, population: number, color: string }} Clan */

/** @type {Clan[]} rarest first */
export const CLANS = [
  { id: 'phantom', name: 'Phantom Clan', rank: 'The Hollow Emperor', population: 50,  color: '#e9ddff' },
  { id: 'prism',   name: 'Prism Clan',   rank: 'Grandmaster',        population: 100, color: '#8fe0ff' },
  { id: 'golden',  name: 'Golden Clan',  rank: 'Sensei',             population: 350, color: '#ffd257' },
  { id: 'ember',   name: 'Ember Clan',   rank: 'Warmaster',          population: 190, color: '#ffb066' },
  { id: 'void',    name: 'Void Clan',    rank: 'Alchemist',          population: 193, color: '#c3a6ff' },
  { id: 'sakura',  name: 'Sakura Clan',  rank: 'Windwalker',         population: 271, color: '#ffa8cf' },
  { id: 'crimson', name: 'Crimson Clan', rank: 'Ronin',              population: 352, color: '#ff7a6b' },
  { id: 'earth',   name: 'Earth Clan',   rank: 'Disciple',           population: 658, color: '#d9a86c' },
  { id: 'onyx',    name: 'Onyx Clan',    rank: 'Recruit',            population: 839, color: '#9aa6ad' }
];
export const CLAN_BY_ID = Object.fromEntries(CLANS.map(c => [c.id, c]));

export const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'phantom'];
export const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary', phantom: 'Phantom' };
export const RARITY_COLOR = { common: '#c3cfd2', uncommon: '#6fe0a8', rare: '#5fb8ff', legendary: '#ffd257', phantom: '#e9ddff' };

/** Card types shown as a hint on sealed cards. */
export const CARD_TYPES = {
  attack:  { label: 'Attack',  color: '#ff5f56' },
  defense: { label: 'Defense', color: '#c9d3d9' },
  evasion: { label: 'Evasion', color: '#b58cff' },
  healing: { label: 'Healing', color: '#4fe0c8' }
};

/** Card back finishes: independent of rarity. */
export const BACKS = [
  { id: 'classic', weight: 90 },
  { id: 'sakura',  weight: 7 / 3 },
  { id: 'indigo',  weight: 7 / 3 },
  { id: 'dark',    weight: 7 / 3 },
  { id: 'metal',   weight: 3 }
];

const CLAN_ODDS = { common: 50, uncommon: 30, rare: 16, legendary: 3.6, phantom: 0.4 };

/** @type {Array<{ id: string, name: string, odds: Record<string, number>, guarantee?: string, clan?: string }>} */
export const PACKS = [
  { id: 'recruit', name: 'Recruit Pack', odds: { common: 72, uncommon: 21, rare: 6, legendary: 0.9, phantom: 0.1 } },
  { id: 'dojo',    name: 'Dojo Pack',    odds: { common: 55, uncommon: 28, rare: 14, legendary: 2.7, phantom: 0.3 } },
  { id: 'ronin',   name: 'Ronin Pack',   odds: { common: 38, uncommon: 32, rare: 24, legendary: 5.5, phantom: 0.5 }, guarantee: 'rare' },
  { id: 'emperor', name: 'Emperor Pack', odds: { common: 15, uncommon: 27, rare: 38, legendary: 17, phantom: 3 }, guarantee: 'legendary' },
  { id: 'onyx',    name: 'Onyx Clan Pack',    odds: CLAN_ODDS, clan: 'onyx' },
  { id: 'earth',   name: 'Earth Clan Pack',   odds: CLAN_ODDS, clan: 'earth' },
  { id: 'crimson', name: 'Crimson Clan Pack', odds: CLAN_ODDS, clan: 'crimson' },
  { id: 'sakura',  name: 'Sakura Clan Pack',  odds: CLAN_ODDS, clan: 'sakura' },
  { id: 'void',    name: 'Void Clan Pack',    odds: CLAN_ODDS, clan: 'void' },
  { id: 'ember',   name: 'Ember Clan Pack',   odds: CLAN_ODDS, clan: 'ember' }
];
export const PACK_BY_ID = Object.fromEntries(PACKS.map(p => [p.id, p]));

export const CARDS_PER_PACK = 6;
export const STREAK_DAYS = 7;
export const MAX_SERIAL = 99999;
