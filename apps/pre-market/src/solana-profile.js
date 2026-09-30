// Profiles work like on OpenSea: the ETH address is the account, Solana wallets are linked to it.
// A player can link up to 3 Solana wallets (a different seed on another device, for example); the
// newest one is the default for payouts. Once the 3 slots are used, only those wallets can pay or get
// paid: any other Solana address is refused. Every card bought with any linked wallet lands in the
// same profile, because cards belong to the ETH address.

export const MAX_LINKS = 3;
export const LINK_MAX_AGE_MS = 15 * 60 * 1000;

/** What the Solana wallet signs to prove it belongs to the player linking it. */
export function linkMessage(ethAddress, solanaAddress, issuedAt) {
  return [
    'Primate Legends',
    '',
    'Link this Solana wallet to my Ethereum wallet.',
    '',
    `Ethereum: ${ethAddress}`,
    `Solana: ${solanaAddress}`,
    '',
    'Linked wallets are used to pay and get paid in USDC.',
    'Free signature: no transaction, no gas.',
    `Issued at: ${issuedAt}`
  ].join('\n');
}

/** Adds (or refreshes) a link; the most recent one becomes the default. */
export function addLink(profile, link) {
  const rest = profile.links.filter(l => l.solana !== link.solana);
  if (rest.length >= MAX_LINKS) throw new Error('too-many-links');
  return { ...profile, links: [link, ...rest] };
}

export const defaultPayout = profile => profile.links[0]?.solana ?? null;
export const isLinked = (profile, solana) => profile.links.some(l => l.solana === solana);
export const slotsFull = profile => profile.links.length >= MAX_LINKS;

/** Which Solana wallet may pay for this profile right now: a linked one, or a new one while a slot is free. */
export function canUse(profile, solana) {
  if (isLinked(profile, solana)) return { ok: true, link: false };
  if (!slotsFull(profile)) return { ok: true, link: true };
  return { ok: false, reason: 'not-one-of-linked' };
}

/* ---------- base58 + USDC token account (no dependencies, WebCrypto only) ---------- */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

export function decodeBase58(s) {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new RangeError('Not base58');
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of s) { if (ch !== '1') break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}

export function encodeBase58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}

// Program addresses must NOT be valid ed25519 points; this is the curve check Solana runs.
const P = (1n << 255n) - 19n;
const mod = a => ((a % P) + P) % P;
function pow(b, e) { let r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; } return r; }
const D = mod(-121665n * pow(121666n, P - 2n));

export function isOnCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
  y &= (1n << 255n) - 1n;
  if (y >= P) return false;
  const u = mod(y * y - 1n), v = mod(D * y * y + 1n);
  const x = mod(u * pow(v, 3n) * pow(u * pow(v, 7n), (P - 5n) / 8n));
  const vx2 = mod(v * x * x);
  return vx2 === u || vx2 === mod(-u);
}

async function sha256(parts) {
  const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

/** The associated token account holding `mint` for `owner` (what wallets show as the USDC balance). */
export async function associatedTokenAccount(owner, mint) {
  const seeds = [decodeBase58(owner), decodeBase58(TOKEN_PROGRAM), decodeBase58(mint)];
  const program = decodeBase58(ATA_PROGRAM);
  const tag = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const h = await sha256([...seeds, Uint8Array.of(bump), program, tag]);
    if (!isOnCurve(h)) return encodeBase58(h);
  }
  throw new Error('No program address found');
}
