# Contracts

**Status: drafts, not audited, not deployed**

Primate Legends lives on Ethereum mainnet. This folder holds the Solidity drafts, published early
so the community can review the design before anything goes on-chain.

| Contract | Standard | Purpose | Status |
| --- | --- | --- | --- |
| Primate Legends | ERC-721 | The 3,003 warriors | Planned |
| [LegendaryCards](LegendaryCards.sol) | ERC-1155 | Sealed cards, pegged 1:1 to the off-chain Pre-Market and migrated from a Merkle snapshot | Draft |
| [PreMarketSettlement](PreMarketSettlement.sol) | — | Optional one-transaction ETH checkout: pays the seller and the fee in one call, keeps nothing | Draft |
| [HonorLedger](HonorLedger.sol) | Merkle claims | Seasonal Card Battles Honor | Draft |
| [RyoToken](RyoToken.sol) | ERC-20 | $RYO, fixed supply of 1,000,000,000 | Draft |
| [OfferBook](OfferBook.sol) | — | $RYO offers on Legendary Cards, held in escrow until accepted, cancelled, rejected or expired | Draft |
| [BattleStakes](BattleStakes.sol) | — | Battle Cards stakes: one transaction per player per match, the referee-signed result moves half of the loser's deck to the winner | Draft |

## LegendaryCards: from Pre-Market to on-chain

1. Cards live off-chain and trade on the Pre-Market under their Pre-Market ID (`PM-00144` = serial 144).
2. At migration time the server publishes a snapshot of every card, its owner and its rarity, and
   commits the Merkle root (`commitSnapshot`). The full leaf file is public, so anyone can rebuild it.
3. Each card is minted as **token id = serial**, exactly once, to the owner in the snapshot.
   `migrate` is permissionless (that's how the airdrop is pushed), but a proof only works for the
   owner and rarity it was made for.
4. `freeze` locks the snapshot and metadata forever.

Leaves are `keccak256(abi.encodePacked(uint256 serial, address owner, uint8 rarity))`, hashed in
sorted pairs, the same scheme as HonorLedger.

## PreMarketSettlement

Pre-Market payments are plain wallet-to-wallet transfers today, and the marketplace fee is 0%. If a
fee is ever turned on, this contract keeps checkout to one signature: `buy(listingId, seller)`
forwards `price - fee` to the seller and `fee` to the vault in the same call. The fee (max 10%)
and the vault are fixed at deployment; there is no owner, no withdraw and no upgrade. A listing
can only be settled once, and plain ETH sent to the contract is refused.

## RyoToken

$RYO is an off-chain ledger on the Pre-Market until the token launch. The token is a plain ERC-20
with 18 decimals and a fixed supply of 1,000,000,000, minted once at deployment to the distributor
that pays out the Pre-Market snapshot (balances plus $RYO locked in open offers). No mint, no burn
authority, no pause, no owner.

## OfferBook

The on-chain version of Pre-Market offers.

1. `placeOffer(cardId, amount, days)`: 1,000 to 10,000,000 $RYO, 1/3/7/30 days. The contract
   pulls the $RYO (allowance needed). One open offer per bidder and card: a new one replaces the
   old one and only the difference moves.
2. `acceptOffer(id)`: the current holder of the card (who approved the contract for their cards)
   sends it to the bidder and receives the $RYO in the same transaction.
3. `cancelOffer(id)` (bidder), `rejectOffer(id)` (current holder) and `reclaim(id)` (anyone,
   after expiry) send the $RYO back to the bidder.

The offer belongs to the card, not to the holder at offer time. No owner, no fee, no upgrade path,
reentrancy guarded, state written before any external call.

## Checks

```bash
npm run contracts   # compile every contract with solc
npm test            # includes contracts/test: the drafts run in an in-process EVM
```

No contract is deployed yet. Until an address is published here and verified on Etherscan, any
contract claiming to be Primate Legends is not ours. Official links are only announced on
[@primatelegends](https://x.com/primatelegends) and [primatelegends.world](https://primatelegends.world).

## BattleStakes

1. Each player approves the contract on LegendaryCards once, then joins a match with **one transaction**:
   `enter(matchId, keccak256(abi.encodePacked(deckSerials)))`.
2. The match is played off-chain and replayed by the server (the referee), which signs
   `keccak256(abi.encode(contract, chainId, matchId, winner, keccak256(abi.encodePacked(stake))))` (EIP-191).
3. Anyone submits `settle(matchId, winner, loserDeck, stake, signature)`. The contract checks the signature, that
   `loserDeck` matches the loser's commitment and that `stake` is exactly half of it with no repeats, then moves those
   cards to the winner. `winner = address(0)` is a draw and moves nothing. Each match settles once.
