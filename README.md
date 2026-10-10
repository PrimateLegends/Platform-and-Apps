<p align="center">
  <img src="apps/legendary-cards-preview/public/img/brand/logo.png" alt="Primate Legends" width="480">
</p>

<h1 align="center">Primate Legends Platform &amp; Apps</h1>

<p align="center">
  Apps, game engine and integrations for Primate Legends, a pixel-art ninja-empire collection of 3,003 warriors on Ethereum.
</p>

<p align="center">
  <a href="https://primatelegends.world">primatelegends.world</a> ·
  <a href="https://x.com/primatelegends">@primatelegends</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/card-battles.md">Card Battles</a> ·
  <a href="docs/pre-market.md">Pre-Market</a> ·
  <a href="docs/card-reveal.md">Card reveal</a> ·
  <a href="docs/market-offers.md">Offers</a> ·
  <a href="docs/battle-cards-app-store.md">App Store</a> ·
  <a href="contracts/">Contracts</a> ·
  <a href="docs/roadmap.md">Roadmap</a>
</p>

<p align="center">
  <img src="apps/legendary-cards-preview/screenshots/overview.png" alt="Legendary Cards UI preview" width="880">
</p>

## Apps

| App | What it is | Status |
| --- | --- | --- |
| [Legendary Cards preview](apps/legendary-cards-preview/) | Browser-only preview of the card vault: sealed packs, daily claims with a 7-day streak, card hints and the collection grid | Preview |
| [Card Battles](apps/card-battles/) | Rules engine for the two-player card game (rules v1): KI and spare KI, attack token, CHALLENGE, combat keywords, equipment, ASCEND, half-deck stake, scoring and Honor | In development |
| [Card reveal](apps/reveal/) | Reveal rules: hint-true fronts, tiers, copy caps, clans by fur colour, 35% of new claims revealed | Live |
| [Pre-Market](apps/pre-market/) | Rules for trading sealed cards before they go on-chain: listings, filters, wallet-to-wallet checkout, linked Solana wallets | In development |
| [Market engine](services/market-engine/) (Python) | $RYO ledger, card offers, airdrop split and rebalance, activity feed card references | Live rules |
| [Card catalog](services/card-balance/) (Python) | All 205 card fronts with their KI, stats and text, checked against the stat budget, keyword vocabulary, deck rules and clan accents | Rules v1 |
| [Battle Cards for iOS](apps/battle-cards-ios/) | SwiftUI draft of the iPhone and iPad app: Inventory and Pre-Market screens | Draft, not compiled yet |

## Pre-Market

Players trade sealed Legendary Cards before cards go on-chain, paying each other directly in ETH or
USDC on Solana. Your ETH wallet is your profile; up to 3 Solana wallets can be linked to it. Every
Pre-Market card is pegged 1:1 to the [`LegendaryCards`](contracts/LegendaryCards.sol) ERC-1155 contract
and airdropped to its owner at migration. Details in [docs/pre-market.md](docs/pre-market.md).

## Card reveal

Sealed cards are being revealed in batches: 83.8% of all cards so far, every one true to its hinted card type and
within its rarity tier. Common Attack/Defense cards now exist in up to 4 clans (same art, the primate in another clan).
The clan of a revealed card is the colour of the primates on it. Rules in [docs/card-reveal.md](docs/card-reveal.md).

## $RYO and WL Batch 3

`apps/ryo` holds the rules for $RYO, the off-chain currency of the Pre-Market until the token launch: fixed supply of 1,000,000,000, $RYO-only listings with a 1,000 floor, a vault that buys at 80% up to 3 times a week per wallet, the daily claim with its 7-day streak reward, and the WL Batch 3 claim codes (20 uses, 400 $RYO per use; new wallets get 1 sealed card + 50 $RYO, and 50 more after review). Details in [docs/ryo-and-batch3.md](docs/ryo-and-batch3.md).

## Offers and the activity feed

Every card in the game is visible on the Pre-Market: listings first, then every unlisted card (with its own **Unlisted** filter). Anyone can offer $RYO for a card that isn't theirs: 1,000 to 10,000,000 $RYO, open for 1, 3, 7 or 30 days, locked until the holder accepts, the bidder cancels, the holder rejects or it expires. The activity feed is a tab of the market and shows the card each event moved. Rules in [docs/market-offers.md](docs/market-offers.md), engine in [`services/market-engine`](services/market-engine/), on-chain draft in [`OfferBook.sol`](contracts/OfferBook.sol).

## Contracts

| Contract | Purpose |
| --- | --- |
| [`LegendaryCards`](contracts/LegendaryCards.sol) | ERC-1155 sealed cards, 1:1 migration from a Merkle snapshot of the Pre-Market |
| [`PreMarketSettlement`](contracts/PreMarketSettlement.sol) | One-transaction ETH checkout with an immutable fee, keeps nothing |
| [`HonorLedger`](contracts/HonorLedger.sol) | Seasonal Card Battles Honor, claimed with Merkle proofs |
| [`BattleStakes`](contracts/BattleStakes.sol) | One transaction per player per match; the referee-signed result moves half of the loser's deck to the winner |
| [`RyoToken`](contracts/RyoToken.sol) | Fixed-supply $RYO ERC-20: 1,000,000,000 minted once, no mint, no owner |
| [`OfferBook`](contracts/OfferBook.sol) | $RYO offers on Legendary Cards: escrowed bids, one-transaction accept, reclaim after expiry |

All drafts, not audited, not deployed. They compile with solc 0.8.28 and run in an in-process EVM in `npm test`.

## Primate Legends: Card Battles

The game your Legendary Cards are for. Two players, 40-card decks, 20 points each, and the winner takes half of
the loser's deck. Rules v1:

- **KI.** Both players gain KI every round and trade actions playing warriors, tactics, equipment, items and
  locations. Up to 3 unspent KI is saved as spare KI for tactics.
- **The attack token** switches every round. CHALLENGE warriors pick their blocker; SHADOW, INTIMIDATE, FIRST
  STRIKE, TWIN STRIKE, BREAKTHROUGH, DODGE, IRON SKIN and the rest of a fixed keyword vocabulary decide each fight.
- **Balanced by design.** Every warrior follows a KI stat budget, every clan stands out at one accent (evasion,
  attack & burst, defense, healing) and has a full curve, and Starter scrolls complete short collections: no
  useless decks. The checks run on the whole catalog in CI.
- **Legendary warriors ASCEND** when their condition is met.
- **On-chain.** One transaction per player per match ([`BattleStakes`](contracts/BattleStakes.sol)); matches are
  deterministic and replayed by the server; each season's Honor is committed to [`HonorLedger`](contracts/HonorLedger.sol).

Full rules in [docs/card-battles.md](docs/card-battles.md).

```js
import { createMatch, apply, settleStake } from './apps/card-battles/src/engine.js';

let match = createMatch({ seed: 42, decks: [deckA, deckB] });
match = apply(match, { type: 'play', player: 0, handIndex: 0 });
match = apply(match, { type: 'attack', player: 0, attackers: [1] });
const stake = settleStake(match);   // the 20 cards the winner takes
```

## Battle Cards Appstore Prospect

We want Battle Cards on iPhone and iPad. The first build is read-only: your **Inventory** (sealed
cards, packs and hints) and the **Pre-Market** (listings, filters, floor price), the same two
things you can already do on the website. Battles come after.

- Draft Swift code: [`apps/battle-cards-ios`](apps/battle-cards-ios/). It has not been compiled or
  run yet.
- Your Ethereum address is your profile, as on the site. The app never asks for a seed phrase and
  never signs anything.
- Trading stays on primatelegends.world, wallet to wallet. The app shows listings and links out.
- Nothing has been submitted to Apple and there is no date. Plan and open questions:
  [docs/battle-cards-app-store.md](docs/battle-cards-app-store.md).

## Run it

```bash
git clone https://github.com/PrimateLegends/Platform-and-Apps.git
cd Platform-and-Apps
npm start        # http://localhost:8080/apps/legendary-cards-preview/
npm test             # apps + contracts (in-process EVM)
npm run test:engine  # Python market engine
npm run check        # assets resolve, no secrets or local paths
```

Node 18 or newer and Python 3.10 or newer. The apps and the engine have no dependencies; `npm install` only adds the Solidity compiler and the test EVM used by `npm test`. CI runs both on every push.

## Layout

```
├── apps/
│   ├── legendary-cards-preview/   card vault UI preview (ES modules, no build step)
│   ├── card-battles/              rules engine + tests
│   ├── pre-market/                Pre-Market rules: listings, checkout, linked Solana wallets
│   └── battle-cards-ios/          SwiftUI draft of the iOS app (Inventory, Pre-Market)
├── services/
│   ├── market-engine/             Python: $RYO ledger, offers, airdrop rebalance, activity feed
│   └── card-balance/              Python: the 205-card catalog and its balance rules
├── contracts/                     Solidity drafts (LegendaryCards, RyoToken, OfferBook, PreMarketSettlement, HonorLedger, BattleStakes) + EVM tests
├── integrations/                  OpenClaw skill, ChatGPT app (planned)
├── docs/                          architecture, Card Battles, Pre-Market, App Store prospect, roadmap
└── scripts/                       local server, repository checks, contract compiler
```

## Agents

| Integration | Status |
| --- | --- |
| [OpenClaw skill](integrations/openclaw/): ask your agent about your cards, packs and daily streak | Experimental |
| [ChatGPT app](integrations/chatgpt/): explore clans, lore and your collection from a chat | Planned |
| MCP server for the read-only vault API | Planned |

## On-chain

| Item | Status |
| --- | --- |
| Primate Legends collection (ERC-721, 3,003 tokens) | Planned |
| Sealed Legendary Cards (ERC-1155 airdrops) | Planned |
| Burn 4 cards + 1 Primate for WETH or Ryo Coins | Planned (after mint) |
| Card Battles Honor ([`HonorLedger.sol`](contracts/HonorLedger.sol)) | Draft |
| Card Battles stakes ([`BattleStakes.sol`](contracts/BattleStakes.sol)) | Draft |
| Legendary Cards on [Phygitals](https://www.phygitals.com/) | Goal |

No contract is deployed yet. Official addresses will only be published in
[`contracts/`](contracts/) and announced on [@primatelegends](https://x.com/primatelegends).

## Built with

This code is written, edited and reviewed by the Primate Legends team, led by **SnowMofo**
(Founder, Senior Dev) and **Crovy** (Developer). AI assistants help us draft and check work;
people decide what ships.

| What | Where we use it |
| --- | --- |
| [Solidity](https://soliditylang.org/) 0.8 | The contract drafts in [`contracts/`](contracts/) |
| JavaScript (ES modules) | The apps in [`apps/`](apps/), with no framework and no build step |
| [Python](https://www.python.org/) 3.10+ and `unittest` | The [market engine](services/market-engine/) and the [card catalog](services/card-balance/) |
| Swift and SwiftUI | The [iOS draft](apps/battle-cards-ios/) of Battle Cards |
| [Node.js](https://nodejs.org/) and `node:test` | Tests and repository checks |
| [ethers](https://docs.ethers.org/) | Wallet signatures and contract tests |
| [EthereumJS VM](https://github.com/ethereumjs/ethereumjs-monorepo) and [solc](https://github.com/ethereum/solc-js) | Compiling and running the contracts locally |
| [Cloudflare Workers and D1](https://developers.cloudflare.com/workers/) | The live site and its card vault API |
| [ChatGPT](https://chatgpt.com/) and [Claude](https://claude.com/) | Drafting, refactoring and code review support |

## License

All rights reserved. The code is public so you can read and try it. The artwork, characters
and names belong to Primate Legends. See [LICENSE](LICENSE).

Security issues: see [SECURITY.md](SECURITY.md).
