// Amounts on the Pre-Market are kept as integer base units (BigInt) end to end:
// wei for ETH, micro-USDC for USDC on Solana. Floats never touch a price.

export const CURRENCIES = Object.freeze({
  eth: Object.freeze({ symbol: 'ETH', chain: 'ethereum', decimals: 18, listingDecimals: 6 }),
  usdc: Object.freeze({
    symbol: 'USDC', chain: 'solana', decimals: 6, listingDecimals: 2,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  })
});

export const BPS = 10_000n;

export function currency(code) {
  const c = CURRENCIES[code];
  if (!c) throw new RangeError(`Unknown currency: ${code}`);
  return c;
}

/**
 * Parses a price typed by a seller ("0.015", "12.5") into base units.
 * Sellers get a friendlier precision than the chain allows: 6 decimals for ETH, 2 for USDC.
 */
export function parseAmount(text, code) {
  const c = currency(code);
  const s = String(text).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) throw new RangeError('Not a number');
  const [whole, frac = ''] = s.split('.');
  if (frac.length > c.listingDecimals) throw new RangeError(`${c.symbol} prices take up to ${c.listingDecimals} decimals`);
  const units = BigInt(whole) * 10n ** BigInt(c.decimals) + BigInt(frac.padEnd(c.decimals, '0') || '0');
  if (units <= 0n) throw new RangeError('Price must be above 0');
  return units;
}

/** Base units back to a short decimal string, without trailing zeros. */
export function formatAmount(units, code, maxDecimals = currency(code).listingDecimals) {
  const c = currency(code);
  const base = 10n ** BigInt(c.decimals);
  const whole = units / base;
  let frac = (units % base).toString().padStart(c.decimals, '0').slice(0, maxDecimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Splits a buyer's payment. The fee is taken out of the listed price (the buyer pays exactly the
 * price, like OpenSea) and rounded down, so the seller never gets less than price - fee.
 */
export function splitPayment(price, feeBps) {
  const bps = BigInt(feeBps);
  if (bps < 0n || bps > 1_000n) throw new RangeError('Fee must be between 0% and 10%');
  const fee = (price * bps) / BPS;
  return { total: price, seller: price - fee, fee };
}

/** "6.9%" from 690 basis points. */
export function formatFee(feeBps) {
  return `${(Number(feeBps) / 100).toString()}%`;
}
