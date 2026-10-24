// Input guard: the client-side half of the anti-script layer.
//
// The browser only counts trusted key and pointer events (a page script's dispatchEvent is not trusted). On top of
// that this watcher looks at press timestamps alone:
//  - turbo: the same key pressed again within 30 ms is dropped (a fast human repeat is ~80 ms);
//  - rate: more than 25 presses inside one second across all keys is flagged;
//  - rhythm: 24 presses in a row whose gaps spread less than 3 ms is flagged (macros keep time; hands wobble).
// Flags never stop the game. They travel with the result, and the referee decides (see duel.js for the replay).

export const GUARD = Object.freeze({ turboMs: 30, rateMax: 25, rhythmRun: 24, rhythmSpreadMs: 3, keep: 48 });

export class InputGuard {
  #lastDown = new Map();
  #presses = [];
  #flags = new Set();

  /** A key went down at `t` (ms). Returns false when the press must be dropped. */
  press(key, t, trusted = true) {
    if (!trusted) { this.#flags.add('synthetic'); return false; }
    if (t - (this.#lastDown.get(key) ?? -Infinity) < GUARD.turboMs) { this.#flags.add('turbo'); return false; }
    this.#lastDown.set(key, t);
    const p = this.#presses; p.push(t); if (p.length > GUARD.keep) p.shift();
    const n = p.length;
    if (n > GUARD.rateMax && t - p[n - GUARD.rateMax - 1] < 1000) this.#flags.add('rate');
    if (n > GUARD.rhythmRun) {
      const gaps = [];
      for (let i = n - GUARD.rhythmRun; i < n; i++) gaps.push(p[i] - p[i - 1]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
      if (sd < GUARD.rhythmSpreadMs) this.#flags.add('rhythm');
    }
    return true;
  }

  get flags() { return [...this.#flags].sort(); }
  reset() { this.#lastDown.clear(); this.#presses.length = 0; this.#flags.clear(); }
}
