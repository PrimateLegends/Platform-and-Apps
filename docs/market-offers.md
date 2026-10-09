# Market offers, every card visible, and the activity feed

Since v0.11.0 the Pre-Market shows **every card in the game**, not only the listed ones, and any card
can receive a **$RYO offer**.

## Every card is visible

- Listed cards come first, sorted as chosen (price, rarity, card number, recently listed).
- Cards that aren't listed always come **after** every listing, whatever the sort, and have their
  own **Unlisted** filter. A price filter hides them, since they have no price.
- Each unlisted card shows its holder (shortened wallet), whether it sits in escrow, and its best
  open offer.

## Offers

| Rule | Value |
| --- | --- |
| Amount | 1,000 to 10,000,000 $RYO |
| Expiry | 1, 3, 7 or 30 days (7 preselected) |
| Who can offer | Anyone, on any card that isn't theirs, the vault's or in escrow |
| Open offers per bidder and card | One. A new offer replaces the old one in the same step |
| Signature | Every action (offer, cancel, accept, reject) is a fresh, free wallet signature |
| Fee | 0% |

**Funds are locked.** Placing an offer moves the amount from the bidder to the `offers` account. It
comes back on cancel, reject or expiry, so an accepted offer always settles.

**Accepting** moves the card to the bidder and the $RYO to the holder in one atomic step. If the
card was listed, the listing ends. The sale counts in the market's total volume and shows in the
activity feed as *Offer accepted*.

**The offer belongs to the card.** If the card changes hands, the new holder can accept it. If the
bidder ends up holding the card, the offer is voided and refunded.

**Claim hold.** Freshly claimed cards can receive offers right away but can only be sold 48 hours
after the claim, the same rule as listings.

**Expiry.** Expired offers are refunded by a sweep that runs every hour and on every market read.

**Launch snapshot.** $RYO locked in open offers counts for its bidder in the token snapshot.

Where to see them: the card's detail view (Accept / Reject for the holder, Cancel for your own
offer), the market's **Offers** tab (Received and Made, with the total you have locked), and the
card inspect view in My Collection.

On-chain, the same design is [`contracts/OfferBook.sol`](../contracts/OfferBook.sol): the $RYO is
held by the contract, `acceptOffer` swaps the card and the $RYO in one transaction, and anyone can
`reclaim` an expired offer for its bidder.

## Activity feed

- The feed is a tab of the market (next to All, Vault, Players…), so it is one click away however
  many cards are listed.
- Every row shows the card it moved: a pixel-exact crop of the revealed front, or the sealed back.
  Escrow swaps show both cards. Clicking a card opens it.
- Claims carry the card number so they can be opened; the rarity of a claimed card is never sent.

## Airdrop rebalance (v1)

The first $RYO airdrop gave 100,000,000 $RYO to the 71 early claimers, half in equal parts and half
by cards held. To keep supply from concentrating in a few wallets, every recipient returned half of
its allocation to the vault (a wallet that had already spent part of it returned what it still
held). Future distributions use a per-wallet cap. Rules and tests:
[`services/market-engine`](../services/market-engine/).
