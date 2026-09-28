/**
 * Randomness helpers for the preview. In production every roll happens on the server;
 * here we roll in the browser so the demo works offline.
 */

/** Uniform float in [0, 1) from the platform CSPRNG. */
export function random() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Picks a key from a { key: weight } table. */
export function weighted(table) {
  const entries = Object.entries(table);
  let n = random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, w] of entries) {
    n -= w;
    if (n <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Picks `count` distinct keys from a weight table (without replacement). */
export function weightedDistinct(table, count) {
  const pool = { ...table };
  const out = [];
  while (out.length < count && Object.keys(pool).length) {
    const key = weighted(pool);
    out.push(key);
    delete pool[key];
  }
  return out;
}

/** Integer in [min, max]. */
export function between(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
