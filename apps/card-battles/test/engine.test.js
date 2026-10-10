// Rules tests (rules v1). Run: node --test apps/card-battles/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, createMatch, replay, settleStake, RuleError, START_POINTS } from '../src/engine.js';
import { validateDeck, fillWithStarters, budgetDelta, CARDS } from '../src/cards.js';
import { matchScore, updateHonor } from '../src/scoring.js';

const deckOf = ids => Array.from({ length: 40 }, (_, i) => ids[i % ids.length]);
const crimson = deckOf(['wandering-blade', 'kunai-volley', 'golden-katana', 'harvest-guard']);
const earth = deckOf(['harvest-guard', 'sky-disciple', 'midnight-study', 'iron-resolve']);

/** Puts a card in a player's hand with full KI and gives them the action, for focused tests. */
function give(state, player, cardId) {
  const s = structuredClone(state);
  s.players[player].hand.unshift(cardId);
  s.players[player].ki = s.players[player].maxKi = 10;
  s.turn = player;
  return s;
}
const play = (s, player, cardId, target) => apply(give(s, player, cardId), { type: 'play', player, handIndex: 0, target });
const unit = (s, player, cardId) => s.players[player].board.find(u => u.cardId === cardId);
function fight(s, atk, attackerId, blockerId, extra = {}) {
  const dfn = atk === 0 ? 1 : 0;
  s = structuredClone(s); s.turn = atk; s.attacker = atk;
  s = apply(s, { type: 'attack', player: atk, attackers: [unit(s, atk, attackerId).uid], ...extra });
  if (extra.challenges) return apply(s, { type: 'pass', player: dfn });
  return apply(s, { type: 'block', player: dfn, blocks: blockerId ? { 0: unit(s, dfn, blockerId).uid } : {} });
}

test('deck rules: 40 cards, 3 copies, 2 clans, 6 Legendary, 1 Exclusive; shared cards are free', () => {
  assert.deepEqual(validateDeck({ 'wandering-blade': 3, 'harvest-guard': 3, 'kunai-volley': 34 }), ['Kunai Volley: at most 3 copies']);
  assert.match(validateDeck({ 'wandering-blade': 3 })[0], /needs 40/);
  assert.ok(validateDeck({ 'wandering-blade': 1, 'phase-thief': 1, 'wisp-dancer': 1 }).some(p => /3 clans/.test(p)));
  assert.ok(!validateDeck({ 'wandering-blade': 3, 'harvest-guard': 3, 'kunai-volley': 3, 'golden-katana': 3 }).some(p => /clans/.test(p)), 'neutral and armory cards never count as a clan');
  assert.ok(validateDeck({ 'crimson-duelist': 3, 'golden-katana': 3, 'echo-katana': 1 }).some(p => /7 Legendary/.test(p)));
  assert.ok(validateDeck({ 'the-cloak': 2 }).some(p => /1 copy/.test(p)));
});

test('Starter scrolls fill any collection to a legal deck', () => {
  const deck = fillWithStarters({ 'wandering-blade': 3, 'kunai-volley': 2 });
  assert.equal(Object.values(deck).reduce((a, b) => a + b, 0), 40);
  assert.deepEqual(validateDeck(deck), []);
});

test('every warrior in the starter set respects the stat budget (Legendary +1, Exclusive +3/+4)', () => {
  for (const c of CARDS.filter(c => c.kind === 'warrior')) {
    const d = budgetDelta(c), max = c.exclusive ? 4 : c.rarity === 'legendary' ? 1 : 0;
    assert.ok(d <= max && d >= -2, `${c.name} is ${d} off budget`);
  }
});

test('matches are deterministic; KI grows and up to 3 unspent KI is kept as spare KI', () => {
  const a = createMatch({ seed: 42, decks: [crimson, earth] });
  const b = createMatch({ seed: 42, decks: [crimson, earth] });
  assert.deepEqual(a.players.map(p => p.hand), b.players.map(p => p.hand));
  assert.equal(a.players[0].hand.length, 5);
  let s = a;
  for (let i = 0; i < 6; i++) s = apply(s, { type: 'pass', player: s.turn });
  assert.equal(s.round, 4);
  assert.equal(s.players[0].maxKi, 4);
  assert.equal(s.players[0].spareKi, 3);
});

test('the attack token alternates; only its holder can attack', () => {
  let s = createMatch({ seed: 7, decks: [crimson, earth] });
  const first = s.attacker;
  s = apply(s, { type: 'pass', player: s.turn });
  s = apply(s, { type: 'pass', player: s.turn });
  assert.equal(s.attacker, first === 0 ? 1 : 0);
  assert.throws(() => apply(s, { type: 'pass', player: s.turn === 0 ? 1 : 0 }), RuleError);
});

test('FIRST STRIKE hits before the blocker and survives a trade it would otherwise lose', () => {
  let s = createMatch({ seed: 5, decks: [crimson, earth] });
  s = play(s, 0, 'wandering-blade');            // 2/1 FIRST STRIKE
  s = play(s, 1, 'sky-disciple');               // 2/2
  s.players[1].board[0].def = 2;
  s = fight(s, 0, 'wandering-blade', 'sky-disciple');
  assert.equal(s.players[1].board.length, 0, 'the disciple falls to the first strike');
  assert.equal(unit(s, 0, 'wandering-blade').def, 1, 'no damage comes back');
});

test('SHADOW can only be blocked by SHADOW or SHARPEYE; unblocked damage hits the points', () => {
  let s = createMatch({ seed: 9, decks: [earth, crimson] });
  s = play(s, 0, 'phase-thief');
  s = play(s, 1, 'harvest-guard');
  s.turn = 0; s.attacker = 0;
  s = apply(s, { type: 'attack', player: 0, attackers: [unit(s, 0, 'phase-thief').uid] });
  assert.throws(() => apply(s, { type: 'block', player: 1, blocks: { 0: unit(s, 1, 'harvest-guard').uid } }), /SHADOW/);
  s = apply(s, { type: 'pass', player: 1 });
  assert.equal(s.players[1].points, START_POINTS - 2);
  let t = createMatch({ seed: 9, decks: [earth, crimson] });
  t = play(t, 0, 'phase-thief'); t = play(t, 1, 'moon-watch');
  t = fight(t, 0, 'phase-thief', 'moon-watch');
  assert.equal(t.players[0].board.length, 0, 'SHARPEYE blocks and wins');
});

test('INTIMIDATE can only be blocked by warriors with 3+ ATK', () => {
  let s = createMatch({ seed: 4, decks: [earth, crimson] });
  s = play(s, 0, 'sky-disciple'); s = play(s, 1, 'harvest-guard');
  s.turn = 0; s.attacker = 0;
  s = apply(s, { type: 'attack', player: 0, attackers: [unit(s, 0, 'sky-disciple').uid] });
  assert.throws(() => apply(s, { type: 'block', player: 1, blocks: { 0: unit(s, 1, 'harvest-guard').uid } }), /INTIMIDATE/);
});

test('CHALLENGE chooses its blocker; ASCEND triggers after two kills', () => {
  let s = createMatch({ seed: 21, decks: [crimson, earth] });
  s = play(s, 0, 'crimson-duelist');             // 4/3 CHALLENGE, ascend after 2 kills
  s = play(s, 1, 'phase-thief'); s = play(s, 1, 'wandering-blade');
  s = fight(s, 0, 'crimson-duelist', null, { challenges: { [unit(s, 0, 'crimson-duelist').uid]: unit(s, 1, 'phase-thief').uid } });
  assert.equal(unit(s, 1, 'phase-thief'), undefined, 'the challenged warrior had to block and fell');
  s = fight(s, 0, 'crimson-duelist', null, { challenges: { [unit(s, 0, 'crimson-duelist').uid]: unit(s, 1, 'wandering-blade').uid } });
  const d = unit(s, 0, 'crimson-duelist');
  assert.equal(d.ascended, true);
  assert.equal(d.atk, 6);
  assert.ok(d.keywords.includes('firstStrike'));
});

test('IRON SKIN takes 1 less from every source; DODGE negates the next damage', () => {
  let s = createMatch({ seed: 11, decks: [crimson, crimson] });
  s = play(s, 1, 'harvest-guard');               // 1/3 IRON SKIN
  s = play(s, 0, 'kunai-volley', unit(s, 1, 'harvest-guard').uid);
  assert.equal(unit(s, 1, 'harvest-guard').def, 2);
  s = play(s, 1, 'wisp-dancer');                 // 2/2 DODGE
  s = play(s, 0, 'kunai-volley', unit(s, 1, 'wisp-dancer').uid);
  assert.equal(unit(s, 1, 'wisp-dancer').def, 2, 'the dodge ate the volley');
  assert.equal(unit(s, 1, 'wisp-dancer').dodge, false);
});

test('equipment: BREAKTHROUGH spills over, and the blade returns to hand when its warrior falls', () => {
  let s = createMatch({ seed: 30, decks: [crimson, earth] });
  s = play(s, 0, 'wandering-blade');
  s = play(s, 0, 'golden-katana', unit(s, 0, 'wandering-blade').uid);   // 5/1 FIRST STRIKE BREAKTHROUGH
  s = play(s, 1, 'harvest-guard');               // 1/3 IRON SKIN
  s = fight(s, 0, 'wandering-blade', 'harvest-guard');
  assert.equal(s.players[1].points, START_POINTS - 1, '4 dealt to a 3-DEF guard: 1 spills to the points');
  s = play(s, 1, 'kunai-volley', unit(s, 0, 'wandering-blade').uid);
  assert.equal(s.players[0].board.length, 0);
  assert.ok(s.players[0].hand.includes('golden-katana'), 'the katana went back to the hand');
});

test('ECHO KATANA: after it strikes, its warrior deals double damage next round', () => {
  let s = createMatch({ seed: 31, decks: [crimson, earth] });
  s = play(s, 0, 'harvest-guard');
  s = play(s, 0, 'echo-katana', unit(s, 0, 'harvest-guard').uid);        // 3/3
  s = fight(s, 0, 'harvest-guard', null);
  assert.equal(s.players[1].points, START_POINTS - 3);
  s = apply(s, { type: 'pass', player: s.turn }); s = apply(s, { type: 'pass', player: s.turn });   // next round
  s = fight(s, 0, 'harvest-guard', null);
  assert.equal(s.players[1].points, START_POINTS - 3 - 6, 'the echo round hits twice as hard');
});

test('LIFESTEAL heals your points; TWIN STRIKE hits first and again', () => {
  let s = createMatch({ seed: 40, decks: [crimson, earth] });
  s.players[0].points = 10;
  s = play(s, 0, 'flame-drinker');               // 3/2 LIFESTEAL
  s = fight(s, 0, 'flame-drinker', null);
  assert.equal(s.players[0].points, 13);
  s = play(s, 0, 'ember-berserker');             // 5/2 TWIN STRIKE
  s = play(s, 1, 'waterfall-monk');              // 2/5 IRON SKIN REGENERATE
  s = fight(s, 0, 'ember-berserker', 'waterfall-monk');
  assert.equal(unit(s, 1, 'waterfall-monk'), undefined, '4 + 4 through IRON SKIN beats 5 DEF');
});

test('SPELL WARD negates the first enemy tactic; INSTANT keeps the action', () => {
  let s = createMatch({ seed: 13, decks: [crimson, earth] });
  s = play(s, 1, 'harvest-guard');
  s.players[1].board[0].spellWard = true;
  s = play(s, 0, 'kunai-volley', unit(s, 1, 'harvest-guard').uid);
  assert.equal(unit(s, 1, 'harvest-guard').def, 3, 'warded');
  s = play(s, 0, 'wandering-blade');
  s = play(s, 0, 'iron-resolve', unit(s, 0, 'wandering-blade').uid);
  assert.equal(s.turn, 0, 'instant keeps the action');
  assert.equal(unit(s, 0, 'wandering-blade').def, 4);
});

test('the winner takes half of the loser\'s deck, recomputable from the seed', () => {
  const s = { seed: 77, winner: 0, decks: [crimson, earth] };
  const stake = settleStake(s);
  assert.equal(stake.from, 1); assert.equal(stake.to, 0);
  assert.equal(stake.cards.length, 20);
  assert.deepEqual(settleStake(s), stake);
  assert.equal(settleStake({ ...s, winner: 'draw' }), null);
});

test('replaying the same actions gives the same result', () => {
  const actions = [];
  let s = createMatch({ seed: 99, decks: [crimson, earth] });
  for (let i = 0; i < 10; i++) { const a = { type: 'pass', player: s.turn }; actions.push(a); s = apply(s, a); }
  assert.deepEqual(replay({ seed: 99, decks: [crimson, earth], actions }), s);
});

test('scoring and Honor', () => {
  const state = { winner: 0, players: [{ points: 20, stats: { damageDealt: 20, unitsDefeated: 3 } }, { points: 0, stats: { damageDealt: 0, unitsDefeated: 0 } }] };
  assert.deepEqual(matchScore(state, 0), { result: 'win', score: 100 + 40 + 15 + 25 });
  assert.deepEqual(matchScore(state, 1), { result: 'loss', score: 10 });
  const [a, b] = updateHonor(1000, 1000, 1);
  assert.equal(a, 1016); assert.equal(b, 984);
});
