# Roadmap

Status labels: **Live** is on primatelegends.world today. **Launching** has a date. **Experimental** works
but may change. **Planned** is not built yet.

| Area | Item | Status |
| --- | --- | --- |
| Website | Landing page, territory map, lore | Live |
| Website | Wallet drawer: ETH balance, items, clan pledge | Live |
| Cards | Legendary Cards vault, packs, sealed cards | Launching Sep 30, 2026 |
| Cards | Daily free claim with a 7-day streak and Bounties (303-card supply, reveal before keeping) | Launching Sep 30, 2026 |
| Whitelist | Referral-only applications, referral quest with Bounties and double chances ([rules](referrals-and-claims.md)) | Live |
| Cards | My Collection page | Launching Sep 30, 2026 |
| Cards | Sealed-card hints (card type, possible clan) and random serial numbers | Launching Sep 30, 2026 |
| Cards | Burn 4 cards + 1 Primate for WETH or Ryo Coins (burn cap 1,003, supply floor 2,000) | Planned (after mint) |
| Agents | [OpenClaw skill](../integrations/openclaw/) to check a wallet's vault and daily claim | Experimental |
| Agents | [ChatGPT app](../integrations/chatgpt/) to browse clans, lore and your collection from a chat | Planned |
| Agents | MCP server exposing the read-only vault API to any agent | Planned |
| Game | Card Battles rules engine (rounds, Ki, keywords, Heroes, scoring) | In development |
| Game | Seasonal Honor on-chain (HonorLedger) | Draft |
| Market | Pre-Market: trade sealed cards wallet to wallet in ETH or USDC on Solana ([rules](pre-market.md)) | In development |
| Market | Linked Solana wallets (up to 3 per profile) | In development |
| On-chain | Sealed cards migrated 1:1 from the Pre-Market as ERC-1155 tokens ([LegendaryCards](../contracts/LegendaryCards.sol)) | Draft |
| On-chain | One-transaction checkout contract ([PreMarketSettlement](../contracts/PreMarketSettlement.sol)) | Draft |
| On-chain | Primate Legends collection contract (3,003 tokens) | Planned |
| On-chain | Contract drafts published in [`contracts/`](../contracts/), compiled and tested with `npm test` | Draft |
| Marketplaces | Legendary Cards listed on [Phygitals](https://www.phygitals.com/) | Planned (goal) |
| Economy | Ryo Coins balance and weekly missions | Planned |
| Map | Monoliths on the Wiko map that drop Bounties | Planned |
| Community | Streak and collector leaderboards | Planned |

Items marked Planned are goals, not promises of a date. This file is updated
when something ships.
