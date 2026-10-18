# Card transfers

Players can send cards to any other wallet from the **Transfer cards** page (`/transfer`), reachable from the wallet
drawer and from My Collection.

## Internal transfer (live, Pre-Market)

- Send to **any wallet address**. A wallet that never signed in on the site still receives the cards: the page shows
  a warning first, and the cards and a "Card received" notice wait in that wallet's vault until its first sign-in.
- **Fee: 5 $RYO per card**, paid to the vault. Not enough $RYO and nothing moves.
- Up to **20 cards** per transfer, one free signature (no transaction, no gas).
- Cards that can't move: listed on the market, locked in escrow, or still on their hold (48 hours after a claim,
  72 hours after a pack opening). The same holds apply to selling.
- No daily limit. More than **7 transfers inside 2 minutes** asks for a quick security check.
- The page waits about a second after the signature before the success window, so the result never feels instant.
- The recipient gets a **Card received** notice in the wallet drawer. Every transfer also shows up in the public
  activity feed (sender → recipient, shortened wallets) and in the sender's and recipient's own activity panel.

## External transfer (after migration)

Disabled on the page ("Coming soon") until the cards migrate on-chain. Then [`CardCourier`](../contracts/CardCourier.sol)
moves up to 20 Legendary Cards (ERC-1155) in one transaction and pays the same flat $RYO fee per card to the vault.
The courier never holds cards or $RYO; both move straight from the sender, and a failed card move undoes the fee.

## Code

| Piece | Where |
| --- | --- |
| Rules (fee, holds, burst check, notices, wallet activity) | [`apps/transfers`](../apps/transfers/) |
| Engine (cards + fee move together or not at all) | [`services/market-engine`](../services/market-engine/) `primate_market.transfers` |
| On-chain courier | [`contracts/CardCourier.sol`](../contracts/CardCourier.sol) |
