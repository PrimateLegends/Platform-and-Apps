# Pre-Market

Rules for the Pre-Market, where players trade sealed Legendary Cards before they go on-chain.
Plain ES modules with no dependencies, so the same logic runs in the browser, on the server and
in tests.

| Module | What it does |
| --- | --- |
| [`src/money.js`](src/money.js) | Prices as integer base units (wei, micro-USDC), parsing, formatting, fee split |
| [`src/listings.js`](src/listings.js) | Pre-Market IDs, listing rules, filters, sorting, sidebar counts, floor price |
| [`src/checkout.js`](src/checkout.js) | 15-minute reservations, payment plan, settlement checks |
| [`src/solana-profile.js`](src/solana-profile.js) | Linked Solana wallets (up to 3 per profile), link message, USDC token account |

## How trading works

- **Sellers pick one currency** per listing: ETH on Ethereum mainnet, or USDC on Solana.
  Buyers pay in that currency.
- **Payments go wallet to wallet.** Nobody holds funds in between. The card moves to the buyer's
  profile once the payment is confirmed on-chain.
- **The fee is always shown**, taken out of the listed price. It is 0% today.
- **Your ETH wallet is your profile.** Solana wallets are linked to it with one free signature,
  up to 3. Once the 3 slots are used, only those wallets can pay or get paid. Cards bought with any
  linked wallet land in the same profile.
- **On-chain migration.** Every Pre-Market card is pegged 1:1 to the
  [`LegendaryCards`](../../contracts/LegendaryCards.sol) contract and airdropped to the wallet that
  owns it.

```js
import { parseAmount, splitPayment } from './src/money.js';
import { query, preMarketId } from './src/listings.js';

const price = parseAmount('12.5', 'usdc');      // 12_500_000n
splitPayment(price, 0);                           // { total, seller: 12_500_000n, fee: 0n }
query(listings, { currency: 'eth', rarities: ['legendary'] }, 'priceLow');
preMarketId(144);                                 // 'PM-00144'
```

Tests: `node --test apps/pre-market/test/pre-market.test.js`
