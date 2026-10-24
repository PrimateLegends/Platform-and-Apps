import test from 'node:test';
import assert from 'node:assert/strict';
import { deckTarget, deckCompletes, cleanXHandle, handleProblem, handleLockLabel, HANDLE, CLOSED_QUESTS } from '../src/deck-and-handle.js';
import { boardState } from '../src/quests.js';

test('Quest 8 targets the clan you hold least of, among clans on sale', () => {
  assert.equal(deckTarget({ onyx: 4, earth: 1, sakura: 0 }, { onyx: 3, earth: 2, sakura: 0 }), 'earth', 'sakura has nothing for sale');
  assert.equal(deckTarget({}, { ember: 2, void: 5 }), 'void', 'a tie goes to the clan with more listings');
  assert.equal(deckTarget({}, { ember: 2, crimson: 2 }), 'crimson', 'then by name, so it stays put');
  assert.equal(deckTarget({ onyx: 1 }, {}), null);
});

test('Quest 8 completes on one purchase of a card of the target clan, after the wait', () => {
  const state = { target: 'earth', opensAt: 1000, done: false };
  assert.equal(deckCompletes({ at: 999, via: 'listing', clans: ['earth'] }, state), false, 'inside the new-account wait');
  assert.equal(deckCompletes({ at: 2000, via: 'transfer', clans: ['earth'] }, state), false, 'a gift is not a purchase');
  assert.equal(deckCompletes({ at: 2000, via: 'offer', clans: ['onyx', 'earth'] }, state), true, 'any of the card\'s clans');
  assert.equal(deckCompletes({ at: 2000, via: 'listing', clans: ['earth'] }, { ...state, done: true }), false, 'once');
});

test('X handles: links, @ and capitals are cleaned; the official handle is the team\'s', () => {
  for (const s of ['@Primate_Fan', 'Primate_Fan', 'x.com/Primate_Fan', 'https://twitter.com/Primate_Fan?s=20', ' @@Primate_Fan ']) assert.equal(cleanXHandle(s), 'Primate_Fan', s);
  for (const s of ['', '@', 'way_too_long_handle_name', 'bad-dash', 'x.com/']) assert.equal(cleanXHandle(s), '', s);
  const ownerOf = h => ({ taken_one: '0xbbb' })[h];
  const base = { wallet: '0xAAA', now: 10 * HANDLE.cooldownMs, ownerOf };
  assert.equal(handleProblem({ ...base, input: '@PrimateLegends' }), 'official-handle');
  assert.equal(handleProblem({ ...base, input: '@PrimateLegends', isTeam: true }), '');
  assert.equal(handleProblem({ ...base, input: 'taken_one' }), 'taken');
  assert.equal(handleProblem({ ...base, input: 'fresh', lastSetAt: base.now - 3600000 }), 'cooldown');
  assert.equal(handleLockLabel(0, 3600000), 'Set again in 71h');
  assert.equal(handleLockLabel(0, HANDLE.cooldownMs), '');
});

test('closed quests read as paused with no spots left', () => {
  for (const id of CLOSED_QUESTS) assert.equal(boardState({ id, paused: 'no-spots' }).label, 'No spots left');
});
