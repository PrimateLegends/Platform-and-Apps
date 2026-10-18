import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER, fee, heldUntil, transferProblem, needsCaptcha, recipientNotice, walletActivity } from '../src/transfers.js';

const NOW = Date.UTC(2026, 9, 18, 12);
const ALICE = '0x' + 'a'.repeat(40), BOB = '0x' + 'b'.repeat(40);
const vault = new Map([
  [1, { location: 'vault', origin: 'recruit', pulledAt: NOW - 9e8 }],
  [2, { location: 'vault', origin: 'pack', pulledAt: NOW - 3600e3 }],
  [3, { location: 'vault', origin: 'daily-claim', pulledAt: NOW - 3600e3 }],
  [4, { location: 'listed', origin: 'recruit', pulledAt: 0 }],
  [5, { location: 'escrow', origin: 'recruit', pulledAt: 0 }],
  [6, { location: 'vault', origin: 'pack', pulledAt: NOW - 80 * 3600e3 }]
]);
const send = (cards, extra = {}) => transferProblem({ from: ALICE, to: BOB, cards, vault, balance: 1000, now: NOW, ...extra });

test('fee: 5 $RYO per card', () => {
  assert.equal(fee(1), 5);
  assert.equal(fee(TRANSFER.maxCards), 100);
});

test('only cards that can move right now', () => {
  assert.equal(send([1, 6]), '');
  assert.equal(send([2]), 'pack-hold');
  assert.equal(send([3]), 'claim-hold');
  assert.equal(send([4]), 'listed');
  assert.equal(send([5]), 'in-escrow');
  assert.equal(send([99]), 'not-yours');
  assert.equal(heldUntil(vault.get(6), NOW), 0, 'the 72h pack hold is over');
});

test('recipient, card list and balance', () => {
  assert.equal(send([1], { to: 'not-an-address' }), 'bad-recipient');
  assert.equal(send([1], { to: ALICE.toUpperCase().replace('0X', '0x') }), 'same-wallet');
  assert.equal(send([]), 'bad-cards');
  assert.equal(send([1, 1]), 'bad-cards');
  assert.equal(send(Array.from({ length: 21 }, (_, i) => i + 100)), 'too-many-cards');
  assert.equal(send([1, 6], { balance: 9 }), 'insufficient-ryo');
});

test('captcha after 7 transfers inside 2 minutes', () => {
  const recent = Array.from({ length: 7 }, (_, i) => NOW - i * 1000);
  assert.equal(needsCaptcha(recent.slice(0, 6), NOW), false);
  assert.equal(needsCaptcha(recent, NOW), true);
  assert.equal(needsCaptcha(recent.map(t => t - TRANSFER.windowMs), NOW), false, 'older transfers fall out of the window');
});

test('unregistered recipients get the cards and a waiting notice', () => {
  assert.deepEqual(recipientNotice([42], '0xaaaa…aaaa', false), { title: 'Card received', text: 'Card #00042 arrived from 0xaaaa…aaaa', waiting: true });
  assert.equal(recipientNotice([1, 2], 'x', true).text, '2 cards arrived from x');
});

test('wallet activity: transfers both ways and purchases, newest first', () => {
  const rows = walletActivity(ALICE,
    [{ from: ALICE, to: BOB, cards: [1, 6], at: 30 }, { from: BOB, to: ALICE, cards: [7], at: 10 }],
    [{ buyer: ALICE, seller: BOB, card: 8, price: 2000, at: 20, via: 'listing' }, { buyer: BOB, seller: ALICE, card: 9, price: 1, at: 40, via: 'offer' }]);
  assert.deepEqual(rows.map(r => r.kind), ['sent', 'bought', 'received']);
});
