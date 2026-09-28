/**
 * Match scoring and seasonal Honor.
 *
 * Match score (shown on the result screen):
 *   win 100 · draw 40 · loss 10
 *   + 2 per point of Shrine damage dealt
 *   + 5 per enemy warrior defeated
 *   + 25 "flawless" bonus when the winner's Shrine is still at 20
 *
 * Honor (the ranked, on-chain points): an Elo-style rating that moves with every ranked match.
 * At the end of each season the server writes one Merkle root with every player's Honor to the
 * HonorLedger contract; players can then prove their own total on-chain.
 */
import { SHRINE_HEALTH } from './engine.js';

export function matchScore(state, player) {
  const me = state.players[player];
  const result = state.winner === player ? 'win' : state.winner === 'draw' ? 'draw' : 'loss';
  let score = { win: 100, draw: 40, loss: 10 }[result];
  score += me.stats.damageDealt * 2;
  score += me.stats.unitsDefeated * 5;
  if (result === 'win' && me.shrine === SHRINE_HEALTH) score += 25;
  return { result, score };
}

export const HONOR_START = 1000;
const K = 32;

/** New Honor ratings after a ranked match. `outcome` is 1 (a wins), 0.5 (draw) or 0 (b wins). */
export function updateHonor(a, b, outcome) {
  const expectedA = 1 / (1 + 10 ** ((b - a) / 400));
  const delta = Math.round(K * (outcome - expectedA));
  return [a + delta, b - delta];
}
