// The three bots of "Fight a Bot". Same attack on Normal and Hard; Hard wins with its defense and its card sense.

export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ readsPct: 40, clashes: false, burst: [1, 2], cutsPerS: [1.6, 2.2], restMs: 1100, roams: true, cards: [3, 4] }),
  normal: Object.freeze({ readsPct: 65, clashes: true, burst: [3, 5], cutsPerS: [3, 5], restMs: 500, cards: [5, 5] }),
  hard: Object.freeze({ readsPct: 95, clashes: true, burst: [3, 5], cutsPerS: [3, 5], restMs: 500, cards: [5, 5],
    perfectPct: 55, dodgePct: 25, escapePct: 50, guardsChains: true, cardPlan: true }),
});

const HEALS = new Set(['heal', 'pillar', 'rewind']);
const GUARDS = new Set(['freeze', 'wall', 'twin', 'mark', 'beam', 'charge']);

/**
 * Hard bot: which card fits the moment, or -1. In order: a card that finishes the rival, a heal when low, a shield
 * or a lock while it's under pressure, a big hit while the rival is open. It always keeps enough Ki for one escape
 * teleport, except for a finishing blow or a heal.
 * @param {{ hp: number, ki: number, pressed: boolean, cards: { fx: string, ki: number, atk: number, df: number, used?: boolean }[] }} me
 * @param {{ hp: number, open: boolean, near: boolean }} rival
 * @param {{ hpMax: number, teleportKi: number }} rules   (same units as the hp/ki given)
 */
export function cardPlan(me, rival, rules) {
  const free = me.cards.map((c, slot) => ({ ...c, slot })).filter(c => !c.used && c.fx !== 'undying' && me.ki >= c.ki);
  const spare = free.filter(c => me.ki - c.ki >= rules.teleportKi);
  const top = (list, score) => list.length ? list.reduce((a, b) => (score(b) > score(a) ? b : a)).slot : -1;
  const finish = free.filter(c => rival.near && c.atk >= rival.hp);
  if (finish.length) return top(finish, c => -c.ki);
  if (me.hp < rules.hpMax * 0.4) { const h = free.filter(c => HEALS.has(c.fx)); if (h.length) return top(h, c => c.df); }
  if (me.pressed) { const g = spare.filter(c => GUARDS.has(c.fx)); if (g.length) return top(g, c => c.df + c.atk); }
  if (rival.open && rival.near) { const a = spare.filter(c => c.atk >= 6); if (a.length) return top(a, c => c.atk); }
  return -1;
}

/** How many cards the bot brings: Easy 3 or 4, the others 5. `pick` is 0..1. */
export const botCardCount = (level, pick) => { const [lo, hi] = DIFFICULTY[level].cards; return lo + Math.floor(pick * (hi - lo + 1)); };
