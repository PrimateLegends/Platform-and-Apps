/**
 * Local vault for the preview: sealed packs, sealed cards and the daily claim streak,
 * persisted in localStorage. The live site keeps this server-side and signs actions with
 * the user's wallet; the preview skips all of that on purpose.
 */
import { PACK_BY_ID, STREAK_DAYS } from '../data/catalog.js';
import { rollBack, rollHints, rollRarities, rollSerial } from './rolls.js';
import { weighted } from './random.js';

const KEY = 'pl-preview-vault';
const DAY = 24 * 60 * 60 * 1000;

const empty = () => ({ packs: ['recruit', 'emperor'], cards: [], claims: [], bounties: 0 });

function read() {
  try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || 'null') }; } catch { return empty(); }
}
function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep it in memory */ }
  return state;
}

let state = read();
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn(state));

export const vault = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
  reset() { state = write(empty()); emit(); },

  /** Opens the first sealed pack of `packId`, returns the six new cards. */
  openPack(packId) {
    const index = state.packs.indexOf(packId);
    if (index === -1) throw new Error('No sealed ' + packId + ' pack');
    const pack = PACK_BY_ID[packId];
    const taken = new Set(state.cards.map(c => c.no));
    const cards = rollRarities(pack).map(rarity => {
      const no = rollSerial(taken);
      taken.add(no);
      return { no, rarity, back: rollBack(), source: pack.name, at: Date.now(), hints: rollHints(pack) };
    });
    state = write({ ...state, packs: state.packs.filter((_, i) => i !== index), cards: [...state.cards, ...cards] });
    emit();
    return cards;
  },

  /** Claim state: current streak, whether the streak was broken, and when the next card is ready. */
  claimStatus(now = Date.now()) {
    const times = [...state.claims].sort((a, b) => a - b);
    const last = times.at(-1) || 0;
    let run = last ? 1 : 0;
    for (let i = times.length - 1; i > 0 && times[i] - times[i - 1] < 2 * DAY; i--) run++;
    const alive = last && now - last < 2 * DAY;
    return {
      streak: alive ? run : 0,
      lost: alive ? 0 : run,
      nextAt: last ? last + DAY : 0,
      ready: !last || now - last >= DAY
    };
  },

  /** Daily free card. Every 7th day in a row also pays a Bounty. */
  claim(now = Date.now()) {
    if (!this.claimStatus(now).ready) throw new Error('Already claimed today');
    const taken = new Set(state.cards.map(c => c.no));
    const recruit = PACK_BY_ID.recruit;
    const card = { no: rollSerial(taken), rarity: weighted(recruit.odds), back: rollBack(), source: 'Free Claim', at: now, hints: rollHints(null) };
    const claims = [...state.claims, now];
    state = { ...state, claims, cards: [...state.cards, card] };
    const { streak } = this.claimStatus(now);
    const bounty = streak > 0 && streak % STREAK_DAYS === 0 ? 1 : 0;
    state = write({ ...state, bounties: state.bounties + bounty });
    emit();
    return { card, bounty, streak };
  }
};
