import test from 'node:test';
import assert from 'node:assert/strict';
import { UNLOCKS, trancheOf, unlockDay, calendar } from '../src/unlocks.js';

const DAY = 86_400_000;

test('tranches: 2M on day 1, +40% a day, compounding', () => {
  assert.deepEqual([1, 2, 3, 4].map(trancheOf), [2_000_000, 2_800_000, 3_920_000, 5_488_000]);
});

test('the calendar shows the next 3 tranches; passed days drop off', () => {
  const before = calendar(120_000, UNLOCKS.firstDayUtc - DAY);
  assert.deepEqual(before.rows.map(r => r.day), [1, 2, 3]);
  assert.equal(before.rows[0].pct, 6, '120k is 6% of the first tranche');
  assert.equal(before.rows[0].today, false);
  const day3 = calendar(120_000, UNLOCKS.firstDayUtc + 2 * DAY + 5);
  assert.equal(unlockDay(UNLOCKS.firstDayUtc + 2 * DAY + 5), 3);
  assert.deepEqual(day3.rows.map(r => [r.day, r.today]), [[3, true], [4, false], [5, false]]);
  assert.equal(day3.rows[0].date, '2026-11-10');
});

test('a big balance fills the bars and the rest waits as "To be unlocked"', () => {
  const c = calendar(10_000_000, UNLOCKS.firstDayUtc);
  assert.deepEqual(c.rows.map(r => r.pct), [100, 100, 100]);
  assert.equal(c.later, 10_000_000 - 3_920_000);
  assert.equal(calendar(1_000, UNLOCKS.firstDayUtc).later, 0);
});
