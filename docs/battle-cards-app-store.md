# Battle Cards App Store prospect

We want Primate Legends: Battle Cards on iPhone and iPad. This page is the plan as it stands. It is
a prospect: nothing has been submitted to Apple and there is no release date.

## What ships first

| Build | What is in it | Status |
| --- | --- | --- |
| 1 | Inventory: sealed cards, packs and card hints for an Ethereum address | Draft code in [`apps/battle-cards-ios`](../apps/battle-cards-ios/) |
| 1 | Pre-Market: browse listings, filter, sort, floor price | Draft code, sample data |
| 2 | Daily claim status and streak, with a reminder notification | Planned |
| 3 | Card Battles against other players, on the [rules engine](card-battles.md) | Planned |

The first build is read-only on purpose. It reads the same public API the website and the
[OpenClaw skill](../integrations/openclaw/) use, so it needs no account and no wallet connection.

## How it fits with the website

- **Your Ethereum address is your profile**, the same as on the site. Cards you see in the app are
  the cards in your vault.
- **Trading stays on the website.** Pre-Market payments go wallet to wallet in ETH or USDC on
  Solana. The app shows listings and links out.
- **The rules are shared.** Filters and sorting in the app are a port of
  [`apps/pre-market`](../apps/pre-market/); battles will run the same engine as
  [`apps/card-battles`](../apps/card-battles/).

## Open questions

- **App Review.** Apple has specific rules for apps that show NFTs and for anything bought outside
  in-app purchase. We need to read the current guidelines against each feature before build 2, and
  the answer may change what the app can link to.
- **Battles engine on iOS.** Either run the JavaScript engine inside the app or port it to Swift.
  Running the same code avoids two versions of the rules drifting apart.
- **Wallet connection.** Signing from a phone wallet is only needed once the app does more than
  read. Not in build 1.
- **Android.** Not scoped yet.
