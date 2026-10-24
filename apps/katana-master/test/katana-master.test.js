import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RULES, cutDamage, nextCombo, gainKi, kiFromDamage, teleport, isPerfectBlock, CardLedger, loadoutProblem,
  InputGuard, DIFFICULTY, cardPlan, botCardCount, replay, createRng,
} from '../src/index.js';

const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/duels.json', import.meta.url)));
const catalog = new Map(Object.entries(FIX.catalog));

test('the rules are read-only all the way down', () => {
  assert.ok(Object.isFrozen(RULES) && Object.isFrozen(RULES.attack) && Object.isFrozen(RULES.hit));
  assert.throws(() => { 'use strict'; RULES.hp = 1; });
  assert.throws(() => { RULES.attack.reachPx = 999; });
  assert.equal(RULES.hp, 5000);
});

test('cut damage: x1.25 per combo hit up to the 5th, air bonus, move multipliers', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(n => cutDamage(n)), [100, 125, 156, 195, 244, 244, 244]);
  assert.equal(cutDamage(0, { aerial: true }), 120);
  assert.equal(cutDamage(0, { mulPct: 200 }), 200);   // the shadow kick
  assert.equal(nextCombo(3, 0, 1000), 4);
  assert.equal(nextCombo(3, 0, 1101), 1);
});

test('Ki: every gain is worth 1.3, fractions bank, the wallet caps at 10', () => {
  let w = { ki: 0, bank: 0 };
  w = gainKi(w); assert.deepEqual(w, { ki: 13, bank: 0 });
  for (let i = 0; i < 20; i++) w = gainKi(w);
  assert.deepEqual(w, { ki: 100, bank: 0 });
  assert.deepEqual(kiFromDamage(300, 250), { gains: 1, carry: 150 });
});

test('teleports: 1 Ki each, 4 in a row within 3 s, then a 10 s rest', () => {
  let t = { count: 0, lastAt: -1e9, restUntil: 0 };
  for (let i = 0; i < 4; i++) { const r = teleport(t, 100, i * 1000); assert.ok(r.ok); t = r.next; }
  assert.equal(teleport(t, 100, 4000).reason, 'rest');
  assert.ok(teleport(t, 100, 3000 + 10000).ok);
  assert.equal(teleport({ count: 0, lastAt: -1e9, restUntil: 0 }, 9, 0).reason, 'ki');
  assert.ok(isPerfectBlock(1000, 1150) && !isPerfectBlock(1000, 1151) && !isPerfectBlock(1200, 1150));
});

test('cards: 5 at most, once per match, never on the ground, Last Breath only on its own', () => {
  assert.equal(loadoutProblem(['a', 'b', 'c', 'd', 'e', 'f'], new Set('abcdef')), 'too-many');
  assert.equal(loadoutProblem(['a', 'a'], new Set('a')), 'duplicate');
  assert.equal(loadoutProblem(['x'], new Set('a')), 'unknown-card');
  const L = new CardLedger(['prism-spark', 'last-breath']), cost = id => ({ ki: catalog.get(id).ki * 10 });   // Ki in tenths
  assert.equal(L.cast(0, { state: 'down', ki: 100 }, cost).reason, 'on-the-ground');
  assert.equal(L.cast(0, { state: 'idle', ki: 50 }, cost).reason, 'ki');
  assert.deepEqual(L.cast(0, { state: 'hit', ki: 100 }, cost), { ok: true, ki: 40 });   // cast mid-combo: instant
  assert.equal(L.cast(0, { state: 'idle', ki: 100 }, cost).reason, 'used');   // the next round too: it's per match
  assert.equal(L.cast(1, { state: 'idle', ki: 100 }, cost).reason, 'auto');
  assert.equal(L.autoCast(250), -1);
  assert.equal(L.autoCast(150), 1);
  assert.equal(L.autoCast(150), -1);
});

test('input guard: script events, turbo repeats, machine rate and machine rhythm', () => {
  const g = new InputGuard();
  assert.equal(g.press('KeyJ', 0, false), false);
  assert.equal(g.press('KeyJ', 100), true);
  assert.equal(g.press('KeyJ', 115), false);
  assert.deepEqual(g.flags, ['synthetic', 'turbo']);
  const human = new InputGuard(), rng = createRng(3);
  for (let i = 0, t = 0; i < 60; i++) { t += 90 + rng.below(70); human.press(i % 2 ? 'KeyA' : 'KeyJ', t); }
  assert.deepEqual(human.flags, []);
  const macro = new InputGuard();
  for (let i = 0; i < 30; i++) macro.press(i % 2 ? 'KeyA' : 'KeyJ', i * 100);
  assert.deepEqual(macro.flags, ['rhythm']);
  const mash = new InputGuard();
  for (let i = 0; i < 30; i++) mash.press('K' + (i % 6), i * 33 + (i % 3) * 7);
  assert.ok(mash.flags.includes('rate'));
});

test('bot levels: Normal and Hard share the attack, Easy brings 3 or 4 cards', () => {
  assert.deepEqual(DIFFICULTY.hard.burst, DIFFICULTY.normal.burst);
  assert.deepEqual(DIFFICULTY.hard.cutsPerS, DIFFICULTY.normal.cutsPerS);
  assert.ok(DIFFICULTY.hard.readsPct > DIFFICULTY.normal.readsPct && DIFFICULTY.normal.readsPct > DIFFICULTY.easy.readsPct);
  assert.deepEqual([0, 0.49, 0.5, 0.99].map(p => botCardCount('easy', p)), [3, 3, 4, 4]);
  assert.equal(botCardCount('hard', 0.3), 5);
});

test('hard bot card plan: finish first, heal when low, guard under pressure, keep Ki for an escape', () => {
  const cards = [{ fx: 'requiem', ki: 8, atk: 11, df: 2 }, { fx: 'heal', ki: 4, atk: 1, df: 6 }, { fx: 'wall', ki: 4, atk: 2, df: 6 }];
  const rules = { hpMax: 50, teleportKi: 1 };
  assert.equal(cardPlan({ hp: 40, ki: 9, pressed: false, cards }, { hp: 10, open: false, near: true }, rules), 0);
  assert.equal(cardPlan({ hp: 12, ki: 9, pressed: true, cards }, { hp: 40, open: false, near: true }, rules), 1);
  assert.equal(cardPlan({ hp: 40, ki: 5, pressed: true, cards }, { hp: 40, open: false, near: true }, rules), 2);
  assert.equal(cardPlan({ hp: 40, ki: 4, pressed: true, cards }, { hp: 40, open: false, near: true }, rules), -1);   // no Ki left to escape
});

test('referee: every fixture replays to its recorded result (the Python referee checks the same file)', () => {
  for (const c of FIX.cases) assert.deepEqual(replay({ log: c.log, cards: c.cards, catalog }), c.expect, c.name);
});

test('referee: a log with the cuts taken out cannot reach the reported win', () => {
  const c = FIX.cases[0], log = c.log.map(([k, a, b]) => [k, a & ~8, b]);
  const got = replay({ log, cards: c.cards, catalog });
  assert.notEqual(got.hash, c.expect.hash);
  assert.notEqual(got.winner, 0);
});
