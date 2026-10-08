import test from 'node:test';
import assert from 'node:assert/strict';
import { FRONTS } from '../src/fronts.js';
import { TIERS, COPY_CAP, pick, claimReveal, planReveal, front, CLAIM_REVEAL_ODDS } from '../src/reveal.js';
import { furFamily, clansFromFur } from '../src/clans.js';

// Small seeded generator so every run is the same.
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('catalog: PL-001.. in order, known tiers and types', () => {
  assert.ok(FRONTS.length >= 148);
  FRONTS.forEach((f, i) => {
    assert.equal(f.n, i + 1);
    assert.ok(['common', 'rare', 'epic', 'legendary'].includes(f.rarity));
    assert.ok(['attack', 'defense', 'evasion', 'healing'].includes(f.type));
  });
  assert.ok(Object.isFrozen(FRONTS) && Object.isFrozen(FRONTS[0]));
});

test('pick: right tier, hinted type, prefers the top clan', () => {
  const card = { rarity: 'rare', type: 'attack', clans: [['orange', 70], ['black', 20]] };
  const n = pick(card, new Map(), { rnd: () => 0 });
  assert.equal(front(n).rarity, 'epic');
  assert.equal(front(n).type, 'attack');
  assert.ok(front(n).clans.includes('orange'));
});

test('pick: copy caps hold, a full tier leaves the card sealed', () => {
  const used = new Map(FRONTS.filter(f => f.rarity === 'epic').map(f => [f.n, COPY_CAP.epic]));
  assert.equal(pick({ rarity: 'rare', type: 'defense', clans: [] }, used, { strict: false }), 0);
  assert.throws(() => pick({ rarity: 'mythic', type: 'attack' }, new Map()), /unknown rarity/);
});

test('claims reveal ~35% of the time and stay in tier', () => {
  const rnd = seeded(7); let hit = 0;
  for (let i = 0; i < 2000; i++) {
    const n = claimReveal({ rarity: 'common', type: 'healing', clans: [] }, new Map(), rnd);
    if (n) { hit++; assert.ok(TIERS.common.includes(front(n).rarity)); }
  }
  assert.ok(Math.abs(hit / 2000 - CLAIM_REVEAL_ODDS) < 0.04, 'rate ' + hit / 2000);
});

test('batch: 80% per rarity, hints respected, caps respected, never re-rolls', () => {
  const rnd = seeded(42), types = ['attack', 'defense', 'evasion', 'healing'];
  const clans = ['ghost', 'rainbowe', 'golden-ape', 'orange', 'purple', 'pink', 'red-hair', 'brown', 'black'];
  const cards = [];
  const pop = { common: 400, uncommon: 120, rare: 40, legendary: 6, phantom: 2 };
  let id = 0;
  for (const [rarity, n] of Object.entries(pop)) for (let i = 0; i < n; i++, id++)
    cards.push({ id, rarity, type: types[id % 4], clans: [[clans[id % 9], 60], [clans[(id + 4) % 9], 30]], front: 0 });
  const { plan, stats, used } = planReveal(cards, { rnd });
  for (const [rarity, n] of Object.entries(pop)) {
    assert.equal(stats[rarity].revealed + stats[rarity].short, Math.round(n * 0.8), rarity);
    assert.equal(stats[rarity].typeMatch, stats[rarity].revealed, rarity + ' hints respected');
  }
  for (const [n, k] of used) assert.ok(k <= COPY_CAP[front(n).rarity], 'cap PL-' + n);
  const byId = new Map(plan.map(p => [p.id, p.front]));
  cards.forEach(c => { if (byId.has(c.id)) assert.ok(TIERS[c.rarity].includes(front(byId.get(c.id)).rarity)); });
  // a second batch on the result reveals nothing new and keeps every front
  const after = cards.map(c => ({ ...c, front: byId.get(c.id) || 0 }));
  const again = planReveal(after, { rnd });
  assert.equal(again.plan.length, 0);
  assert.throws(() => planReveal(cards, { pct: 2 }), /pct/);
});

test('clans by fur colour, with the team rules', () => {
  assert.equal(furFamily([46, 31, 10]), 'brown');               // dark brown = Earth
  assert.deepEqual(clansFromFur([[194, 255, 248]], 'ghost'), ['red-hair']);   // skyblue = Crimson
  assert.deepEqual(clansFromFur([[255, 235, 210]], 'black'), ['pink', 'orange']);
  assert.deepEqual(clansFromFur([[255, 235, 210]], 'orange'), ['orange']);
  assert.deepEqual(clansFromFur([[117, 188, 118]], 'rainbowe'), []);         // zombie never Prism/Phantom
  assert.deepEqual(clansFromFur([[117, 188, 118]], 'brown'), ['brown']);
  assert.deepEqual(clansFromFur([[244, 182, 34], [237, 97, 21]], 'golden-ape'), ['golden-ape', 'orange']);
  assert.throws(() => furFamily('red'), /rgb/);
});
