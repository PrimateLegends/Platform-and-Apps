import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCost, totalFor, standing, standingLabel, MAX_LEVEL } from '../src/levels.js';
import { scoreWallet, leaderboard, tradeBonus, DAY_MS } from '../src/xp.js';
import { PARTNERS, displayOrder, checkWallet, nextFridayUtc } from '../src/boost.js';
import { kingsOfTheHill } from '../src/kings.js';

const T0 = Date.UTC(2026, 9, 20, 12);

test('level curve: +100 XP per step, LoL shape, up to level 300', () => {
  const lol = [280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360];
  lol.forEach((t, i) => assert.equal(totalFor(i + 2), t, 'level ' + (i + 2)));
  assert.equal(stepCost(17), 1880);
  assert.equal(stepCost(299), 30080);
  assert.equal(totalFor(MAX_LEVEL), 4538820);
  assert.throws(() => totalFor(301));
});

test('standing: exact level boundaries and progress', () => {
  assert.deepEqual(standing(0), { xp: 0, level: 1, inLevel: 0, toNext: 280, progress: 0, maxed: false });
  assert.equal(standing(279).level, 1);
  assert.equal(standing(280).level, 2);
  assert.equal(standing(18359).level, 17);
  const s = standing(1000);
  assert.equal(s.level, 3); assert.equal(s.inLevel, 340); assert.equal(s.toNext, 480);
  assert.equal(standing(1e12).level, 300);
  assert.equal(standing(1e12).maxed, true);
  assert.equal(standingLabel(685), 'Level 3 · 25 / 480 XP');
});

test('XP: flat points, trade bonus, daily caps, once-only kinds', () => {
  assert.equal(tradeBonus(5000), 5);
  assert.equal(tradeBonus(10_000_000), 100);
  const log = [
    { kind: 'daily-claim', at: T0 }, { kind: 'card-bought', at: T0, value: 5000 },
    ...Array.from({ length: 8 }, (_, i) => ({ kind: 'card-listed', at: T0 + i })),          // 5 a day count
    ...Array.from({ length: 4 }, (_, i) => ({ kind: 'card-sent', at: T0 + i })),            // 3 a day count
    { kind: 'card-listed', at: T0 + DAY_MS },                                               // a new day
    { kind: 'solana-linked', at: T0 }, { kind: 'solana-linked', at: T0 + 1 },              // once
    { kind: 'unknown-thing', at: T0 }
  ];
  const r = scoreWallet(log);
  assert.equal(r.xp, 30 + 55 + 5 * 10 + 3 * 10 + 10 + 50);
  assert.equal(r.byKind['card-listed'].count, 6);
  assert.equal(scoreWallet(log, { boosts: 40 }).xp, r.xp + 40);
});

test('trades share one daily budget of 10 between buys and sells', () => {
  const log = Array.from({ length: 12 }, (_, i) => ({ kind: i % 2 ? 'card-sold' : 'card-bought', at: T0 + i, value: 1000 }));
  const r = scoreWallet(log);
  assert.equal(r.byKind['card-bought'].count + r.byKind['card-sold'].count, 10);
});

test('leaderboard ranks by XP and hides team wallets', () => {
  const log = [{ wallet: '0xA', kind: 'quest-done', at: T0 }, { wallet: '0xB', kind: 'daily-claim', at: T0 }, { wallet: '0xT', kind: 'quest-done', at: T0 }];
  assert.deepEqual(leaderboard(log, { hidden: ['0xt'] }).map(r => [r.wallet, r.rank]), [['0xa', 1], ['0xb', 2]]);
});

test('Collector Boost: Normies first (+50%), Argonauts second, Frontonauts last, the rest shuffled', () => {
  const order = displayOrder(PARTNERS, () => 0.42).map(c => c.key);
  assert.equal(order[0], 'normies'); assert.equal(order[1], 'argonauts'); assert.equal(order.at(-1), 'frontonauts');
  assert.equal(order.length, 8);
  const { grants, waiting } = checkWallet(655, { normies: 1, mayc: 2, argonauts: 0 }, new Set(['mayc']));
  assert.deepEqual(grants, [{ key: 'normies', xp: 327 }], 'mayc already claimed, argonauts not held');
  assert.deepEqual(waiting, []);
  assert.deepEqual(checkWallet(0, { nakamigos: 1 }, new Set()), { grants: [], waiting: ['nakamigos'] }, 'no XP yet: the boost waits');
});

test('snapshot reminder: next Friday 00:00 UTC', () => {
  assert.equal(new Date(nextFridayUtc(Date.UTC(2026, 9, 21, 2))).toISOString(), '2026-10-23T00:00:00.000Z');
  assert.equal(new Date(nextFridayUtc(Date.UTC(2026, 9, 23, 0, 0, 5))).toISOString(), '2026-10-30T00:00:00.000Z');
});

test('King of the Hill: 24h card volume, both sides, team out', () => {
  const H = 3600000;
  const sales = [
    { buyer: '0xb', seller: '0xa', price: 5000, at: T0 - H, kind: 'sale' },
    { buyer: '0xb', seller: '0xc', price: 3000, at: T0 - 2 * H, kind: 'offer' },
    { buyer: '0xvault', seller: '0xd', price: 9000, at: T0 - 0.2 * H, kind: 'sale' },
    { buyer: '0xa', seller: '0xe', price: 99000, at: T0 - 30 * H, kind: 'sale' },
    { buyer: null, seller: '0xa', price: 7000, at: T0, kind: 'listed' }
  ];
  assert.deepEqual(kingsOfTheHill(sales, T0, { hidden: ['0xvault'] }).map(k => [k.wallet, k.volume, k.rank]), [['0xd', 9000, 1], ['0xb', 8000, 2], ['0xa', 5000, 3]]);
});
