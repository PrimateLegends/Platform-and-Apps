import test from 'node:test';
import assert from 'node:assert/strict';
import { boardState, onyxProgress, leftMessage, rewardDue } from '../src/quests.js';

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

test('the reward goes out once per wallet', () => {
  const done = onyxProgress([buy(1, ['onyx']), buy(2, ['onyx']), buy(3, ['onyx'])], { start: T0 });
  assert.equal(rewardDue('0xAA', done, new Set()), true);
  assert.equal(rewardDue('0xAA', done, new Set(['0xaa'])), false);
  assert.equal(rewardDue('0xAA', onyxProgress([], { start: T0 }), new Set()), false);
});
