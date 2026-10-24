// Writes test/fixtures/duels.json: input logs and the result the referee must reach for each. The Python referee
// (services/duel-referee) replays the same file and must land on the same hashes. Run after any rules change:
//   node apps/katana-master/scripts/make-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replay, logFromTimelines, KEY, CARD_SHIFT, createRng } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CATALOG = {
  'prism-spark': { ki: 6, atk: 8, df: 2 }, 'spring-wish': { ki: 4, atk: 1, df: 6 }, 'boulder-rush': { ki: 4, atk: 5, df: 2 },
  'last-breath': { ki: 7, atk: 5, df: 6 }, 'requiem': { ki: 8, atk: 11, df: 2 },
};

// a pressing player: walks in, then cuts on a steady rhythm; the other guards on and off
function scripted() {
  const a = [{ at: 0, mask: KEY.RIGHT }, { at: 1500, mask: 0 }], b = [{ at: 0, mask: 0 }];
  for (let t = 1600; t < 60000; t += 260) a.push({ at: t, mask: KEY.ATTACK }, { at: t + 20, mask: 0 });
  for (let t = 2000; t < 60000; t += 1700) b.push({ at: t, mask: KEY.BLOCK }, { at: t + 600, mask: 0 });
  return logFromTimelines(a, b);
}

// both players mash from a seed: moves, cuts, guards, dashes, teleports and the odd card
function random(seed, ms = 400000) {
  const rng = createRng(seed), side = () => {
    const out = [];
    for (let t = 0; t < ms; t += 40 + rng.below(160)) {
      const r = rng.below(100);
      let mask = r < 30 ? KEY.ATTACK : r < 45 ? KEY.BLOCK : r < 60 ? KEY.RIGHT : r < 72 ? KEY.LEFT : r < 76 ? KEY.DASH | (rng.below(2) ? KEY.LEFT : KEY.RIGHT) : r < 79 ? KEY.TELEPORT : r < 81 ? (1 + rng.below(3)) << CARD_SHIFT : 0;
      out.push({ at: t, mask });
    }
    return out;
  };
  return logFromTimelines(side(), side());
}

const catalog = new Map(Object.entries(CATALOG));
const cases = [
  { name: 'pressure and guard', log: scripted(), cards: [[], []] },
  { name: 'seeded scramble 7', log: random(7), cards: [['prism-spark', 'spring-wish', 'last-breath'], ['boulder-rush', 'requiem']] },
  { name: 'seeded scramble 2026', log: random(2026), cards: [['requiem', 'last-breath'], ['prism-spark', 'boulder-rush', 'spring-wish']] },
  { name: 'nobody moves', log: [[0, 0, 0]], cards: [[], []] },
];
for (const c of cases) c.expect = replay({ log: c.log, cards: c.cards, catalog });

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = path.join(HERE, '..', 'test', 'fixtures', 'duels.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ catalog: CATALOG, cases }) + '\n');
  for (const c of cases) console.log(c.name.padEnd(22), c.expect.hash, 'winner', c.expect.winner, JSON.stringify(c.expect.rounds));
}
