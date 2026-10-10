/**
 * Primate Legends: Card Battles — rules engine (rules v1).
 *
 * A match is a pure state machine: `createMatch` builds the initial state and every action goes
 * through `apply(state, action)`, which returns a new state or throws a RuleError. The same code
 * runs in the client (to preview moves) and on the server (the authority that signs results).
 *
 * Round flow
 *   1. Round start: both players gain 1 max KI (up to 10), refill KI and draw 1 card. The attack
 *      token passes to the other player. Locations and in-play items trigger.
 *   2. Players alternate actions: play a card, attack (token holder only) or pass.
 *   3. Attack: the attacker sends warriors (CHALLENGE warriors pick their blocker), the defender
 *      assigns blockers, then each lane resolves. Unblocked damage hits the enemy points.
 *   4. When both players pass in a row, the round ends: up to 3 unspent KI is saved as spare KI
 *      (tactics only), MIRAGE warriors fall, this-round effects wear off, REGENERATE heals.
 *
 * Damage stays on a warrior until it is healed. Win: bring the enemy from 20 points to 0.
 * After round 40 the player with more points wins. The winner takes half of the loser's deck.
 */
import { CARD_BY_ID } from './cards.js';
import { createRng } from './rng.js';

export const START_POINTS = 20;
export const MAX_KI = 10;
export const MAX_SPARE_KI = 3;
export const MAX_BOARD = 6;
export const MAX_HAND = 10;
export const OPENING_HAND = 4;
export const MAX_ROUNDS = 40;

export class RuleError extends Error {}

const other = p => (p === 0 ? 1 : 0);
const clone = s => structuredClone(s);
const has = (unit, kw) => unit.keywords.includes(kw) || unit.temp.keywords.includes(kw);

function makeUnit(def, uid, round) {
  return {
    uid, cardId: def.id, name: def.name, style: def.style,
    atk: def.atk, def: def.def, maxDef: def.def,
    keywords: [...(def.keywords || [])], sealed: false,
    temp: { atk: 0, def: 0, keywords: [] },
    dodge: (def.keywords || []).includes('dodge'),
    spellWard: (def.keywords || []).includes('spellWard'),
    strikes: 0, kills: 0, ascended: false, echoRound: 0, equipment: [], summoned: round
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
      id: i, points: START_POINTS, ki: 0, maxKi: 0, spareKi: 0,
      hand: library.splice(0, OPENING_HAND), deck: library,
      board: [], places: [], usedEquipment: [], mustPass: false,
      stats: { damageDealt: 0, unitsDefeated: 0, cardsPlayed: 0, tacticsPlayed: 0 }
    };
  });
  const state = {
    seed, decks, round: 0, attacker: 1, turn: 0, passes: 0, nextUid: 1, attacked: false,
    players, combat: null, winner: null, log: []
  };
  return startRound(state);
}

function draw(player, n = 1) {
  for (let i = 0; i < n; i++) {
    const card = player.deck.shift();
    if (card && player.hand.length < MAX_HAND) player.hand.push(card);
  }
}

function startRound(prev) {
  const s = clone(prev);
  s.round += 1;
  s.attacker = s.tokenTo ?? other(s.attacker);
  delete s.tokenTo;
  s.turn = s.attacker;
  s.passes = 0;
  s.attacked = false;
  for (const p of s.players) {
    p.maxKi = Math.min(MAX_KI, p.maxKi + 1);
    p.ki = p.maxKi;
    p.usedEquipment = [];
    draw(p);
    for (const place of p.places) {
      const rs = CARD_BY_ID[place].effect?.roundStart;
      if (!rs) continue;
      if (rs.spareKi) p.spareKi = Math.min(MAX_SPARE_KI, p.spareKi + rs.spareKi);
      if (rs.healAllies) p.board.forEach(u => { u.def = Math.min(u.maxDef, u.def + rs.healAllies); });
      if (rs.buffAllies) p.board.forEach(u => { u.def += rs.buffAllies.def || 0; u.maxDef += rs.buffAllies.def || 0; u.atk += rs.buffAllies.atk || 0; });
    }
  }
  s.log.push({ round: s.round, event: 'round-start', attacker: s.attacker });
  return s;
}

function endRound(prev) {
  const s = clone(prev);
  for (const p of s.players) {
    p.spareKi = Math.min(MAX_SPARE_KI, p.spareKi + p.ki);
    p.board = p.board.filter(u => !has(u, 'mirage'));
    for (const u of p.board) {
      u.atk -= u.temp.atk; u.def = Math.max(1, u.def - u.temp.def); u.maxDef -= u.temp.def;
      u.temp = { atk: 0, def: 0, keywords: [] };
      u.dodge = false;
      if (has(u, 'regenerate')) u.def = u.maxDef;
    }
    for (const u of p.board) {
      const heal = CARD_BY_ID[u.cardId].effect?.roundEnd?.healWeakest;
      if (heal && !u.sealed) {
        const weakest = [...p.board].sort((a, b) => a.def - b.def)[0];
        weakest.def = Math.min(weakest.maxDef, weakest.def + heal);
      }
    }
  }
  if (s.round >= MAX_ROUNDS) {
    const [a, b] = s.players;
    s.winner = a.points === b.points ? 'draw' : a.points > b.points ? 0 : 1;
    return s;
  }
  return startRound(s);
}

function pay(player, def) {
  const spare = def.kind === 'tactic' ? player.spareKi : 0;
  if (def.cost > player.ki + spare) throw new RuleError(`not enough KI for ${def.name}`);
  const fromKi = Math.min(player.ki, def.cost);
  player.ki -= fromKi;
  player.spareKi -= def.cost - fromKi;
}

function checkAscend(unit) {
  const def = CARD_BY_ID[unit.cardId];
  if (!def.ascend || unit.ascended || unit.sealed) return;
  const w = def.ascend.when;
  const met = (w.kills && unit.kills >= w.kills) || (w.strikes && unit.strikes >= w.strikes);
  if (!met) return;
  unit.ascended = true;
  unit.atk += def.ascend.atk; unit.def += def.ascend.def; unit.maxDef += def.ascend.def;
  for (const k of def.ascend.keywords || []) if (!unit.keywords.includes(k)) unit.keywords.push(k);
}

/** Deals damage to a warrior. Returns how much it actually lost (after DODGE and IRON SKIN). */
function damageUnit(unit, amount) {
  if (amount <= 0) return 0;
  if (unit.dodge) { unit.dodge = false; return 0; }
  const dealt = has(unit, 'ironSkin') ? Math.max(0, amount - 1) : amount;
  unit.def -= dealt;
  return dealt;
}

function power(s, unit) {
  return unit.echoRound === s.round ? unit.atk * 2 : unit.atk;
}

function cleanup(s) {
  s.players.forEach((p, i) => {
    const dead = p.board.filter(u => u.def <= 0);
    s.players[other(i)].stats.unitsDefeated += dead.length;
    for (const u of dead) for (const eq of u.equipment) if (p.hand.length < MAX_HAND) p.hand.push(eq);   // equipment returns to hand
    p.board = p.board.filter(u => u.def > 0);
  });
  s.players.forEach((p, i) => { if (p.points <= 0 && s.winner === null) s.winner = other(i); });
}

/** Resolves the target of a tactic aimed at a warrior; SPELL WARD negates the first enemy tactic. */
function targetUnit(s, pid, target, side) {
  const owner = side === 'enemy' ? s.players[other(pid)] : s.players[pid];
  const unit = owner.board.find(u => u.uid === target);
  if (!unit) throw new RuleError(side === 'enemy' ? 'choose an enemy warrior' : 'choose one of your warriors');
  if (side === 'enemy' && unit.spellWard) { unit.spellWard = false; return null; }
  return unit;
}

/* ---------------- actions ---------------- */

function playCard(s, pid, { handIndex, target }) {
  const p = s.players[pid];
  const cardId = p.hand[handIndex];
  const def = CARD_BY_ID[cardId];
  if (!def) throw new RuleError('no card in that hand slot');
  if (p.mustPass) throw new RuleError('you lost this action and must pass');
  if (s.combat && !(def.kind === 'tactic' && def.speed !== 'ritual')) throw new RuleError(`${def.name} can't be played during combat`);
  if ((def.kind === 'warrior' || def.kind === 'location' || def.effect?.inPlay) && p.board.length + p.places.length >= MAX_BOARD) throw new RuleError('board is full');
  if (def.kind === 'equipment' && p.usedEquipment.includes(def.id)) throw new RuleError(`${def.name} was already equipped this round`);
  pay(p, def);
  p.hand.splice(handIndex, 1);
  p.stats.cardsPlayed += 1;
  const foe = s.players[other(pid)];
  const e = def.effect || {};

  if (def.kind === 'warrior') {
    const unit = makeUnit(def, s.nextUid++, s.round);
    p.board.push(unit);
    if (e.onPlay?.buffOthers) for (const u of p.board) if (u !== unit) { u.atk += e.onPlay.buffOthers.atk; u.def += e.onPlay.buffOthers.def; u.maxDef += e.onPlay.buffOthers.def; u.temp.atk += e.onPlay.buffOthers.atk; u.temp.def += e.onPlay.buffOthers.def; }
    if (e.onPlay?.damageAllEnemies) foe.board.forEach(u => damageUnit(u, e.onPlay.damageAllEnemies));
  } else if (def.kind === 'location' || e.inPlay) {
    p.places.push(def.id);
  } else if (def.kind === 'equipment' || def.kind === 'item') {
    const unit = p.board.find(u => u.uid === target);
    if (!unit) throw new RuleError(`${def.name} needs one of your warriors as target`);
    const b = e.buff || e.attach || {};
    unit.atk += b.atk || 0; unit.def += b.def || 0; unit.maxDef += b.def || 0;
    if (e.grant && !unit.keywords.includes(e.grant)) unit.keywords.push(e.grant);
    if (e.echo) unit.echo = true;
    if (def.kind === 'equipment') { unit.equipment.push(def.id); p.usedEquipment.push(def.id); }
  } else {
    p.stats.tacticsPlayed += 1;
    if (e.damage) {
      if (target === 'points' && e.orPoints) { foe.points -= e.damage; p.stats.damageDealt += e.damage; }
      else { const u = targetUnit(s, pid, target, 'enemy'); if (u) damageUnit(u, e.damage); }
    }
    if (e.defeat) { const u = targetUnit(s, pid, target, 'enemy'); if (u) u.def = 0; }
    if (e.seal) { const u = targetUnit(s, pid, target, 'enemy'); if (u) Object.assign(u, { keywords: [], sealed: true, dodge: false, spellWard: false }); }
    if (e.buff) {
      const u = targetUnit(s, pid, target, 'ally');
      u.atk += e.buff.atk || 0; u.def += e.buff.def || 0; u.maxDef += e.buff.def || 0;
      if (e.thisRound) { u.temp.atk += e.buff.atk || 0; u.temp.def += e.buff.def || 0; }
      if (e.grant) (e.thisRound ? u.temp.keywords : u.keywords).push(e.grant);
    }
    if (e.damageAllEnemies) foe.board.forEach(u => damageUnit(u, e.damageAllEnemies));
    if (e.takeToken && !s.attacked) s.attacker = pid;
    if (e.draw) draw(p, e.draw);
  }
  cleanup(s);
  // INSTANT resolves at once and keeps the action; everything else passes it.
  if (!(def.kind === 'tactic' && def.speed === 'instant')) s.turn = other(pid);
  s.passes = 0;
}

function declareAttack(s, pid, { attackers, challenges = {} }) {
  if (pid !== s.attacker) throw new RuleError('you do not hold the attack token this round');
  if (s.combat) throw new RuleError('already in combat');
  const p = s.players[pid], foe = s.players[other(pid)];
  const lanes = attackers.map(uid => {
    const unit = p.board.find(u => u.uid === uid);
    if (!unit) throw new RuleError('attacker not on your board');
    let blocker = null;
    if (challenges[uid] !== undefined) {
      if (!has(unit, 'challenge')) throw new RuleError(`${unit.name} has no CHALLENGE`);
      if (!foe.board.some(u => u.uid === challenges[uid])) throw new RuleError('challenged warrior not on the enemy board');
      blocker = challenges[uid];
    }
    return { attacker: uid, blocker, challenged: blocker !== null };
  });
  if (!lanes.length) throw new RuleError('choose at least one attacker');
  s.combat = { lanes };
  s.attacked = true;
  s.turn = other(pid);
}

function canBlock(attacker, blocker) {
  if (has(attacker, 'shadow') && !has(blocker, 'shadow') && !has(blocker, 'sharpeye')) return `${attacker.name} has SHADOW`;
  if (has(attacker, 'intimidate') && blocker.atk < 3) return `${attacker.name} has INTIMIDATE: only warriors with 3+ ATK can block it`;
  return null;
}

function declareBlocks(s, pid, { blocks }) {
  if (!s.combat || pid === s.attacker) throw new RuleError('nothing to block');
  const me = s.players[pid], foe = s.players[s.attacker];
  const used = new Set(s.combat.lanes.filter(l => l.challenged).map(l => l.blocker));
  for (const [laneIndex, blockerUid] of Object.entries(blocks)) {
    const lane = s.combat.lanes[laneIndex];
    const blocker = me.board.find(u => u.uid === blockerUid);
    const attacker = foe.board.find(u => u.uid === lane?.attacker);
    if (!lane || !blocker || used.has(blockerUid) || lane.challenged) throw new RuleError('invalid block');
    const why = canBlock(attacker, blocker);
    if (why) throw new RuleError(why);
    lane.blocker = blockerUid;
    used.add(blockerUid);
  }
  resolveCombat(s);
}

/** One warrior strikes another. Handles BREAKTHROUGH, LIFESTEAL, BLOODLUST, MIRAGE and the echo blade. */
function strike(s, from, to, owner, foe, attacking) {
  if (from.def <= 0 || to.def <= 0) return;
  const hit = power(s, from);
  const before = to.def;
  const dealt = damageUnit(to, hit);
  from.strikes += 1;
  if (from.echo) from.echoRound = s.round + 1;
  if (has(from, 'lifesteal')) owner.points = Math.min(START_POINTS, owner.points + dealt);
  if (attacking && has(from, 'breakthrough') && dealt > before) { foe.points -= dealt - before; owner.stats.damageDealt += dealt - before; }
  if (to.def <= 0) {
    from.kills += 1;
    if (has(from, 'bloodlust')) { from.atk += 1; from.def += 1; from.maxDef += 1; }
  }
  if (has(from, 'mirage')) from.def = 0;
  checkAscend(from);
}

/** Attacker and blocker strike at the same time, each with the power it had before the exchange. */
function exchange(s, a, b, atk, dfn) {
  const aHit = power(s, a), bHit = power(s, b), aBefore = a.def, bBefore = b.def;
  const toB = damageUnit(b, aHit), toA = damageUnit(a, bHit);
  for (const [u, dealt, own, opp, before, target, attacking] of [[a, toB, atk, dfn, bBefore, b, true], [b, toA, dfn, atk, aBefore, a, false]]) {
    u.strikes += 1;
    if (u.echo) u.echoRound = s.round + 1;
    if (has(u, 'lifesteal')) own.points = Math.min(START_POINTS, own.points + dealt);
    if (attacking && has(u, 'breakthrough') && dealt > before) { opp.points -= dealt - before; own.stats.damageDealt += dealt - before; }
    if (target.def <= 0) { u.kills += 1; if (has(u, 'bloodlust')) { u.atk += 1; u.def += 1; u.maxDef += 1; } }
    if (has(u, 'mirage')) u.def = Math.min(u.def, 0);
    checkAscend(u);
  }
}

function resolveCombat(s) {
  const atk = s.players[s.attacker], dfn = s.players[other(s.attacker)];
  for (const lane of s.combat.lanes) {
    const a = atk.board.find(u => u.uid === lane.attacker);
    if (!a || a.def <= 0) continue;
    const b = dfn.board.find(u => u.uid === lane.blocker);
    if (!b) {
      const hit = power(s, a);
      dfn.points -= hit;
      atk.stats.damageDealt += hit;
      a.strikes += 1;
      if (a.echo) a.echoRound = s.round + 1;
      if (has(a, 'lifesteal')) atk.points = Math.min(START_POINTS, atk.points + hit);
      if (has(a, 'mirage')) a.def = 0;
      checkAscend(a);
    } else if (has(a, 'twinStrike')) {
      strike(s, a, b, atk, dfn, true);                 // first, before its blocker...
      if (b.def > 0) exchange(s, a, b, atk, dfn);       // ...then again, together with it
    } else if (has(a, 'firstStrike')) {
      strike(s, a, b, atk, dfn, true);
      strike(s, b, a, dfn, atk, false);
    } else {
      exchange(s, a, b, atk, dfn);
    }
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
      s.players[pid].mustPass = false;
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

/**
 * The stake: the winner takes half of the loser's deck. The 20 cards are picked from the loser's
 * decklist with the match seed, so anyone can recompute the same list from the public match record.
 * Returns { from, to, cards } (or null for a draw).
 */
export function settleStake(state) {
  if (state.winner === null || state.winner === 'draw') return null;
  const loser = other(state.winner);
  const rng = createRng((state.seed ^ 0x5eed) >>> 0);
  const cards = rng.shuffle(state.decks[loser]).slice(0, Math.floor(state.decks[loser].length / 2));
  return { from: loser, to: state.winner, cards };
}
