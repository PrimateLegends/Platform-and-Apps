// A small seeded generator (SFC32) with 32-bit integer state only, so the same seed gives the same numbers in
// JavaScript and in the Python referee (services/duel-referee). Never Math.random in the duel.

export function createRng(seed) {
  let s = [0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0];
  const next = () => {
    const [a, b, c, d] = s;
    const t = (((a + b) >>> 0) + d) >>> 0;
    s = [(b ^ (b >>> 9)) >>> 0, (c + (c << 3)) >>> 0, (((c << 21) | (c >>> 11)) + t) >>> 0, (d + 1) >>> 0];
    return t;
  };
  for (let i = 0; i < 12; i++) next();   // stir the seed in
  return {
    u32: next,
    /** integer in [0, n) */
    below: n => next() % n,
    state: () => s.slice(),
  };
}
