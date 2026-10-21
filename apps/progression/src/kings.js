// King of the Hill: the top wallets by card volume of the last 24 hours on the Pre-Market. A sale counts for both
// sides (buyer and seller) at its full $RYO price; listings, cancels and team wallets never count.

export const WINDOW_MS = 24 * 3600 * 1000;
export const TOP = 3;

/**
 * @param {Array<{ buyer: string, seller: string, price: number, at: number, kind: string }>} sales
 * @returns {Array<{ wallet: string, volume: number, trades: number, rank: number }>}
 */
export function kingsOfTheHill(sales, now, { hidden = [], window = WINDOW_MS, top = TOP } = {}) {
  const hide = new Set(hidden.map(w => w.toLowerCase())), since = now - window, by = new Map();
  const add = (w, price) => {
    w = String(w || '').toLowerCase();
    if (!w || hide.has(w)) return;
    const r = by.get(w) || { wallet: w, volume: 0, trades: 0 };
    r.volume += price; r.trades++;
    by.set(w, r);
  };
  for (const s of sales) {
    if (!(s.at > since && s.at <= now) || !['sale', 'offer'].includes(s.kind)) continue;
    add(s.buyer, s.price);
    add(s.seller, s.price);
  }
  return [...by.values()]
    .sort((a, b) => b.volume - a.volume || b.trades - a.trades || (a.wallet < b.wallet ? -1 : 1))
    .slice(0, top)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
