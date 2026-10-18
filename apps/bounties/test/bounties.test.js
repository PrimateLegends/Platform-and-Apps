import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNTY, rollTier, rollRyo, pickFront, openBounty } from '../src/bounties.js';

const FRONTS = [
  { n: 10, tier: 'epic', cap: 2 }, { n: 11, tier: 'epic', cap: 2 }, { n: 12, tier: 'epic', cap: 2 },
  { n: 20, tier: 'legendary', cap: 2 }, { n: 30, tier: 'common', cap: 12 }
];
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('tier odds: Rare 80, Legendary 18, Astral 2', () => {
  assert.equal(rollTier(() => 0), 'rare');
  assert.equal(rollTier(() => 0.79), 'rare');
  assert.equal(rollTier(() => 0.8), 'legendary');
  assert.equal(rollTier(() => 0.99), 'astral');
});

test('$RYO inside: 10,000 to 25,000', () => {
  assert.equal(rollRyo(() => 0), BOUNTY.ryoMin);
  assert.equal(rollRyo(() => 0.999999), BOUNTY.ryoMax);
});

test('a front the wallet does not own, a repeat only when it owns them all', () => {
  const copies = new Map([[12, 2]]);
  const p = pickFront('rare', FRONTS, copies, new Set([10]), () => 0);
  assert.deepEqual(p, { front: 11, fresh: true }, '10 is owned, 12 has no copies left');
  const all = pickFront('rare', FRONTS, copies, new Set([10, 11]), () => 0);
  assert.equal(all.fresh, false, 'owns every epic with room: a second copy');
  assert.equal(pickFront('legendary', FRONTS, new Map([[20, 2]]), new Set(), () => 0), null);
});

test('opening spends exactly one bag and never repeats a front', () => {
  let state = { bounties: 2, owned: new Set([10]) };
  const a = openBounty(state, FRONTS, new Map(), seq([0, 0, 0.5]));
  assert.equal(a.state.bounties, 1);
  const b = openBounty(a.state, FRONTS, new Map(), seq([0, 0, 0.5]));
  assert.notEqual(a.front, b.front);
  assert.ok(![10].includes(a.front) && ![10].includes(b.front));
  assert.deepEqual(openBounty(b.state, FRONTS, new Map()), { error: 'no-bounty' });
});
