import test from 'node:test';
import assert from 'node:assert/strict';
import { boardState, onyxProgress, leftMessage, rewardDue, questsOpenAt, waitLabel, NEW_ACCOUNT_WAIT_MS, clanCashback, rarestPostOk, friendProblem, friendPayAt, pickCardToSend, FRIEND } from '../src/quests.js';

const T0 = Date.UTC(2026, 9, 18);
const buy = (card, clans, at = T0 + 1000, via = 'listing') => ({ card, clans, at, via });

test('paused quests stay on the board with their reason', () => {
  assert.deepEqual(boardState({ id: 'quote', paused: 'no-spots' }), { state: 'paused', label: 'No spots left' });
  assert.equal(boardState({ id: 'quote', paused: 'no-spots', claimed: true }).state, 'claimed', 'a claim made before the pause still shows');
  assert.equal(boardState({ id: 'follow' }).state, 'open');
});

test('Onyx Recruiting: 3 different Onyx cards, listings and accepted offers both count', () => {
  let p = onyxProgress([buy(1, ['onyx', 'sakura'])], { start: T0 });
  assert.equal(p.left, 2);
  assert.equal(p.message, '2 cards left to complete Quest 5 Onyx Recruiting');
  p = onyxProgress([buy(1, ['onyx']), buy(2, ['earth']), buy(1, ['onyx']), buy(3, ['onyx'], T0 + 5, 'offer')], { start: T0 });
  assert.deepEqual(p.cards, [1, 3], 'non-Onyx cards and a card bought back never fill a slot');
  assert.equal(p.message, leftMessage(1));
  assert.equal(leftMessage(1), '1 card left to complete Quest 5 Onyx Recruiting');
  p = onyxProgress([buy(9, ['onyx'], T0 - 1), buy(1, ['onyx']), buy(2, ['onyx']), buy(3, ['onyx']), buy(4, ['onyx'])], { start: T0 });
  assert.deepEqual(p.cards, [1, 2, 3], 'purchases before the start do not count; extra ones are ignored');
  assert.equal(p.complete, true);
});

test('new accounts wait 48h from their earliest activity', () => {
  const H = 3600000;
  assert.equal(questsOpenAt([T0 + 5 * H, null, T0, undefined], T0 + 99 * H), T0 + NEW_ACCOUNT_WAIT_MS, 'the earliest activity of any kind starts the wait');
  assert.equal(questsOpenAt([], T0), T0 + NEW_ACCOUNT_WAIT_MS, 'a wallet never seen waits from now');
  assert.equal(waitLabel(T0 + 6.5 * H, T0), 'New account · opens in 7h');
  assert.equal(waitLabel(T0, T0 + 1), '');
});

test('Quest 4 cashback: 90% of the price, never above the estimate or 20,000 $RYO', () => {
  assert.deepEqual(clanCashback(1000, 5000), { amount: 900, limitedBy: 'price' });
  assert.deepEqual(clanCashback(900000, 4000), { amount: 3600, limitedBy: 'estimate' }, 'an overpriced self-sale earns only the estimate');
  assert.deepEqual(clanCashback(700000, 680000), { amount: 20000, limitedBy: 'cap' });
  assert.equal(clanCashback(22222, 22222).amount, 19999, 'just under the cap stays exact');
});

test('the reward goes out once per wallet', () => {
  const done = onyxProgress([buy(1, ['onyx']), buy(2, ['onyx']), buy(3, ['onyx'])], { start: T0 });
  assert.equal(rewardDue('0xAA', done, new Set()), true);
  assert.equal(rewardDue('0xAA', done, new Set(['0xaa'])), false);
  assert.equal(rewardDue('0xAA', onyxProgress([], { start: T0 }), new Set()), false);
});

test('Quest 6: the post needs both template lines (case, curly quotes, spacing ignored)', () => {
  assert.equal(rarestPostOk('THIS is my rarest @PrimateLegends card rn. Probably nothing...\n\nDon\u2019t sleep on these,   don\u2019t fade the legends'), true);
  assert.equal(rarestPostOk('this is my rarest @primatelegends card rn'), false, 'one line is not enough');
});

test('Quest 7: each friend (wallet and X account) receives once; never yourself', () => {
  const F = '0x' + 'f'.repeat(40), me = '0x' + 'a'.repeat(40);
  const seen = { usedWallets: new Set(), usedHandles: new Set(['friend_one']), handleOwner: new Map([['bobx', '0x' + 'b'.repeat(40)]]) };
  assert.equal(friendProblem({ wallet: me, friendWallet: F, friendHandle: '@my_fren' }, seen), '');
  assert.equal(friendProblem({ wallet: me, friendWallet: me, friendHandle: 'x' }, seen), 'friend-is-you');
  assert.equal(friendProblem({ wallet: me, friendWallet: F, friendHandle: 'FRIEND_ONE' }, seen), 'friend-used', 'handles compare without case');
  assert.equal(friendProblem({ wallet: me, friendWallet: F, friendHandle: 'friend_on' }, seen), '', '_ is not a wildcard');
  assert.equal(friendProblem({ wallet: me, friendWallet: F, friendHandle: 'BobX' }, seen), 'friend-handle-mismatch');
  assert.equal(friendProblem({ wallet: me, friendWallet: F, friendHandle: 'mine', myHandle: 'Mine' }, seen), 'friend-is-you');
  assert.equal(friendProblem({ wallet: me, friendWallet: 'nope', friendHandle: 'x' }, seen), 'bad-friend-wallet');
});

test('Quest 7: the post halves the wait only while it stays up; any movable card can go', () => {
  assert.equal(friendPayAt(T0, { hasPost: true }), T0 + FRIEND.fastWaitMs);
  assert.equal(friendPayAt(T0, { hasPost: true, postUp: false }), T0 + FRIEND.waitMs);
  assert.equal(friendPayAt(T0, { hasPost: false }), T0 + FRIEND.waitMs);
  const cards = [{ no: 1, listed: true }, { no: 2, onHold: true }, { no: 3 }, { no: 4, rarity: 'legendary' }];
  assert.deepEqual([0, 0.99].map(r => pickCardToSend(cards, () => r).no), [3, 4], 'listed and held cards never go; any rarity can');
  assert.equal(pickCardToSend([{ no: 1, inEscrow: true }]), null);
});
