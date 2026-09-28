/**
 * Primate Legends: Card Battles — rules engine.
 *
 * A match is a pure state machine: `createMatch` builds the initial state and every action goes
 * through `apply(state, action)`, which returns a new state or throws a RuleError. The same code
 * runs in the client (to preview moves) and on the server (the authority that signs results).
 *
 * Round flow
 *   1. Round start: both players gain 1 max Ki (up to 10), refill Ki, draw 1 card, zones trigger.
 *      The attack token passes to the other player.
 *   2. Players alternate actions: play a card, attack (token holder only) or pass.
 *   3. Attack: the attacker sends warriors into lanes, the defender assigns blockers,
 *      then combat resolves lane by lane. Unblocked damage hits the enemy Shrine.
 *   4. When both players pass in a row, the round ends. Up to 3 unspent Ki is kept as Focus Ki,
 *      usable only for techniques.
 *
 * Win: bring the enemy Shrine from 20 to 0. After round 40 the healthier Shrine wins.
 */
import { CARD_BY_ID, KEYWORDS } from './cards.js';
import { createRng } from './rng.js';

export const SHRINE_HEALTH = 20;
export const MAX_KI = 10;
export const MAX_FOCUS_KI = 3;
export const MAX_BOARD = 6;
export const MAX_HAND = 10;
export const OPENING_HAND = 4;
export const MAX_ROUNDS = 40;

export class RuleError extends Error {}

const other = p => (p === 0 ? 1 : 0);
const clone = s => structuredClone(s);

function makeUnit(def, uid) {
  return {
    uid, cardId: def.id, name: def.name, type: def.type,
    power: def.power, health: def.health, maxHealth: def.health,
    keyword: KEYWORDS[def.type], hero: false, attacks: 0
  };
}

/**
 * @param {{ seed:number, decks:[string[], string[]] }} opts  decks are lists of card ids (40 each)
 */
export function createMatch({ seed, decks }) {
  const rng = createRng(seed);
  const players = decks.map((deck, i) => {
    const library = rng.shuffle(deck);
    return {
      id: i, shrine: SHRINE_HEALTH, ki: 0, maxKi: 0, focusKi: 0,
      hand: library.splice(0, OPENING_HAND), deck: library,
      board: [], zones: [], alliesPlayed: 0,
      stats: { damageDealt: 0, unitsDefeated: 0, cardsPlayed: 0 }
    };
  });
  const state = {
    seed, round: 0, attacker: 1, turn: 0, passes: 0, nextUid: 1,
    players, combat: null, winner: null, log: []
  };
  return startRound(state);
}

function draw(player) {
  const card = player.deck.shift();
  if (card && player.hand.length < MAX_HAND) player.hand.push(card);
}

function startRound(prev) {
  const s = clone(prev);
  s.round += 1;
  s.attacker = other(s.attacker);
  s.turn = s.attacker;
  s.passes = 0;
  for (const p of s.players) {
    p.maxKi = Math.min(MAX_KI, p.maxKi + 1);
    p.ki = p.maxKi;
    draw(p);
    for (const z of p.zones) {
      const heal = CARD_BY_ID[z].effect?.roundStart?.healShrine || 0;
      p.shrine = Math.min(SHRINE_HEALTH, p.shrine + heal);
    }
  }
  s.log.push({ round: s.round, event: 'round-start', attacker: s.attacker });
  return s;
}

function endRound(prev) {
  const s = clone(prev);
  for (const p of s.players) p.focusKi = Math.min(MAX_FOCUS_KI, p.focusKi + p.ki);
  if (s.round >= MAX_ROUNDS) {
    const [a, b] = s.players;
    s.winner = a.shrine === b.shrine ? 'draw' : a.shrine > b.shrine ? 0 : 1;
    return s;
  }
  return startRound(s);
}

function pay(player, def) {
  const canUseFocus = def.kind === 'technique';
  const available = player.ki + (canUseFocus ? player.focusKi : 0);
  if (def.cost > available) throw new RuleError(`not enough Ki for ${def.name}`);
  const fromKi = Math.min(player.ki, def.cost);
  player.ki -= fromKi;
  player.focusKi -= def.cost - fromKi;
}

function checkHero(unit, player) {
  const def = CARD_BY_ID[unit.cardId];
  if (!def.hero || unit.hero) return;
  const c = def.hero.condition;
  const met = (c.alliesPlayed && player.alliesPlayed >= c.alliesPlayed) || (c.attacks && unit.attacks >= c.attacks);
  if (!met) return;
  const healed = def.hero.health - unit.maxHealth;
  Object.assign(unit, { hero: true, power: def.hero.power, maxHealth: def.hero.health, health: unit.health + healed });
}

function damageUnit(unit, amount) {
  const dealt = unit.keyword === 'ironSkin' ? Math.max(0, amount - 1) : amount;
  unit.health -= dealt;
  return dealt;
}

function cleanup(s) {
  s.players.forEach((p, i) => {
    const dead = p.board.filter(u => u.health <= 0);
    s.players[other(i)].stats.unitsDefeated += dead.length;
    p.board = p.board.filter(u => u.health > 0);
  });
  s.players.forEach((p, i) => { if (p.shrine <= 0 && s.winner === null) s.winner = other(i); });
}

/* ---------------- actions ---------------- */

function playCard(s, pid, { handIndex, target }) {
  const p = s.players[pid];
  const cardId = p.hand[handIndex];
  const def = CARD_BY_ID[cardId];
  if (!def) throw new RuleError('no card in that hand slot');
  if (s.combat && def.speed !== 'swift' && def.speed !== 'burst') throw new RuleError(`${def.name} can't be played during combat`);
  pay(p, def);
  p.hand.splice(handIndex, 1);
  p.stats.cardsPlayed += 1;
  const foe = s.players[other(pid)];

  if (def.kind === 'warrior') {
    if (p.board.length >= MAX_BOARD) throw new RuleError('board is full');
    p.board.push(makeUnit(def, s.nextUid++));
    p.alliesPlayed += 1;
    p.board.forEach(u => checkHero(u, p));
  } else if (def.kind === 'zone') {
    p.zones.push(def.id);
  } else if (def.kind === 'relic') {
    const unit = p.board.find(u => u.uid === target);
    if (!unit) throw new RuleError('relics need one of your warriors as target');
    unit.power += def.effect.buff.power || 0;
  } else {
    const e = def.effect;
    if (e.damage) {
      const unit = foe.board.find(u => u.uid === target);
      if (!unit) throw new RuleError('choose an enemy warrior');
      damageUnit(unit, e.damage);
    }
    if (e.healShrine) p.shrine = Math.min(SHRINE_HEALTH, p.shrine + e.healShrine);
    if (e.buffAll) p.board.forEach(u => { u.health += e.buffAll.health; u.maxHealth += e.buffAll.health; });
    if (e.recall) {
      const i = foe.board.findIndex(u => u.uid === target);
      if (i === -1) throw new RuleError('choose an enemy warrior');
      const [unit] = foe.board.splice(i, 1);
      if (foe.hand.length < MAX_HAND) foe.hand.push(unit.cardId);
    }
  }
  cleanup(s);
  // Burst resolves instantly and keeps the turn; everything else passes it.
  if (def.speed !== 'burst') s.turn = other(pid);
  s.passes = 0;
}

function declareAttack(s, pid, { attackers }) {
  if (pid !== s.attacker) throw new RuleError('you do not hold the attack token this round');
  if (s.combat) throw new RuleError('already in combat');
  const p = s.players[pid];
  const lanes = attackers.map(uid => {
    const unit = p.board.find(u => u.uid === uid);
    if (!unit) throw new RuleError('attacker not on your board');
    unit.attacks += 1;
    return { attacker: uid, blocker: null };
  });
  if (!lanes.length) throw new RuleError('choose at least one attacker');
  s.combat = { lanes };
  s.turn = other(pid);
}

function declareBlocks(s, pid, { blocks }) {
  if (!s.combat || pid === s.attacker) throw new RuleError('nothing to block');
  const me = s.players[pid], foe = s.players[s.attacker];
  const used = new Set();
  for (const [laneIndex, blockerUid] of Object.entries(blocks)) {
    const lane = s.combat.lanes[laneIndex];
    const blocker = me.board.find(u => u.uid === blockerUid);
    const attacker = foe.board.find(u => u.uid === lane?.attacker);
    if (!lane || !blocker || used.has(blockerUid)) throw new RuleError('invalid block');
    if (attacker.keyword === 'shadowstep' && blocker.keyword !== 'shadowstep') throw new RuleError(`${attacker.name} can only be blocked by Shadowstep warriors`);
    lane.blocker = blockerUid;
    used.add(blockerUid);
  }
  resolveCombat(s);
}

function strike(from, to) {
  if (from.health <= 0 || to.health <= 0) return;
  damageUnit(to, from.power);
}

function resolveCombat(s) {
  const atk = s.players[s.attacker], def = s.players[other(s.attacker)];
  for (const lane of s.combat.lanes) {
    const a = atk.board.find(u => u.uid === lane.attacker);
    if (!a) continue;
    const b = def.board.find(u => u.uid === lane.blocker);
    if (!b) {
      def.shrine -= a.power;
      atk.stats.damageDealt += a.power;
    } else if (a.keyword === 'quickBlade' && b.keyword !== 'quickBlade') {
      strike(a, b); strike(b, a);
    } else if (b.keyword === 'quickBlade' && a.keyword !== 'quickBlade') {
      strike(b, a); strike(a, b);
    } else {
      const aPower = a.power, bPower = b.power;
      damageUnit(b, aPower); damageUnit(a, bPower);
    }
    for (const [unit, owner] of [[a, atk], [b, def]]) {
      if (unit && unit.health > 0 && unit.keyword === 'mend') owner.shrine = Math.min(SHRINE_HEALTH, owner.shrine + 1);
    }
    checkHero(a, atk);
  }
  s.combat = null;
  cleanup(s);
  s.turn = other(s.attacker);
  s.passes = 0;
}

/** Applies one action and returns the new state. Actions: play, attack, block, pass. */
export function apply(prev, action) {
  if (prev.winner !== null) throw new RuleError('the match is over');
  const s = clone(prev);
  const pid = action.player;
  if (pid !== s.turn) throw new RuleError('not your turn');
  switch (action.type) {
    case 'play': playCard(s, pid, action); break;
    case 'attack': declareAttack(s, pid, action); break;
    case 'block': declareBlocks(s, pid, action); break;
    case 'pass': {
      if (s.combat) { declareBlocks(s, pid, { blocks: {} }); break; }
      s.passes += 1;
      s.turn = other(pid);
      s.log.push({ round: s.round, event: 'pass', player: pid });
      if (s.passes >= 2) return endRound(s);
      break;
    }
    default: throw new RuleError('unknown action ' + action.type);
  }
  s.log.push({ round: s.round, event: action.type, player: pid });
  return s;
}

/** Replays a whole match from its seed and actions (what the server does before signing). */
export function replay({ seed, decks, actions }) {
  return actions.reduce(apply, createMatch({ seed, decks }));
}
