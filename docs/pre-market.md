# Pre-Market

The Pre-Market is where players trade sealed Legendary Cards before cards go on-chain. It is live
at [primatelegends.world/market](https://primatelegends.world/market) once listings open.

## Pre-Market cards

Pre-Market cards are pegged 1:1 to the [`LegendaryCards`](../contracts/LegendaryCards.sol)
contract. When Primates and Cards go live, the exact cards you own are airdropped to the wallet
you collected them with. Every card has a **Pre-Market ID** (`PM-00144`) that becomes its token id
on-chain (`144`).

## Profiles and wallets

- The **ETH wallet is the profile**. The first interaction with the site is always an ETH connection.
- **Solana wallets are linked to the profile**, like on OpenSea: connect the Solana wallet and sign
  one free message. The ETH session signature proves the profile owner is the one linking.
- **Up to 3 Solana wallets** per profile. The newest is the default for payouts. Once the 3 slots
  are used, only those wallets can pay or get paid; any other Solana address is refused.
- Links are stored server-side, so every device sees the same profile.

## Listing a card

A listing has one card, one currency and a fixed price. The seller sees what they receive and the
marketplace fee (0% today) before signing. ETH listings are paid to the seller's ETH address;
USDC listings to one of their linked Solana wallets.

## Buying a card

1. The buyer opens the checkout: card thumbnail, Pre-Market ID, network, price, fee, total.
2. A free signature reserves the card for 15 minutes.
3. The buyer pays the seller directly: a plain ETH transfer, or USDC from a linked Solana wallet
   (a new Solana wallet is linked on the spot if a slot is free).
4. The server confirms the transfer on-chain and moves the card to the buyer's profile.

A payment that arrives after the reservation ran out still completes if nobody else bought the card.
If someone did, the payment is flagged and refunded by the seller. Each transaction hash settles
one purchase only.

## Contracts

- [`LegendaryCards`](../contracts/LegendaryCards.sol): ERC-1155 migration from a Merkle snapshot of
  the Pre-Market (serial, owner, rarity). Permissionless airdrop, one mint per card, freezable.
- [`PreMarketSettlement`](../contracts/PreMarketSettlement.sol): optional one-transaction checkout
  if a fee is ever turned on. Immutable fee (max 10%) and vault, no owner, keeps nothing.

The rules above are implemented as plain modules in [`apps/pre-market`](../apps/pre-market/).
