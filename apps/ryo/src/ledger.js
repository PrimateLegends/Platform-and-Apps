// $RYO off-chain ledger rules (pre-market). Whole units, fixed supply: RYO only moves between accounts,
// so the sum of every balance is always SUPPLY. Balances move on-chain at the token launch.

export const SUPPLY = 1_000_000_000;
export const RYO_PER_ETH = 10_000_000;           // 100,000 $RYO = 0.01 ETH while off-chain
export const GENESIS = {                          // shares of the supply
  vault: 0.60,       // market maker: sells cards at their estimated value, buys at 80%
  team: 0.20,        // rewards the team hands out
  airdrop: 0.10,     // one-time airdrop to early holders
  liquidity: 0.10    // reserved for the launch pool, never spent off-chain
};

export class Ledger {
  constructor() {
    this.balances = new Map();
    for (const [account, share] of Object.entries(GENESIS)) this.balances.set(account, Math.round(SUPPLY * share));
  }
  balanceOf(account) { return this.balances.get(account) || 0; }
  // Throws on bad input or an overdraft; nothing changes in that case.
  transfer(from, to, amount) {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('bad-amount');
    if (from === 'liquidity') throw new Error('locked');
    if (this.balanceOf(from) < amount) throw new Error('insufficient-ryo');
    this.balances.set(from, this.balanceOf(from) - amount);
    this.balances.set(to, this.balanceOf(to) + amount);
  }
  total() { let t = 0; for (const v of this.balances.values()) t += v; return t; }
}

// Airdrop split: half equally between eligible wallets, half pro rata to the cards they hold. Rounding
// leftovers go to the biggest holder so the total is exact.
export function airdropSplit(holders, total = Math.round(SUPPLY * GENESIS.airdrop)) {
  const wallets = Object.keys(holders).sort();
  if (!wallets.length) return {};
  const cards = wallets.reduce((s, w) => s + holders[w], 0);
  const equal = Math.floor(total / 2 / wallets.length);
  const out = {};
  for (const w of wallets) out[w] = equal + (cards ? Math.floor(total / 2 * holders[w] / cards) : 0);
  const top = wallets.slice().sort((a, b) => holders[b] - holders[a] || (a < b ? -1 : 1))[0];
  out[top] += total - Object.values(out).reduce((s, v) => s + v, 0);
  return out;
}
