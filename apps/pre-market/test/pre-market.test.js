import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, splitPayment, formatFee, CURRENCIES } from '../src/money.js';
import { preMarketId, likelyClan, createListing, query, facets, floor } from '../src/listings.js';
import { reserve, release, paymentPlan, settle, RESERVATION_MS } from '../src/checkout.js';
import { linkMessage, addLink, defaultPayout, isLinked, canUse, associatedTokenAccount, decodeBase58, encodeBase58, MAX_LINKS } from '../src/solana-profile.js';

const SELLER = '0x' + 'a'.repeat(40), BUYER = '0x' + 'b'.repeat(40), OTHER = '0x' + 'c'.repeat(40);
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const card = (serial, rarity, type, clans) => ({ serial, rarity, hints: { type, clans } });
const listing = (id, c, code, price, t) => createListing({ id, card: c, seller: SELLER, currency: code, price: parseAmount(price, code), payTo: code === 'eth' ? SELLER : SOL, listedAt: t });

test('amounts are parsed to base units with listing precision', () => {
  assert.equal(parseAmount('0.015', 'eth'), 15_000_000_000_000_000n);
  assert.equal(parseAmount('12.5', 'usdc'), 12_500_000n);
  assert.equal(parseAmount('3,25', 'usdc'), 3_250_000n);
  assert.throws(() => parseAmount('0.0000001', 'eth'), /6 decimals/);
  assert.throws(() => parseAmount('1.234', 'usdc'), /2 decimals/);
  assert.throws(() => parseAmount('0', 'eth'), /above 0/);
  assert.throws(() => parseAmount('abc', 'eth'), /Not a number/);
  assert.equal(formatAmount(15_000_000_000_000_000n, 'eth'), '0.015');
  assert.equal(formatAmount(12_500_000n, 'usdc'), '12.5');
  assert.equal(CURRENCIES.usdc.chain, 'solana');
});

test('the fee comes out of the price and is always shown', () => {
  assert.deepEqual(splitPayment(100_000_000n, 0), { total: 100_000_000n, seller: 100_000_000n, fee: 0n });
  assert.deepEqual(splitPayment(100_000_000n, 690), { total: 100_000_000n, seller: 93_100_000n, fee: 6_900_000n });
  assert.equal(splitPayment(7n, 690).fee, 0n, 'rounds down in favor of the seller');
  assert.throws(() => splitPayment(1n, 5000), /10%/);
  assert.equal(formatFee(690), '6.9%');
  assert.equal(formatFee(0), '0%');
});

test('pre-market IDs and likely clan', () => {
  assert.equal(preMarketId(144), 'PM-00144');
  assert.throws(() => preMarketId(0));
  assert.equal(likelyClan(card(1, 'rare', 'attack', [['void', 56], ['rainbow', 44]])), 'void');
  assert.equal(likelyClan(card(1, 'rare', 'attack', [])), null);
});

test('listings validate where the money goes', () => {
  assert.throws(() => createListing({ id: 1, card: card(1, 'rare', 'attack', []), seller: SELLER, currency: 'usdc', price: 1n, payTo: SELLER }), /Solana payout/);
  assert.throws(() => createListing({ id: 1, card: card(1, 'rare', 'attack', []), seller: SELLER, currency: 'eth', price: 1n, payTo: OTHER }), /seller address/);
  assert.throws(() => createListing({ id: 1, card: card(1, 'rare', 'attack', []), seller: SELLER, currency: 'eth', price: 0n, payTo: SELLER }), /positive/);
});

const book = [
  listing(1, card(144, 'uncommon', 'attack', [['void', 56], ['rainbow', 44]]), 'usdc', '19.19', 5),
  listing(2, card(115, 'legendary', 'attack', [['golden', 100]]), 'usdc', '247.25', 4),
  listing(3, card(82, 'rare', 'defense', [['void', 60], ['onyx', 40]]), 'eth', '0.0255', 3),
  listing(4, card(159, 'uncommon', 'evasion', [['sakura', 70], ['void', 30]]), 'eth', '0.0072', 2),
  listing(5, card(297, 'common', 'evasion', [['earth', 80], ['ember', 20]]), 'eth', '0.0117', 1)
];

test('filters, sorting and search', () => {
  assert.deepEqual(query(book).map(l => l.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(query(book, { currency: 'eth' }, 'priceLow').map(l => l.id), [4, 5, 3]);
  assert.deepEqual(query(book, {}, 'priceHigh').map(l => l.id), [3, 5, 4, 2, 1], 'ETH before USDC, no oracle');
  assert.deepEqual(query(book, { currency: 'eth', min: parseAmount('0.01', 'eth') }).map(l => l.id), [3, 5]);
  assert.deepEqual(query(book, { min: 999n }).map(l => l.id), [1, 2, 3, 4, 5], 'price bounds need a currency');
  assert.deepEqual(query(book, { clans: ['void'] }).map(l => l.id), [1, 3]);
  assert.deepEqual(query(book, { types: ['evasion'], rarities: ['common'] }).map(l => l.id), [5]);
  assert.deepEqual(query(book, { search: '0082' }).map(l => l.id), [3]);
  assert.deepEqual(query(book, {}, 'rarity').map(l => l.card.rarity), ['legendary', 'rare', 'uncommon', 'uncommon', 'common']);
});

test('sidebar counts ignore their own group', () => {
  const f = facets(book, { rarities: ['uncommon'] });
  assert.equal(f.rarity.legendary, 1, 'other rarities still counted');
  assert.equal(f.type.attack, 1);
  assert.equal(f.clan.void, 1);
  assert.equal(floor(book, 'eth'), parseAmount('0.0072', 'eth'));
  assert.equal(floor(book, 'usdc'), parseAmount('19.19', 'usdc'));
  assert.equal(floor([], 'eth'), null);
});

test('reservations lock a card for one buyer, then expire', () => {
  const l = book[2];
  assert.throws(() => reserve(l, SELLER, 0), /own-listing/);
  const r = reserve(l, BUYER, 1_000);
  assert.equal(r.status, 'reserved');
  assert.throws(() => reserve(r, OTHER, 2_000), /reserved/);
  assert.equal(release(r, 1_000 + RESERVATION_MS - 1).status, 'reserved');
  const back = release(r, 1_000 + RESERVATION_MS);
  assert.equal(back.status, 'active');
  assert.equal(reserve(back, OTHER, 1_000 + RESERVATION_MS).buyer, OTHER);
});

test('settlement checks the chain transfers against the plan', () => {
  const l = reserve(book[0], BUYER, 0);
  const vault = { eth: '0x' + 'f'.repeat(40), usdc: 'Vote111111111111111111111111111111111111111' };
  const free = paymentPlan(l, 0, vault);
  assert.equal(free.length, 1, 'no fee, one transfer');
  const plan = paymentPlan(l, 690, vault);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].amount + plan[1].amount, l.price);

  const used = new Set();
  const pay = amount => [{ from: 'buyer-sol', to: SOL, amount, currency: 'usdc' }];
  assert.equal(settle(l, { buyer: BUYER, transfers: pay(l.price - 1n), usedTx: used, tx: 't1' }, free, 10).reason, 'underpaid');
  const ok = settle(l, { buyer: BUYER, transfers: pay(l.price), usedTx: used, tx: 't2' }, free, 10);
  assert.ok(ok.ok);
  assert.equal(ok.listing.status, 'sold');
  used.add('t2');
  assert.equal(settle(l, { buyer: BUYER, transfers: pay(l.price), usedTx: used, tx: 't2' }, free, 10).reason, 'tx-already-used');
  const late = settle(ok.listing, { buyer: OTHER, transfers: pay(l.price), usedTx: used, tx: 't3' }, free, 20);
  assert.deepEqual([late.reason, late.refund], ['sold-to-someone-else', true]);
});

test('profiles link several Solana wallets; newest is the payout default', () => {
  let p = { eth: BUYER, links: [] };
  p = addLink(p, { solana: SOL, wallet: 'Phantom' });
  p = addLink(p, { solana: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', wallet: 'Solflare' });
  assert.equal(defaultPayout(p), '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  p = addLink(p, { solana: SOL, wallet: 'Phantom' });
  assert.equal(p.links.length, 2, 'linking again refreshes, no duplicate');
  assert.equal(defaultPayout(p), SOL);
  assert.ok(isLinked(p, SOL) && !isLinked(p, 'x'));
  assert.equal(MAX_LINKS, 3);
  assert.deepEqual(canUse(p, 'new'), { ok: true, link: true }, 'a free slot: a new wallet gets linked');
  const full = { eth: BUYER, links: Array.from({ length: MAX_LINKS }, (_, i) => ({ solana: 'w' + i })) };
  assert.throws(() => addLink(full, { solana: 'new' }), /too-many-links/);
  assert.deepEqual(canUse(full, 'new'), { ok: false, reason: 'not-one-of-linked' }, 'all 3 used: new addresses are refused');
  assert.deepEqual(canUse(full, 'w1'), { ok: true, link: false }, 'the linked ones keep working');
  assert.match(linkMessage(BUYER, SOL, '2026-09-29T00:00:00.000Z'), /Ethereum: 0xb{40}\nSolana: 7xKX/);
});

test('base58 round trip and USDC token accounts match the official Solana library', async () => {
  const bytes = decodeBase58(SOL);
  assert.equal(bytes.length, 32);
  assert.equal(encodeBase58(bytes), SOL);
  const vectors = {
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B',
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': 'C4PRXFV6Gf5mytVZb6RoeLsG8CjcFWzR2EJ3dvwPTUJH',
    'Vote111111111111111111111111111111111111111': 'BtdVcnjAZ3eMPJnFJmhyav1BzsTr4rSwCiGJxVUkhT21'
  };
  for (const [owner, ata] of Object.entries(vectors)) {
    assert.equal(await associatedTokenAccount(owner, CURRENCIES.usdc.mint), ata);
  }
});
