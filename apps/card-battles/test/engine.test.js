// Rules tests. Run: node --test apps/card-battles/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, createMatch, replay, RuleError, SHRINE_HEALTH } from '../src/engine.js';
import { validateDeck } from '../src/cards.js';
import { matchScore, updateHonor } from '../src/scoring.js';

const deckOf = ids => Array.from({ length: 40 }, (_, i) => ids[i % ids.length]);
const crimson = deckOf(['crimson-ronin', 'crimson-cut', 'crimson-blade', 'onyx-recruit']);
const sakura = deckOf(['sakura-scout', 'earth-tea', 'earth-disciple', 'sakura-windwalker']);

/** Puts a specific card in a player's hand, for focused tests. */
function give(state, player, cardId) {
  const s = structuredClone(state);
  s.players[player].hand.unshift(cardId);
  s.players[player].ki = s.players[player].maxKi = 10;
  return s;
}

test('a deck needs 40 cards, at most 3 copies and 2 clans', () => {
  assert.deepEqual(validateDeck({ 'crimson-ronin': 3, 'onyx-recruit': 3, 'crimson-cut': 34 }), ['Iaido Cut: at most 3 copies']);
  assert.match(validateDeck({ 'crimson-ronin': 3 })[0], /needs 40/);
  assert.ok(validateDeck({ 'crimson-ronin': 1, 'sakura-scout': 1, 'earth-tea': 1 }).some(p => /3 clans/.test(p)));
});

test('matches are deterministic from their seed', () => {
  const a = createMatch({ seed: 42, decks: [crimson, sakura] });
  const b = createMatch({ seed: 42, decks: [crimson, sakura] });
  assert.deepEqual(a.players.map(p => p.hand), b.players.map(p => p.hand));
  assert.equal(a.round, 1);
  assert.equal(a.players[0].hand.length, 5);   // 4 opening cards + 1 drawn
  assert.equal(a.players[0].maxKi, 1);
});

test('Ki grows every round and unspent Ki becomes Focus Ki (max 3)', () => {
  let s = createMatch({ seed: 1, decks: [crimson, sakura] });
  for (let i = 0; i < 6; i++) s = apply(s, { type: 'pass', player: s.turn });
  assert.equal(s.round, 4);
  assert.equal(s.players[0].maxKi, 4);
  assert.equal(s.players[0].focusKi, 3);
});

test('the attack token alternates between players each round', () => {
  let s = createMatch({ seed: 7, decks: [crimson, sakura] });
  const first = s.attacker;
  s = apply(s, { type: 'pass', player: s.turn });
  s = apply(s, { type: 'pass', player: s.turn });
  assert.equal(s.attacker, first === 0 ? 1 : 0);
});

test('you cannot act out of turn or attack without the token', () => {
  const s = createMatch({ seed: 3, decks: [crimson, sakura] });
  assert.throws(() => apply(s, { type: 'pass', player: s.turn === 0 ? 1 : 0 }), RuleError);
});

test('Quick Blade strikes first and survives a trade it would otherwise lose', () => {
  let s = createMatch({ seed: 5, decks: [crimson, sakura] });
  const atk = s.attacker, dfn = atk === 0 ? 1 : 0;
  s = give(s, atk, 'crimson-ronin');          // 3/1 attack -> Quick Blade
  s = apply(s, { type: 'play', player: atk, handIndex: 0 });
  s = give(s, dfn, 'earth-disciple');         // 1/3 healing -> Mend
  s = apply(s, { type: 'play', player: dfn, handIndex: 0 });
  const ronin = s.players[atk].board[0], disciple = s.players[dfn].board[0];
  s = apply(s, { type: 'attack', player: atk, attackers: [ronin.uid] });
  s = apply(s, { type: 'block', player: dfn, blocks: { 0: disciple.uid } });
  assert.equal(s.players[dfn].board.length, 0, 'the disciple falls to the first strike');
  assert.equal(s.players[atk].board[0].health, 1, 'the ronin takes no damage back');
  assert.equal(s.players[atk].stats.unitsDefeated, 1);
});

test('Shadowstep warriors can only be blocked by Shadowstep warriors', () => {
  let s = createMatch({ seed: 9, decks: [sakura, crimson] });
  const atk = s.attacker, dfn = atk === 0 ? 1 : 0;
  s = give(s, atk, 'sakura-scout');
  s = apply(s, { type: 'play', player: atk, handIndex: 0 });
  s = give(s, dfn, 'onyx-recruit');
  s = apply(s, { type: 'play', player: dfn, handIndex: 0 });
  s = apply(s, { type: 'attack', player: atk, attackers: [s.players[atk].board[0].uid] });
  assert.throws(() => apply(s, { type: 'block', player: dfn, blocks: { 0: s.players[dfn].board[0].uid } }), /Shadowstep/);
  s = apply(s, { type: 'pass', player: dfn });
  assert.equal(s.players[dfn].shrine, SHRINE_HEALTH - 2, 'unblocked damage hits the Shrine');
});

test('Iron Skin takes 1 less damage from every hit', () => {
  let s = createMatch({ seed: 11, decks: [crimson, crimson] });
  const me = s.turn, foe = me === 0 ? 1 : 0;
  s = give(s, foe, 'onyx-recruit');           // 1/2 defense -> Iron Skin
  s.turn = foe; s = apply(s, { type: 'play', player: foe, handIndex: 0 });
  s = give(s, me, 'crimson-cut');             // 2 damage
  s.turn = me; s = apply(s, { type: 'play', player: me, handIndex: 0, target: s.players[foe].board[0].uid });
  assert.equal(s.players[foe].board[0].health, 1, 'only 1 of the 2 damage gets through');
});

test('Burst techniques resolve at once and keep the turn', () => {
  let s = createMatch({ seed: 13, decks: [crimson, sakura] });
  const me = s.turn, foe = me === 0 ? 1 : 0;
  s = give(s, foe, 'sakura-scout');
  s.turn = foe; s = apply(s, { type: 'play', player: foe, handIndex: 0 });
  s = give(s, me, 'crimson-cut');
  s = apply(s, { type: 'play', player: me, handIndex: 0, target: s.players[foe].board[0].uid });
  assert.equal(s.players[foe].board.length, 0);
  assert.equal(s.turn, me, 'burst keeps the turn');
});

test('a warrior becomes a Hero when its condition is met', () => {
  let s = createMatch({ seed: 17, decks: [crimson, crimson] });
  const me = s.turn;
  s = give(s, me, 'onyx-captain');
  s = apply(s, { type: 'play', player: me, handIndex: 0 });
  s.players[me].alliesPlayed = 5;
  s = give(s, me, 'onyx-recruit');
  s.turn = me; s = apply(s, { type: 'play', player: me, handIndex: 0 });
  const captain = s.players[me].board.find(u => u.cardId === 'onyx-captain');
  assert.equal(captain.hero, true);
  assert.equal(captain.power, 6);
});

test('replaying the same actions gives the same result', () => {
  const actions = [];
  let s = createMatch({ seed: 99, decks: [crimson, sakura] });
  for (let i = 0; i < 10; i++) { const a = { type: 'pass', player: s.turn }; actions.push(a); s = apply(s, a); }
  assert.deepEqual(replay({ seed: 99, decks: [crimson, sakura], actions }), s);
});

test('scoring and Honor', () => {
  const state = { winner: 0, players: [{ shrine: 20, stats: { damageDealt: 20, unitsDefeated: 3 } }, { shrine: 0, stats: { damageDealt: 0, unitsDefeated: 0 } }] };
  assert.deepEqual(matchScore(state, 0), { result: 'win', score: 100 + 40 + 15 + 25 });
  assert.deepEqual(matchScore(state, 1), { result: 'loss', score: 10 });
  const [a, b] = updateHonor(1000, 1000, 1);
  assert.equal(a, 1016); assert.equal(b, 984);
  const [c] = updateHonor(1200, 1000, 1);
  assert.ok(c - 1200 < 16, 'beating a weaker player pays less');
});
