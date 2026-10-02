# Battle Cards for iOS (draft)

A first sketch of the iPhone and iPad app for Primate Legends: Battle Cards, written in Swift
with SwiftUI. It covers the two screens the first build will have:

| Screen | What it does | Data |
| --- | --- | --- |
| Inventory | Your sealed cards and unopened packs, rarity filter, card hints | Live read-only API (`/api/vault`) |
| Pre-Market | Listings with currency filter, serial search, sorting and floor price | Sample data, until the listings endpoint is public |

**Status: draft.** This code has not been compiled or run yet. It was written away from a Mac,
so expect to fix small things when the Xcode project is created. There is no `.xcodeproj` in the
repository yet.

## Files

| File | What it holds |
| --- | --- |
| [`BattleCards/Models.swift`](BattleCards/Models.swift) | Cards, hints, packs, prices in integer base units, listings |
| [`BattleCards/VaultClient.swift`](BattleCards/VaultClient.swift) | Read-only API client and the listings source |
| [`BattleCards/MarketFilters.swift`](BattleCards/MarketFilters.swift) | Filters and sorting, ported from [`apps/pre-market`](../pre-market/) |
| [`BattleCards/InventoryView.swift`](BattleCards/InventoryView.swift) | Inventory screen |
| [`BattleCards/PreMarketView.swift`](BattleCards/PreMarketView.swift) | Pre-Market screen |
| [`BattleCards/BattleCardsApp.swift`](BattleCards/BattleCardsApp.swift) | App entry point with the two tabs |

## To try it

1. In Xcode, create an iOS App project (SwiftUI, iOS 16 or newer) named `BattleCards`.
2. Replace the generated Swift files with the ones in `BattleCards/`.
3. Add the card backs from
   [`legendary-cards-preview/public/img/cards`](../legendary-cards-preview/public/img/cards/) to
   the asset catalog as `card-back-classic`, `card-back-dark`, `card-back-indigo`,
   `card-back-metal` and `card-back-sakura`.

## What the app does not do

- It never asks for a seed phrase or private key and never signs anything. You type or paste an
  Ethereum address and it reads that profile.
- It doesn't buy, sell or list. Those happen on primatelegends.world, wallet to wallet.

The plan and the open questions are in
[docs/battle-cards-app-store.md](../../docs/battle-cards-app-store.md).
