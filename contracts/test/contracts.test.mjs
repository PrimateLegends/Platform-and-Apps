// Runs the Solidity drafts in an in-process EVM (@ethereumjs/vm) and checks their behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VM } from '@ethereumjs/vm';
import { Block } from '@ethereumjs/block';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { Address, Account, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { Interface, AbiCoder, solidityPackedKeccak256, keccak256, getBytes, concat, id as eventId } from 'ethers';
import { compileAll } from '../../scripts/compile-contracts.mjs';

const { out, errors } = compileAll();
assert.equal(errors.length, 0, 'contracts compile');
const artifact = (file, name) => out.contracts[file][name];

const ETH = 10n ** 18n;
const addr = n => new Address(hexToBytes('0x' + n.toString(16).padStart(40, '0')));

async function chain() {
  const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun });
  const vm = await VM.create({ common });
  const fund = async a => vm.stateManager.putAccount(a, Account.fromAccountData({ balance: 1000n * ETH }));
  const balance = async a => (await vm.stateManager.getAccount(a))?.balance ?? 0n;
  async function deploy(file, name, args = [], from) {
    const a = artifact(file, name);
    const iface = new Interface(a.abi);
    const data = concat(['0x' + a.evm.bytecode.object, iface.encodeDeploy(args)]);
    const r = await vm.evm.runCall({ caller: from, data: getBytes(data), gasLimit: 30_000_000n });
    if (r.execResult.exceptionError) throw new Error('deploy failed: ' + r.execResult.exceptionError.error);
    const at = r.createdAddress;
    // `time` (unix seconds) runs the call in a block with that timestamp.
    const call = async (fn, fnArgs = [], { from: caller = from, value = 0n, time } = {}) => {
      const block = time === undefined ? undefined : Block.fromBlockData({ header: { timestamp: BigInt(time), gasLimit: 30_000_000n } }, { common });
      const res = await vm.evm.runCall({ caller, to: at, data: getBytes(iface.encodeFunctionData(fn, fnArgs)), value, gasLimit: 30_000_000n, block });
      const ret = bytesToHex(res.execResult.returnValue);
      if (res.execResult.exceptionError) {
        const err = ret !== '0x' ? iface.parseError(ret) : null;
        const e = new Error(err ? err.name : res.execResult.exceptionError.error);
        e.revert = err ? err.name : 'revert';
        throw e;
      }
      const logs = (res.execResult.logs || []).map(([, topics, data]) => { try { return iface.parseLog({ topics: topics.map(bytesToHex), data: bytesToHex(data) }); } catch { return null; } }).filter(Boolean);
      const decoded = iface.getFunction(fn).outputs.length ? iface.decodeFunctionResult(fn, ret) : [];
      return { value: decoded.length === 1 ? decoded[0] : decoded, logs };
    };
    return { at, call };
  }
  return { vm, fund, balance, deploy };
}

/* ---------- Merkle helpers (sorted pairs, same as the contracts) ---------- */
const hashPair = (a, b) => (BigInt(a) < BigInt(b) ? keccak256(concat([a, b])) : keccak256(concat([b, a])));
function tree(leaves) {
  const levels = [leaves];
  while (levels.at(-1).length > 1) {
    const cur = levels.at(-1), next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? hashPair(cur[i], cur[i + 1]) : cur[i]);
    levels.push(next);
  }
  const proof = idx => {
    const p = [];
    for (let l = 0; l < levels.length - 1; l++) {
      const sib = idx ^ 1;
      if (sib < levels[l].length) p.push(levels[l][sib]);
      idx >>= 1;
    }
    return p;
  };
  return { root: levels.at(-1)[0], proof };
}

test('LegendaryCards: 1:1 migration from the Pre-Market snapshot', async () => {
  const { fund, deploy } = await chain();
  const admin = addr(0xa11ce), alice = addr(0xa1), bob = addr(0xb0b), stranger = addr(0x5);
  for (const a of [admin, alice, bob, stranger]) await fund(a);
  const cards = await deploy('LegendaryCards.sol', 'LegendaryCards', [admin.toString(), 'ipfs://cards/{id}.json'], admin);

  // snapshot: (serial, owner, rarity)
  const snap = [[144, alice, 1], [115, alice, 3], [82, bob, 2], [297, bob, 0]];
  const leaves = snap.map(([s, o, r]) => solidityPackedKeccak256(['uint256', 'address', 'uint8'], [s, o.toString(), r]));
  const { root, proof } = tree(leaves);

  await assert.rejects(cards.call('migrate', [[144], [alice.toString()], [1], [proof(0)]]), { revert: 'NoSnapshot' });
  await assert.rejects(cards.call('commitSnapshot', [root, 'ipfs://snapshot'], { from: stranger }), { revert: 'NotAdmin' });
  await cards.call('commitSnapshot', [root, 'ipfs://snapshot']);

  // anyone can push the airdrop, cards go to the snapshot owners
  const r = await cards.call('migrate', [[144, 82], [alice.toString(), bob.toString()], [1, 2], [proof(0), proof(2)]], { from: stranger });
  assert.equal(r.logs.filter(l => l.name === 'CardMigrated').length, 2);
  assert.equal((await cards.call('balanceOf', [alice.toString(), 144])).value, 1n);
  assert.equal((await cards.call('balanceOf', [bob.toString(), 82])).value, 1n);
  assert.equal((await cards.call('rarityOf', [82])).value, 2n);
  assert.equal((await cards.call('totalMinted')).value, 2n);

  await assert.rejects(cards.call('migrate', [[144], [alice.toString()], [1], [proof(0)]]), { revert: 'AlreadyMinted' });
  await assert.rejects(cards.call('migrate', [[115], [bob.toString()], [3], [proof(1)]]), { revert: 'InvalidProof' }, 'cannot redirect a card to someone else');
  await assert.rejects(cards.call('migrate', [[115], [alice.toString()], [4], [proof(1)]]), { revert: 'InvalidProof' }, 'cannot upgrade the rarity');
  await assert.rejects(cards.call('migrate', [[0], [alice.toString()], [0], [[]]]), { revert: 'BadSerial' });

  // freezing locks the snapshot forever
  await cards.call('freeze');
  await assert.rejects(cards.call('commitSnapshot', [root, 'x']), { revert: 'IsFrozen' });
  await assert.rejects(cards.call('setBaseUri', ['x']), { revert: 'IsFrozen' });
  await cards.call('migrate', [[115, 297], [alice.toString(), bob.toString()], [3, 0], [proof(1), proof(3)]]);
  assert.equal((await cards.call('totalMinted')).value, 4n);
});

test('LegendaryCards: ERC-1155 transfers and approvals', async () => {
  const { fund, deploy } = await chain();
  const admin = addr(0xa11ce), alice = addr(0xa1), bob = addr(0xb0b), market = addr(0x3a);
  for (const a of [admin, alice, bob, market]) await fund(a);
  const cards = await deploy('LegendaryCards.sol', 'LegendaryCards', [admin.toString(), 'ipfs://cards/{id}.json'], admin);
  const leaf = solidityPackedKeccak256(['uint256', 'address', 'uint8'], [7, alice.toString(), 4]);
  await cards.call('commitSnapshot', [leaf, 'ipfs://s']);
  await cards.call('migrate', [[7], [alice.toString()], [4], [[]]]);

  assert.equal((await cards.call('supportsInterface', ['0xd9b67a26'])).value, true);
  assert.equal((await cards.call('supportsInterface', ['0x80ac58cd'])).value, false);
  await assert.rejects(cards.call('safeTransferFrom', [alice.toString(), bob.toString(), 7, 1, '0x'], { from: market }), { revert: 'NotOwnerOrApproved' });
  await cards.call('setApprovalForAll', [market.toString(), true], { from: alice });
  await cards.call('safeTransferFrom', [alice.toString(), bob.toString(), 7, 1, '0x'], { from: market });
  const bal = (await cards.call('balanceOfBatch', [[alice.toString(), bob.toString()], [7, 7]])).value;
  assert.deepEqual([...bal], [0n, 1n]);
  await assert.rejects(cards.call('safeTransferFrom', [alice.toString(), bob.toString(), 7, 1, '0x'], { from: alice }), { revert: 'InsufficientBalance' });
});

test('PreMarketSettlement: one transaction pays the seller and the fee', async () => {
  const { fund, balance, deploy } = await chain();
  const deployer = addr(0xde), buyer = addr(0xb1), seller = addr(0x5e11), vault = addr(0x7a017);
  for (const a of [deployer, buyer]) await fund(a);
  const listing = eventId('listing-144');

  await assert.rejects(deploy('PreMarketSettlement.sol', 'PreMarketSettlement', [1001, vault.toString()], deployer), /deploy failed/);
  const free = await deploy('PreMarketSettlement.sol', 'PreMarketSettlement', [0, '0x0000000000000000000000000000000000000000'], deployer);
  await free.call('buy', [listing, seller.toString()], { from: buyer, value: ETH / 10n });
  assert.equal(await balance(seller), ETH / 10n, '0% fee: the seller gets everything');

  const paid = await deploy('PreMarketSettlement.sol', 'PreMarketSettlement', [690, vault.toString()], deployer);
  const r = await paid.call('buy', [listing, seller.toString()], { from: buyer, value: ETH });
  assert.equal(await balance(vault), 69n * ETH / 1000n, '6.9% to the vault');
  assert.equal(await balance(seller), ETH / 10n + 931n * ETH / 1000n, '93.1% to the seller');
  assert.equal(await balance(paid.at), 0n, 'the contract keeps nothing');
  const ev = r.logs.find(l => l.name === 'Settled');
  assert.equal(ev.args.fee, 69n * ETH / 1000n);
  assert.equal(ev.args.listingId, listing);

  await assert.rejects(paid.call('buy', [listing, seller.toString()], { from: buyer, value: ETH }), { revert: 'AlreadySettled' });
  await assert.rejects(paid.call('buy', [eventId('other'), seller.toString()], { from: buyer }), { revert: 'NothingPaid' });
  assert.equal((await paid.call('feeFor', [1000n])).value, 69n);
});

test('RyoToken: fixed supply, plain ERC-20', async () => {
  const { fund, deploy } = await chain();
  const dist = addr(0xd157), alice = addr(0xa1), spender = addr(0x5e);
  for (const a of [dist, alice, spender]) await fund(a);
  const ryo = await deploy('RyoToken.sol', 'RyoToken', [dist.toString()], dist);
  const SUPPLY = 1_000_000_000n * ETH;
  assert.equal((await ryo.call('totalSupply')).value, SUPPLY);
  assert.equal((await ryo.call('balanceOf', [dist.toString()])).value, SUPPLY);
  await ryo.call('transfer', [alice.toString(), 5n * ETH]);
  await assert.rejects(ryo.call('transfer', [dist.toString(), 6n * ETH], { from: alice }), { revert: 'InsufficientBalance' });
  await ryo.call('approve', [spender.toString(), 2n * ETH], { from: alice });
  await ryo.call('transferFrom', [alice.toString(), spender.toString(), 2n * ETH], { from: spender });
  await assert.rejects(ryo.call('transferFrom', [alice.toString(), spender.toString(), 1n], { from: spender }), { revert: 'InsufficientAllowance' });
  assert.equal((await ryo.call('balanceOf', [alice.toString()])).value, 3n * ETH);
});

test('OfferBook: $RYO offers on Legendary Cards', async () => {
  const { fund, deploy } = await chain();
  const admin = addr(0xa11ce), alice = addr(0xa1), bob = addr(0xb0b), carol = addr(0xca), anyone = addr(0x9);
  for (const a of [admin, alice, bob, carol, anyone]) await fund(a);
  const cards = await deploy('LegendaryCards.sol', 'LegendaryCards', [admin.toString(), 'ipfs://cards/{id}.json'], admin);
  const snap = [[144, alice, 1], [82, alice, 2]];
  const { root, proof } = tree(snap.map(([s, o, r]) => solidityPackedKeccak256(['uint256', 'address', 'uint8'], [s, o.toString(), r])));
  await cards.call('commitSnapshot', [root, 'ipfs://s']);
  await cards.call('migrate', [[144, 82], [alice.toString(), alice.toString()], [1, 2], [proof(0), proof(1)]]);
  const ryo = await deploy('RyoToken.sol', 'RyoToken', [admin.toString()], admin);
  const book = await deploy('OfferBook.sol', 'OfferBook', [ryo.at.toString(), cards.at.toString()], admin);
  const R = n => BigInt(n) * ETH;
  for (const w of [bob, carol]) {
    await ryo.call('transfer', [w.toString(), R(100_000)]);
    await ryo.call('approve', [book.at.toString(), R(1_000_000)], { from: w });
  }
  const bal = async w => (await ryo.call('balanceOf', [w.toString()])).value;
  const T0 = 1_760_000_000, DAY = 86_400;

  // rules
  await assert.rejects(book.call('placeOffer', [144, R(999), 7], { from: bob, time: T0 }), { revert: 'BadAmount' });
  await assert.rejects(book.call('placeOffer', [144, R(2_000), 5], { from: bob, time: T0 }), { revert: 'BadDuration' });
  await assert.rejects(book.call('placeOffer', [144, R(2_000), 7], { from: alice, time: T0 }), { revert: 'OwnCard' });

  // place → the amount is held by the book
  const p = await book.call('placeOffer', [144, R(5_000), 7], { from: bob, time: T0 });
  assert.equal(p.value, 1n);
  assert.equal(await bal(bob), R(95_000));
  assert.equal(await bal(book.at), R(5_000));
  // raise: only the difference moves, the old offer closes
  const raised = await book.call('placeOffer', [144, R(8_000), 3], { from: bob, time: T0 + 10 });
  assert.equal(raised.value, 2n);
  assert.equal(await bal(bob), R(92_000));
  assert.equal((await book.call('offers', [1])).value[2], 3n, 'first offer Cancelled');
  await assert.rejects(book.call('cancelOffer', [1], { from: bob }), { revert: 'NotOpen' });

  // reject (holder only) and cancel (bidder only) refund
  await book.call('placeOffer', [144, R(6_000), 1], { from: carol, time: T0 });
  await assert.rejects(book.call('rejectOffer', [3], { from: bob }), { revert: 'NotHolder' });
  await book.call('rejectOffer', [3], { from: alice });
  assert.equal(await bal(carol), R(100_000));
  await book.call('placeOffer', [82, R(3_000), 30], { from: carol, time: T0 });
  await assert.rejects(book.call('cancelOffer', [4], { from: bob }), { revert: 'NotBidder' });
  await book.call('cancelOffer', [4], { from: carol });
  assert.equal(await bal(carol), R(100_000));

  // accept: needs approval for the cards, then card + $RYO swap in one call
  // LegendaryCards reverts (NotOwnerOrApproved) inside the call; the book's ABI can't name a foreign error.
  await assert.rejects(book.call('acceptOffer', [2], { from: alice, time: T0 + 60 }), { revert: 'revert' });
  await cards.call('setApprovalForAll', [book.at.toString(), true], { from: alice });
  await assert.rejects(book.call('acceptOffer', [2], { from: carol, time: T0 + 60 }), { revert: 'NotHolder' });
  const acc = await book.call('acceptOffer', [2], { from: alice, time: T0 + 60 });
  assert.ok(acc.logs.some(l => l.name === 'OfferAccepted'));
  assert.equal((await cards.call('balanceOf', [bob.toString(), 144])).value, 1n);
  assert.equal(await bal(alice), R(8_000));
  assert.equal(await bal(book.at), 0n);
  await assert.rejects(book.call('acceptOffer', [2], { from: bob, time: T0 + 61 }), { revert: 'NotOpen' });

  // expiry: no accept after the deadline, anyone can send the $RYO back
  await book.call('placeOffer', [82, R(2_000), 1], { from: bob, time: T0 });
  await assert.rejects(book.call('reclaim', [5], { from: anyone, time: T0 + DAY - 1 }), { revert: 'NotExpired' });
  await assert.rejects(book.call('acceptOffer', [5], { from: alice, time: T0 + DAY }), { revert: 'Expired' });
  const before = await bal(bob);
  await book.call('reclaim', [5], { from: anyone, time: T0 + DAY });
  assert.equal(await bal(bob), before + R(2_000));
  assert.equal(await bal(book.at), 0n);
});
