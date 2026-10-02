import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaimSupply } from '../src/lib/claim-supply.js';
import { createReferralQuest, normalizeCode } from '../src/lib/referral-quest.js';

test('claim supply: held cards count against the stock and never re-roll', () => {
  const supply = createClaimSupply({ cap: 2 });
  let rolls = 0;
  const roll = () => ({ rarity: 'rare', n: ++rolls });
  const a = supply.hold('alice', roll, 0);
  const again = supply.hold('alice', roll, 10);
  assert.equal(again.card, a.card);
  assert.equal(rolls, 1);
  supply.hold('bob', roll, 0);
  assert.equal(supply.hold('carol', roll, 0).reason, 'sold-out');
  assert.equal(supply.keep('alice', 20).card, a.card);
  assert.deepEqual(supply.status(20), { cap: 2, kept: 1, held: 1, left: 0 });
});

test('claim supply: an unaccepted hold returns to the pool', () => {
  const supply = createClaimSupply({ cap: 1, holdTtl: 100 });
  supply.hold('alice', () => ({}), 0);
  assert.equal(supply.hold('bob', () => ({}), 50).reason, 'sold-out');
  assert.equal(supply.hold('bob', () => ({}), 150).ok, true);
  assert.equal(supply.keep('alice', 150).reason, 'nothing-held');
});

test('referral quest: own use, two friends, Bounty + double chances', () => {
  const q = createReferralQuest();
  const { code } = q.openCode('owner', 'net-a');
  assert.match(code, /^PL-[A-Z0-9]{6}$/);
  assert.equal(normalizeCode(code.replace('-', '').toLowerCase()), code);
  assert.equal(q.apply('owner', code, 'net-a', 0).usesLeft, 2);
  assert.equal(q.apply('friend1', code, 'net-a', 0).reason, 'same-network');
  assert.equal(q.apply('friend1', code, 'net-b', 0).usesLeft, 1);
  assert.equal(q.apply('friend2', code, 'net-b', 0).reason, 'network-limit');
  assert.equal(q.apply('friend2', code, 'net-c', 0).usesLeft, 0);
  assert.equal(q.apply('friend3', code, 'net-d', 0).reason, 'used-up');
  const quest = q.quest('owner');
  assert.equal(quest.earned, 1);
  assert.equal(quest.doubleChances, true);
  assert.equal(q.events.filter(e => e.type === 'quest-bounty').length, 1);
});

test('referral quest: max two rewarded codes', () => {
  const q = createReferralQuest({ applicationsPerNetworkPerDay: 99 });
  for (let round = 0; round < 2; round++) {
    const { code } = q.openCode('owner', 'home');
    for (let i = 0; i < 3; i++) q.apply(`r${round}-${i}`, code, `net-${round}-${i}`, 0);
  }
  assert.equal(q.quest('owner').done, true);
  assert.equal(q.openCode('owner', 'home').reason, 'quest-complete');
});

test('referral quest: approval pays friends once, never the owner', () => {
  const q = createReferralQuest();
  const { code } = q.openCode('owner', 'a');
  q.apply('owner', code, 'a', 0);
  q.apply('friend', code, 'b', 0);
  assert.equal(q.approve('friend').rewarded, true);
  assert.equal(q.approve('friend').rewarded, false);
  assert.equal(q.approve('owner').rewarded, false);
  assert.equal(q.quest('friend').approved, true);
});

test('referral quest: between batches everything pauses and nothing is lost', () => {
  const q = createReferralQuest();
  const { code } = q.openCode('owner', 'net-a');
  assert.equal(q.apply('owner', code, 'net-a', 0).ok, true);

  q.setOpen(false);
  assert.equal(q.quest('owner').paused, true);
  assert.equal(q.openCode('newcomer', 'net-b').reason, 'closed');
  assert.deepEqual(q.check(code, 'friend'), { valid: false, reason: 'closed' });
  assert.equal(q.apply('friend', code, 'net-b', 10).reason, 'closed');
  assert.equal(q.quest('owner').code, code);
  assert.equal(q.quest('owner').uses, 1);

  q.setOpen(true);
  assert.equal(q.quest('owner').paused, false);
  assert.equal(q.apply('friend', code, 'net-b', 20).usesLeft, 1);
});
