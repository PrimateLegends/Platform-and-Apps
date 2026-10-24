// The Katana Master referee: a deterministic duel that replays an input log to its result.
//
// Why it exists: whatever runs in a browser can be edited. For results that matter (ranked and staked duels) the
// clients only send their inputs; the referee replays both logs, tick by tick, and its result is the one that
// counts. A tampered client can draw what it likes on its own screen, but it cannot change the replayed outcome.
//
// The referee keeps to integer arithmetic and a fixed 10 ms tick, so the Python port (services/duel-referee)
// reaches the same state and the same hash for the same log. Positions are in thousandths of an art pixel.
//
// Input log: [[tick, mask0, mask1], ...] sorted by tick. A mask holds until the next entry for that tick or later;
// the edge bits (attack, dash, teleport, card) only act on the tick where they appear.
import { RULES } from './rules.js';
import { cutDamage, nextCombo, gainKi, spendKi, kiFromDamage, teleport, isPerfectBlock } from './combat.js';
import { CardLedger } from './cards.js';

export const KEY = Object.freeze({ LEFT: 1, RIGHT: 2, BLOCK: 4, ATTACK: 8, DASH: 16, TELEPORT: 32 });
export const CARD_SHIFT = 6;   // bits 6-8: card slot 1..5 (0 = none)
const EDGE_MASK = KEY.ATTACK | KEY.DASH | KEY.TELEPORT | (7 << CARD_SHIFT);
const MILLI = 1000, BODY_GAP = 34 * MILLI;
const ST = Object.freeze({ idle: 0, walk: 1, attack: 2, block: 3, hit: 4, dash: 5, ko: 7 });
const T = RULES.tickMs;

const ticks = ms => Math.max(1, Math.floor((ms + T / 2) / T));   // round half up, the same in every language
const DASH = { n: ticks(RULES.dash.ms), step: Math.floor(RULES.dash.px * MILLI / ticks(RULES.dash.ms)) };
const FLIP = { n: ticks(RULES.backflip.ms), step: Math.floor(RULES.backflip.px * MILLI / ticks(RULES.backflip.ms)) };
const WALK_STEP = Math.floor(RULES.walkPxPerS * MILLI * T / 1000);
const ATK = RULES.attack;

function fighter(x) {
  return { x, face: 1, hp: RULES.hp, w: { ki: 0, bank: 0 }, kiCarry: 0, blocks: 0, combo: 0, lastHitAt: -1e9,
    st: ST.idle, stT: 0, stun: 0, dashDir: 0, dashLeft: 0, dashStep: 0, atkHit: false, lastAtkAt: -1e9,
    guardAt: -1e9, tele: { count: 0, lastAt: -1e9, restUntil: 0 }, undyingUntil: 0 };
}

/** FNV-1a over 32-bit words. */
function fnv(words) {
  let h = 0x811c9dc5;
  for (const w of words) for (let s = 0; s < 32; s += 8) { h ^= (w >>> s) & 0xff; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/**
 * Replay a duel.
 * @param {{ log: number[][], cards?: [string[], string[]], catalog?: Map<string, { ki: number, atk: number, df: number }>, maxTicks?: number }} input
 *   cards: each player's loadout (card ids); catalog: card id -> Ki cost (whole Ki), damage and heal (whole HP)
 * @returns {{ winner: 0 | 1 | null, wins: [number, number], rounds: { winner: 0 | 1 | null, how: 'ko' | 'time', ms: number }[], hash: string, ticks: number }}
 */
export function replay({ log, cards = [[], []], catalog = new Map(), maxTicks = RULES.round.limitMs / T * RULES.round.max + 10 }) {
  const ledgers = [new CardLedger(cards[0]), new CardLedger(cards[1])];
  const mid = Math.floor((RULES.arena.minPx + RULES.arena.maxPx) / 2) * MILLI, gap = RULES.arena.startGapPx * MILLI / 2;
  const kiKeep = [{ ki: 0, bank: 0 }, { ki: 0, bank: 0 }];
  let F, roundT = 0, round = 1, held = [0, 0], li = 0, tick = 0;
  const wins = [0, 0], rounds = [], trail = [];
  const startRound = () => {
    F = [fighter(mid - gap), fighter(mid + gap)];
    F[0].w = { ...kiKeep[0] }; F[1].w = { ...kiKeep[1] };   // Ki and played cards carry across rounds; HP refills
    roundT = 0;
  };
  startRound();
  const cost = id => { const c = catalog.get(id); return { ki: (c ? c.ki : 99) * 10 }; };

  const hurt = (D, i, dmg, t) => {
    let hp = D.hp - dmg;
    if (t < D.undyingUntil) hp = Math.max(100, hp);
    if (hp < RULES.cards.lastBreathBelow && ledgers[i].autoCast(hp) >= 0) { hp = Math.max(100, hp); D.undyingUntil = t + RULES.cards.lastBreathGraceMs; }
    D.hp = Math.max(0, hp);
    const k = kiFromDamage(D.kiCarry, dmg); D.kiCarry = k.carry;
    for (let g = 0; g < k.gains; g++) D.w = gainKi(D.w);
  };

  while (tick < maxTicks) {
    // inputs of this tick
    let edges = [0, 0];
    while (li < log.length && log[li][0] <= tick) {
      const [, m0, m1] = log[li++];
      edges = [edges[0] | (m0 & EDGE_MASK), edges[1] | (m1 & EDGE_MASK)];
      held = [m0 & ~EDGE_MASK, m1 & ~EDGE_MASK];
    }
    const t = roundT;
    for (let i = 0; i < 2; i++) {
      const f = F[i], o = F[1 - i], inp = held[i] | edges[i];
      f.face = o.x >= f.x ? 1 : -1;
      f.stT += T;
      if (f.st === ST.ko) continue;
      if (f.st === ST.hit) { if (f.stT >= f.stun) { f.st = ST.idle; f.stT = 0; } else continue; }
      if (f.st === ST.dash) {
        f.x += f.dashDir * f.dashStep;
        if (--f.dashLeft <= 0) { f.st = ST.idle; f.stT = 0; }
        continue;
      }
      if (f.st === ST.attack) {
        if (!f.atkHit && f.stT >= ATK.windupMs && f.stT < ATK.windupMs + ATK.activeMs) {
          if (Math.abs(o.x - f.x) <= ATK.reachPx * MILLI && o.st !== ST.ko) {
            f.atkHit = true;
            if (o.st === ST.block && o.face === -f.face) {
              o.blocks++; o.st = ST.hit; o.stT = 0; o.stun = RULES.blockStunMs;   // blockstun
              if (o.blocks % RULES.ki.perBlocks === 0) o.w = gainKi(o.w);
              if (isPerfectBlock(o.guardAt, t)) o.w = gainKi(o.w);
            } else {
              f.combo = nextCombo(f.combo, f.lastHitAt, t); f.lastHitAt = t;
              if (f.combo === RULES.ki.comboAt) f.w = gainKi(f.w);
              hurt(o, 1 - i, cutDamage(f.combo - 1), t);
              o.combo = 0; o.st = o.hp > 0 ? ST.hit : ST.ko; o.stT = 0; o.stun = 300;
            }
          }
        }
        if (f.stT >= ATK.windupMs + ATK.activeMs + ATK.recoverMs) { f.st = ST.idle; f.stT = 0; }
        continue;
      }
      // free to act: card, teleport, dash, attack, guard, walk (in that order of priority)
      const slot = (inp >> CARD_SHIFT) & 7;
      if (slot) {
        const r = ledgers[i].cast(slot - 1, { state: 'idle', ki: f.w.ki }, cost);
        if (r.ok) {
          const c = catalog.get(ledgers[i].cards[slot - 1]);
          f.w = { ki: r.ki, bank: f.w.bank };
          if (c.atk) hurt(o, 1 - i, c.atk * 100, t);
          if (c.df) f.hp = Math.min(RULES.hp, f.hp + c.df * 100);
          if (o.hp <= 0) { o.st = ST.ko; }
          continue;
        }
      }
      if (inp & KEY.TELEPORT) {
        const r = teleport(f.tele, f.w.ki, t);
        if (r.ok) { f.w = spendKi(f.w, RULES.teleport.ki); f.tele = r.next; f.x = o.x - f.face * BODY_GAP; f.st = ST.idle; f.stT = 0; continue; }
      }
      const dir = (inp & KEY.RIGHT ? 1 : 0) - (inp & KEY.LEFT ? 1 : 0);
      if ((inp & KEY.DASH) && dir) {
        const back = dir !== f.face, D = back ? FLIP : DASH;
        f.st = ST.dash; f.stT = 0; f.dashDir = dir; f.dashLeft = D.n; f.dashStep = D.step;
        continue;
      }
      if ((inp & KEY.ATTACK) && t - f.lastAtkAt >= ATK.minGapMs) { f.st = ST.attack; f.stT = 0; f.atkHit = false; f.lastAtkAt = t; continue; }
      if (inp & KEY.BLOCK) { if (f.st !== ST.block) { f.st = ST.block; f.stT = 0; f.guardAt = t; } continue; }
      if (dir) { f.st = ST.walk; f.x += dir * WALK_STEP; } else if (f.st !== ST.idle) { f.st = ST.idle; f.stT = 0; }
    }
    // walls and bodies: nobody leaves the arena, nobody walks through the rival
    for (const f of F) f.x = Math.max(RULES.arena.minPx * MILLI, Math.min(RULES.arena.maxPx * MILLI, f.x));
    if (Math.abs(F[1].x - F[0].x) < BODY_GAP / 2) {
      const c = Math.floor((F[0].x + F[1].x) / 2), s = F[0].x <= F[1].x ? 1 : -1;
      F[0].x = c - s * BODY_GAP / 4; F[1].x = c + s * BODY_GAP / 4;
    }
    tick++; roundT += T;
    // the round ends on a K.O. or at the time limit (more HP wins; equal HP is a draw)
    const ko = F[0].hp <= 0 || F[1].hp <= 0, out = roundT >= RULES.round.limitMs;
    if (ko || out) {
      const winner = ko ? (F[0].hp <= 0 ? (F[1].hp <= 0 ? null : 1) : 0) : F[0].hp === F[1].hp ? null : F[0].hp > F[1].hp ? 0 : 1;
      if (winner !== null) wins[winner]++;
      rounds.push({ winner, how: ko ? 'ko' : 'time', ms: roundT });
      for (const f of F) trail.push(round, roundT, f.x, f.hp, f.w.ki, f.combo, f.blocks);
      kiKeep[0] = { ...F[0].w }; kiKeep[1] = { ...F[1].w };
      if (wins[0] >= RULES.round.toWin || wins[1] >= RULES.round.toWin || round >= RULES.round.max) break;
      round++; startRound();
    }
  }
  const winner = wins[0] > wins[1] ? 0 : wins[1] > wins[0] ? 1 : null;
  trail.push(tick, wins[0], wins[1], ...ledgers[0].usedSlots, 255, ...ledgers[1].usedSlots);
  return { winner, wins, rounds, hash: fnv(trail).toString(16).padStart(8, '0'), ticks: tick };
}

/** Build a log from per-player key timelines: [{ at: ms, mask }] (held until the next one). */
export function logFromTimelines(a, b) {
  const at = new Map();
  const put = (list, side) => {
    let last = 0;
    for (const e of list) {
      const k = Math.floor(e.at / T);
      const row = at.get(k) || [k, null, null];
      row[side + 1] = e.mask; at.set(k, row); last = e.mask;
    }
    return last;
  };
  put(a, 0); put(b, 1);
  const rows = [...at.values()].sort((x, y) => x[0] - y[0]);
  const cur = [0, 0];
  return rows.map(([k, m0, m1]) => {
    // a side that didn't change keeps its held keys (edges are not repeated)
    const r = [k, m0 ?? (cur[0] & ~EDGE_MASK), m1 ?? (cur[1] & ~EDGE_MASK)];
    cur[0] = r[1]; cur[1] = r[2];
    return r;
  });
}
