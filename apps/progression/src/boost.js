// Collector Boost: holding an NFT from a partner collection adds a percentage of the player's earned XP, once per
// collection. It never applies by itself: the player asks for a wallet check, so waiting (more XP, more collections
// held) gives a bigger boost. The base is the EARNED XP only (earlier boosts are left out), so claiming collections
// one at a time or all together gives the same total.

export const DEFAULT_PCT = 25;

/**
 * Partner collections. `place`: 'first' / 'second' / 'last' keep their spot on the page, the rest are shuffled on
 * every read. `pct` overrides DEFAULT_PCT. All ERC-721 on Ethereum mainnet.
 */
export const PARTNERS = Object.freeze([
  { key: 'normies', name: 'Normies', contract: '0x9eb6e2025b64f340691e424b7fe7022ffde12438', pct: 50, place: 'first' },
  { key: 'argonauts', name: 'Argonauts', contract: '0x387c41b0b2f1128de44db1bcf8baad085f26392c', place: 'second' },
  { key: 'nakamigos', name: 'Nakamigos', contract: '0xd774557b647330c91bf44cfeab205095f7e6c367' },
  { key: 'good-vibes-club', name: 'Good Vibes Club', contract: '0xb8ea78fcacef50d41375e44e6814ebba36bb33c4' },
  { key: 'invisible-friends', name: 'Invisible Friends', contract: '0x59468516a8259058bad1ca5f8f4bff190d30e066' },
  { key: 'npc', name: 'Non Playable Character', contract: '0xa2a6063b910fc7a7a286196f6c9b62b2797fa0ae' },
  { key: 'mayc', name: 'Mutant Ape Yacht Club', contract: '0x60e4d786628fea6478f785a6d7e704777c86a7c6' },
  { key: 'frontonauts', name: 'Frontonauts', contract: '0x111e33a5bff06add05bec7379aa025497e2b213b', place: 'last' }
]);

/** Display order: fixed places kept, the rest shuffled with `random` (0..1). */
export function displayOrder(collections = PARTNERS, random = Math.random) {
  const at = p => collections.filter(c => c.place === p);
  const rest = collections.filter(c => !['first', 'second', 'last'].includes(c.place));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...at('first'), ...at('second'), ...rest, ...at('last')];
}

/**
 * One wallet check.
 * @param {number} earnedXp  XP without any boost
 * @param {Record<string, number>} balances  collection key -> NFTs held (balanceOf)
 * @param {Set<string>} claimed  collections already boosted for this wallet
 * @returns {{ grants: Array<{ key: string, xp: number }>, waiting: string[] }}
 *   grants: new boosts to record (fixed now); waiting: held but worth 0 XP today (nothing recorded, still available)
 */
export function checkWallet(earnedXp, balances, claimed, collections = PARTNERS) {
  const base = Math.max(0, Math.floor(earnedXp));
  const grants = [], waiting = [];
  for (const c of collections) {
    if (claimed.has(c.key) || !(balances[c.key] > 0)) continue;
    const xp = Math.floor(base * (c.pct ?? DEFAULT_PCT) / 100);
    if (xp > 0) grants.push({ key: c.key, xp }); else waiting.push(c.key);
  }
  return { grants, waiting };
}

/** Next snapshot reminder shown with the boost: every Friday 00:00 UTC, strictly after `now`. */
export function nextFridayUtc(now) {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = (5 - d.getUTCDay() + 7) % 7 || 7;
  return midnight + days * 86_400_000;
}
