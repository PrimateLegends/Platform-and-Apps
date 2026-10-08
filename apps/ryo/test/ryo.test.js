import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, SUPPLY, airdropSplit } from '../src/ledger.js';
import { listingProblem, vaultQuote, vaultSalesLeft, ryoFromEth, PRICE_MIN } from '../src/market.js';
import { claimKind, canClaim, streak, streakReward } from '../src/claims.js';
import { redeemProblem, ownerNotice, postText, normalizeCode } from '../src/claim-codes.js';

const DAY = 86400e3;

test('genesis adds up to the fixed supply and transfers keep it', () => {
  const l = new Ledger();
  assert.equal(l.total(), SUPPLY);
  l.transfer('vault', 'alice', 1500);
  assert.equal(l.balanceOf('alice'), 1500);
  assert.equal(l.total(), SUPPLY);
  assert.throws(() => l.transfer('alice', 'bob', 1501), /insufficient-ryo/);
  assert.throws(() => l.transfer('liquidity', 'bob', 1), /locked/);
});

test('airdrop: half equal, half pro rata, exact total', () => {
  const s = airdropSplit({ a: 1, b: 2, c: 7 }, 100_000_000);
  assert.equal(Object.values(s).reduce((x, y) => x + y, 0), 100_000_000);
  assert.ok(s.c > s.b && s.b > s.a);
});

test('pre-market: $RYO only, floor 1,000, vault pays 80%', () => {
  assert.equal(ryoFromEth(0.01), 100_000);
  assert.equal(listingProblem({ price: PRICE_MIN }), '');
  assert.equal(listingProblem({ price: 999 }), 'bad-price');
  assert.equal(listingProblem({ price: 5000, currency: 'eth' }), 'currency-paused');
  assert.equal(vaultQuote(3700), 2960);
});

test('vault sales: 3 per wallet every 7 days', () => {
  const now = Date.now();
  assert.deepEqual(vaultSalesLeft([now - DAY], now), { left: 2, resetAt: null });
  const full = vaultSalesLeft([now - 3 * DAY, now - 2 * DAY, now - DAY], now);
  assert.equal(full.left, 0);
  assert.equal(full.resetAt, now - 3 * DAY + 7 * DAY);
  assert.equal(vaultSalesLeft([now - 8 * DAY, now - 2 * DAY, now - DAY], now).left, 1);
});

test('claims: early cap then daily, 24h wait, 7-day streak reward', () => {
  assert.equal(claimKind(302), 'early');
  assert.equal(claimKind(303), 'daily');
  const now = Date.now();
  assert.equal(canClaim(now - 23 * 3600e3, now), false);
  assert.equal(canClaim(now - 25 * 3600e3, now), true);
  const week = Array.from({ length: 7 }, (_, i) => now - (6 - i) * DAY);
  assert.equal(streak(week, now), 7);
  assert.equal(streak([now - 3 * DAY], now), 0);
  assert.equal(streakReward(7, 0.2), 'bounty');
  assert.equal(streakReward(7, 0.8), 'dojo_book');
  assert.equal(streakReward(6), null);
});

test('claim codes: fresh wallets only, 20 uses, owner notice and post text', () => {
  const code = { code: 'PL-AB12CD', owner: 'owner', uses: 3 };
  const fresh = { cards: 0, ryoReceived: 0, redeemed: false, ownsCode: false };
  assert.equal(redeemProblem(code, 'new', fresh), '');
  assert.equal(redeemProblem(code, 'owner', fresh), 'own-code');
  assert.equal(redeemProblem({ ...code, uses: 20 }, 'new', fresh), 'code-used-up');
  assert.equal(redeemProblem(code, 'new', { ...fresh, cards: 1 }), 'not-fresh');
  assert.equal(ownerNotice('PL-AB12CD', 4), 'Your code PL-AB12CD was used. 16 of 20 uses left.');
  assert.equal(normalizeCode('plab12cd'), 'PL-AB12CD');
  assert.match(postText('PL-AB12CD'), /Use my code PL-AB12CD & let’s win together\.[\s\S]*\/c\/PL-AB12CD$/);
});

import { loyaltyBatch, LOYALTY, captchaStep, CAPTCHA_PASSES, bandPrice } from '../src/rewards.js';
import { PER_USE } from '../src/claim-codes.js';

test('claim codes pay the owner 400 per use (x4)', () => {
  assert.equal(PER_USE, 400);
});

test('loyalty reward: base for everyone, bonus for 3+ free claims, resumable, never twice', () => {
  const w = n => '0x' + String(n).padStart(40, '0');
  const all = [w(1), w(2), w(3), w(4), 'not-a-wallet', w(1)];
  const claims = { [w(1)]: 5, [w(2)]: 2 };
  const first = loyaltyBatch(all, claims, { skip: [w(4)], limit: 2 });
  assert.deepEqual(first.batch, [{ wallet: w(1), amount: LOYALTY.base + LOYALTY.bonus }, { wallet: w(2), amount: LOYALTY.base }]);
  assert.equal(first.remaining, 1);
  const second = loyaltyBatch(all, claims, { skip: [w(4)], paid: first.batch.map(r => r.wallet) });
  assert.deepEqual(second.batch, [{ wallet: w(3), amount: LOYALTY.base }]);
  assert.equal(loyaltyBatch(all, claims, { skip: [w(4)], paid: [w(1), w(2), w(3)] }).batch.length, 0);
});

test('captcha: 3 free actions, then one captcha covers the next 4', () => {
  let st = { recent: 0, credit: 0 }, asked = 0;
  for (let i = 0; i < 3 + 1 + CAPTCHA_PASSES + 1; i++) {
    let r = captchaStep(st, false);
    if (r.needsCaptcha) { asked++; r = captchaStep(st, true); }
    st = r.state;
  }
  assert.equal(asked, 2, 'asked after the 3 free ones and again after 4 covered actions');
});

test('vault grant band price: inside the band, rounded to 50', () => {
  for (let i = 0; i < 200; i++) { const p = bandPrice(3000, 8000); assert.ok(p >= 3000 && p <= 8000 && p % 50 === 0); }
  assert.throws(() => bandPrice(500, 8000), /bad-price/);
  assert.throws(() => bandPrice(8000, 3000), /bad-price/);
});
