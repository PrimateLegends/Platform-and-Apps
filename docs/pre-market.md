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

## Pay the rest with ETH

A buyer short of $RYO for a listing can pay the missing part in ETH, as long as their own $RYO covers **at least
10% of the price**.

- Rate: 100,000 $RYO = 0.0098 ETH. Minimum payment: 0.00045 ETH (the whole payment is credited).
- The listing is **held for the buyer for 30 seconds** while they confirm in their wallet, and for as long as the
  transaction is confirming once it's sent. Meanwhile nobody else can buy it, accept an offer on it, cancel or
  reprice it.
- The ETH goes to the platform vault. After 2 confirmations the buyer is credited the matching $RYO and the
  ordinary purchase runs: the seller gets the full price minus the usual royalty. The sale looks like any other.
- If the card is gone by then, the credited $RYO stays in the buyer's wallet. ETH is never lost and never refunded
  on-chain.

Rules in [`apps/pre-market/src/eth-topup.js`](../apps/pre-market/src/eth-topup.js) and
[`primate_market.eth_topup`](../services/market-engine/src/primate_market/eth_topup.py); on-chain draft in
[`EthTopUpRouter.sol`](../contracts/EthTopUpRouter.sol).

## The vault bid and the market floor

The vault buys any card, but never above the market for the common tiers: for Common, Uncommon and Rare cards it
pays the lower of 80% of the estimate and **80% of the floor** (cheapest listing) of that rarity. With no listing
of that rarity, the cheapest listing of any card is the reference. Legendary and Astral cards keep 80% of the
estimate. The vault's own listings follow the current estimate, so buying from the vault and selling straight
back never pays (`apps/ryo`: `vaultBid`, `vaultRepricing`).

## King of the Hill

The market shows the 3 wallets with the most card volume of the last 24 hours. See
[docs/progression.md](progression.md).
