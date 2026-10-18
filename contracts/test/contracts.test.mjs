// Runs the Solidity drafts in an in-process EVM (@ethereumjs/vm) and checks their behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VM } from '@ethereumjs/vm';
import { Block } from '@ethereumjs/block';
import { Common, Chain, Hardfork } from '@ethereumjs/common';
import { Address, Account, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { Interface, AbiCoder, solidityPackedKeccak256, keccak256, getBytes, concat, id as eventId, Wallet } from 'ethers';
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


/* ---------- BattleStakes: one transaction per player, the winner takes half of the loser's deck ---------- */
test('BattleStakes: enter with one transaction, settle with the referee signature, winner takes half the deck', async () => {
  const { fund, deploy } = await chain();
  const admin = addr(0xa11ce), alice = addr(0xa1), bob = addr(0xb0b), anyone = addr(0x77);
  for (const a of [admin, alice, bob, anyone]) await fund(a);
  const referee = new Wallet('0x' + '11'.repeat(32));
  const cards = await deploy('LegendaryCards.sol', 'LegendaryCards', [admin.toString(), 'ipfs://cards/{id}.json'], admin);
  // four cards each (a tiny deck keeps the test readable; real decks are 40)
  const aliceDeck = [11, 12, 13, 14], bobDeck = [21, 22, 23, 24];
  const snap = [...aliceDeck.map(s => [s, alice, 1]), ...bobDeck.map(s => [s, bob, 2])];
  const { root, proof } = tree(snap.map(([s, o, r]) => solidityPackedKeccak256(['uint256', 'address', 'uint8'], [s, o.toString(), r])));
  await cards.call('commitSnapshot', [root, 'ipfs://s']);
  await cards.call('migrate', [snap.map(x => x[0]), snap.map(x => x[1].toString()), snap.map(x => x[2]), snap.map((_, i) => proof(i))]);
  const stakes = await deploy('BattleStakes.sol', 'BattleStakes', [cards.at.toString(), referee.address, admin.toString()], admin);
  const commit = deck => solidityPackedKeccak256(deck.map(() => 'uint256'), deck);
  const M = keccak256(getBytes(eventId('match-1')));

  await assert.rejects(stakes.call('enter', [M, commit(aliceDeck)], { from: alice }), { revert: 'NotApproved' });
  for (const p of [alice, bob]) await cards.call('setApprovalForAll', [stakes.at.toString(), true], { from: p });
  await stakes.call('enter', [M, commit(aliceDeck)], { from: alice });
  await assert.rejects(stakes.call('enter', [M, commit(aliceDeck)], { from: alice }), { revert: 'AlreadyEntered' });
  await stakes.call('enter', [M, commit(bobDeck)], { from: bob });
  await cards.call('setApprovalForAll', [stakes.at.toString(), true], { from: anyone });
  await assert.rejects(stakes.call('enter', [M, commit(aliceDeck)], { from: anyone }), { revert: 'MatchFull' });

  const sign = async (winner, stake) => referee.signMessage(getBytes((await stakes.call('resultDigest', [M, winner, stake])).value));
  const stake = [22, 24];
  // wrong signer, stake outside the loser's deck, wrong deck: all rejected
  const forged = await new Wallet('0x' + '22'.repeat(32)).signMessage(getBytes((await stakes.call('resultDigest', [M, alice.toString(), stake])).value));
  await assert.rejects(stakes.call('settle', [M, alice.toString(), bobDeck, stake, forged], { from: anyone }), { revert: 'BadSignature' });
  await assert.rejects(stakes.call('settle', [M, alice.toString(), bobDeck, [22, 99], await sign(alice.toString(), [22, 99])], { from: anyone }), { revert: 'BadStake' });
  await assert.rejects(stakes.call('settle', [M, alice.toString(), [21, 22, 23, 25], stake, await sign(alice.toString(), stake)], { from: anyone }), { revert: 'BadDeck' });
  await assert.rejects(stakes.call('settle', [M, alice.toString(), bobDeck, [22, 22], await sign(alice.toString(), [22, 22])], { from: anyone }), { revert: 'BadStake' });

  const res = await stakes.call('settle', [M, alice.toString(), bobDeck, stake, await sign(alice.toString(), stake)], { from: anyone });
  assert.equal(res.logs.find(l => l.name === 'MatchSettled').args.winner.toLowerCase(), alice.toString());
  const bal = async (who, id) => (await cards.call('balanceOf', [who.toString(), id])).value;
  assert.equal(await bal(alice, 22), 1n); assert.equal(await bal(alice, 24), 1n);
  assert.equal(await bal(bob, 22), 0n); assert.equal(await bal(bob, 21), 1n, 'the other half stays with the loser');
  await assert.rejects(stakes.call('settle', [M, alice.toString(), bobDeck, stake, await sign(alice.toString(), stake)], { from: anyone }), { revert: 'AlreadySettled' });

  // a draw moves nothing
  const D = keccak256(getBytes(eventId('match-2')));
  await stakes.call('enter', [D, commit(aliceDeck)], { from: alice });
  await stakes.call('enter', [D, commit(bobDeck)], { from: bob });
  const drawSig = await referee.signMessage(getBytes((await stakes.call('resultDigest', [D, '0x' + '00'.repeat(20), []])).value));
  const d = await stakes.call('settle', [D, '0x' + '00'.repeat(20), [], [], drawSig], { from: anyone });
  assert.ok(d.logs.some(l => l.name === 'MatchDrawn'));
  assert.equal(await bal(alice, 11), 1n);
  await assert.rejects(stakes.call('setReferee', [anyone.toString()], { from: anyone }), { revert: 'NotAdmin' });
});

/* ---------- $RYO swap: holder-only constant-product pool + secondary liquidity vault ---------- */
// Plain ETH transfer (no calldata) to a deployed contract; returns the revert name if any.
async function sendEth(vm, iface, from, to, value) {
  const r = await vm.evm.runCall({ caller: from, to, value, data: new Uint8Array(), gasLimit: 1_000_000n });
  if (!r.execResult.exceptionError) return null;
  const ret = bytesToHex(r.execResult.returnValue);
  return ret !== '0x' ? iface.parseError(ret).name : 'revert';
}

test('RyoSwapPool: 2+ Primates to swap, constant product, slippage + deadline, liquidity only goes in', async () => {
  const { vm, fund, balance, deploy } = await chain();
  const team = addr(0x7ea), alice = addr(0xa1), bob = addr(0xb0b);
  for (const a of [team, alice, bob]) await fund(a);
  const ryo = await deploy('RyoToken.sol', 'RyoToken', [team.toString()], team);
  const nft = await deploy('test/MockPrimates.sol', 'MockPrimates', [], team);
  const pool = await deploy('RyoSwapPool.sol', 'RyoSwapPool', [ryo.at.toString(), nft.at.toString(), 2, team.toString()], team);
  const RYO = 10n ** 18n, MAX = 2n ** 256n - 1n;
  await ryo.call('approve', [pool.at.toString(), MAX], { from: team });

  // seed: 10 ETH against 1,000,000 $RYO
  await assert.rejects(pool.call('seed', [1_000_000n * RYO], { from: alice, value: 10n * ETH }), { revert: 'NotProvider' });
  await pool.call('seed', [1_000_000n * RYO], { from: team, value: 10n * ETH });
  await assert.rejects(pool.call('seed', [1n], { from: team, value: 1n }), { revert: 'AlreadySeeded' });
  assert.equal((await pool.call('ryoPerEth')).value, 100_000n * RYO, 'opening price: 100,000 $RYO per ETH');

  // the holder rule: 1 Primate isn't enough, 2 is
  await nft.call('setBalance', [alice.toString(), 1]);
  assert.deepEqual([...(await pool.call('canTrade', [alice.toString()])).value], [false, 1n]);
  await assert.rejects(pool.call('swapEthForRyo', [0, 9999999999], { from: alice, value: ETH }), { revert: 'NotEnoughPrimates' });
  await nft.call('setBalance', [alice.toString(), 2]);

  // quote = reserveOut · in / (reserveIn + in); impact = in / (reserveIn + in)
  const q = (await pool.call('quote', [ETH, true])).value;
  assert.equal(q, (1_000_000n * RYO * ETH) / (11n * ETH));
  assert.equal((await pool.call('priceImpactBps', [ETH, true])).value, 909n, '1 ETH into 10 ETH of depth moves the price 9.09%');
  await assert.rejects(pool.call('swapEthForRyo', [q + 1n, 9999999999], { from: alice, value: ETH }), { revert: 'Slippage' });
  await assert.rejects(pool.call('swapEthForRyo', [0, 1000], { from: alice, value: ETH, time: 2000 }), { revert: 'DeadlinePassed' });
  const k0 = (await pool.call('reserveEth')).value * (await pool.call('reserveRyo')).value;
  const s = await pool.call('swapEthForRyo', [q, 9999999999], { from: alice, value: ETH });
  assert.equal(s.value, q);
  assert.equal((await ryo.call('balanceOf', [alice.toString()])).value, q, 'alice got the quoted $RYO');
  const k1 = (await pool.call('reserveEth')).value * (await pool.call('reserveRyo')).value;
  assert.ok(k1 >= k0, 'x·y never shrinks');

  // and back: $RYO -> ETH, paid in the same call
  await ryo.call('approve', [pool.at.toString(), MAX], { from: alice });
  const half = q / 2n, ethQ = (await pool.call('quote', [half, false])).value;
  const before = await balance(alice);
  await pool.call('swapRyoForEth', [half, ethQ, 9999999999], { from: alice });
  assert.equal((await balance(alice)) - before, ethQ, 'alice received the quoted ETH (the in-process EVM charges no gas)');

  // more liquidity at the current ratio: same price, deeper pool; nothing can be withdrawn
  const p0 = (await pool.call('ryoPerEth')).value;
  await pool.call('addLiquidity', [], { from: team, value: 5n * ETH });
  const p1 = (await pool.call('ryoPerEth')).value;
  assert.ok(p1 >= p0 && p1 - p0 <= 1n, 'price unchanged by adding liquidity');
  assert.ok(!new Interface(artifact('RyoSwapPool.sol', 'RyoSwapPool').abi).fragments.some(f => f.type === 'function' && /withdraw|remove/i.test(f.name)), 'no way to remove liquidity');
  assert.equal(await sendEth(vm, new Interface(artifact('RyoSwapPool.sol', 'RyoSwapPool').abi), bob, pool.at, ETH), 'UseSwap', 'plain ETH is refused');
});

test('LiquidityVault: every ETH deposit counts forever, forwards and change never change the total', async () => {
  const { vm, fund, balance, deploy } = await chain();
  const keeper = addr(0x6ee), alice = addr(0xa1), bob = addr(0xb0b), bridge = addr(0xb41d6e);
  for (const a of [keeper, alice, bob]) await fund(a);
  const vault = await deploy('LiquidityVault.sol', 'LiquidityVault', [keeper.toString()], keeper);
  const iface = new Interface(artifact('LiquidityVault.sol', 'LiquidityVault').abi);
  const bouncer = await deploy('test/Bouncer.sol', 'Bouncer', [], keeper);
  const bIface = new Interface(artifact('test/Bouncer.sol', 'Bouncer').abi);

  assert.equal(await sendEth(vm, iface, alice, vault.at, ETH), null);
  assert.equal(await sendEth(vm, iface, bob, vault.at, ETH / 2n), null);
  assert.equal(await sendEth(vm, iface, bob, vault.at, 0n), 'ZeroAmount');
  assert.equal((await vault.call('totalDeposited')).value, 3n * ETH / 2n);
  assert.equal((await vault.call('depositCount')).value, 2n);

  // keeper bridges 1.2 ETH out (e.g. to build liquidity on Solana): deposits still count
  await assert.rejects(vault.call('forward', [bridge.toString(), ETH, '0x', eventId('solana-bridge')], { from: alice }), { revert: 'NotKeeper' });
  const f = await vault.call('forward', [bridge.toString(), 12n * ETH / 10n, '0x', eventId('solana-bridge')], { from: keeper });
  assert.ok(f.logs.some(l => l.name === 'Forwarded'));
  assert.equal(await balance(bridge), 12n * ETH / 10n);
  assert.equal((await vault.call('declaredLiquidity')).value, 3n * ETH / 2n, 'forwarding does not lower declared liquidity');

  // change coming back inside the vault's own forward is not a deposit
  await vault.call('forward', [bouncer.at.toString(), 3n * ETH / 10n, bIface.encodeFunctionData('bounce', [ETH / 10n]), eventId('pool')], { from: keeper });
  assert.equal(await balance(vault.at), ETH / 10n, 'the change came back');
  assert.equal((await vault.call('totalDeposited')).value, 3n * ETH / 2n, 'but it is not counted as a deposit');
  assert.equal((await vault.call('depositCount')).value, 2n);
  assert.equal((await vault.call('totalForwarded')).value, 15n * ETH / 10n);
});

test('CardCourier: up to 20 cards in one transaction, flat $RYO fee per card to the vault', async () => {
  const { fund, deploy } = await chain();
  const admin = addr(0xa11ce), alice = addr(0xa1), bob = addr(0xb0b), vault = addr(0x7a017), dist = addr(0xd157);
  for (const a of [admin, alice, bob, vault, dist]) await fund(a);
  const cards = await deploy('LegendaryCards.sol', 'LegendaryCards', [admin.toString(), 'ipfs://cards/{id}.json'], admin);
  const ryo = await deploy('RyoToken.sol', 'RyoToken', [dist.toString()], dist);
  const FEE = 5n * ETH;
  const courier = await deploy('CardCourier.sol', 'CardCourier', [cards.at.toString(), ryo.at.toString(), vault.toString(), FEE], admin);

  // alice owns cards 11, 12, 13 (migrated) and 100 $RYO
  const snap = [[11, alice, 1], [12, alice, 2], [13, alice, 0]];
  const leaves = snap.map(([s, o, r]) => solidityPackedKeccak256(['uint256', 'address', 'uint8'], [s, o.toString(), r]));
  const { root, proof } = tree(leaves);
  await cards.call('commitSnapshot', [root, 'ipfs://s']);
  await cards.call('migrate', [[11, 12, 13], snap.map(x => x[1].toString()), snap.map(x => x[2]), [proof(0), proof(1), proof(2)]]);
  await ryo.call('transfer', [alice.toString(), 100n * ETH]);

  // nothing approved yet: the whole send reverts, the fee included
  await assert.rejects(courier.call('send', [bob.toString(), [11]], { from: alice }));
  await ryo.call('approve', [courier.at.toString(), 1000n * ETH], { from: alice });
  await assert.rejects(courier.call('send', [bob.toString(), [11]], { from: alice }), 'cards not approved: reverts');
  assert.equal((await ryo.call('balanceOf', [alice.toString()])).value, 100n * ETH, 'no fee taken on a failed send');
  await cards.call('setApprovalForAll', [courier.at.toString(), true], { from: alice });

  assert.equal((await courier.call('feeFor', [2])).value, 2n * FEE);
  const r = await courier.call('send', [bob.toString(), [11, 12]], { from: alice });
  assert.equal(r.logs.filter(l => l.name === 'CardsSent').length, 1);
  assert.deepEqual([...(await cards.call('balanceOfBatch', [[bob.toString(), bob.toString(), alice.toString()], [11, 12, 13]])).value], [1n, 1n, 1n]);
  assert.equal((await ryo.call('balanceOf', [alice.toString()])).value, 90n * ETH);
  assert.equal((await ryo.call('balanceOf', [vault.toString()])).value, 10n * ETH);

  await assert.rejects(courier.call('send', [alice.toString(), [13]], { from: alice }), { revert: 'SelfTransfer' });
  await assert.rejects(courier.call('send', [bob.toString(), []], { from: alice }), { revert: 'NoCards' });
  await assert.rejects(courier.call('send', [bob.toString(), Array.from({ length: 21 }, (_, i) => i + 1)], { from: alice }), { revert: 'TooManyCards' });
  await assert.rejects(courier.call('send', [bob.toString(), [11]], { from: alice }), 'a card already sent cannot move again');
});
