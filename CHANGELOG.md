# Changelog

All notable changes to this repository. Versions follow the live site's milestones.

## 0.14.0

### Added
- **Card transfers** (`docs/transfers.md`): send up to 20 cards to any wallet for 5 $RYO per card (to the vault).
  Wallets that never signed in still receive them (the page warns; cards and notice wait for the first sign-in).
  Listed, escrowed and on-hold cards can't move; more than 7 transfers in 2 minutes asks for a security check.
  New `/transfer` page: preview, transaction and inventory list, and your own activity (transfers and purchases).
  Recipients get a "Card received" notice; transfers show in the activity feed.
- `apps/transfers`: fee, holds, burst check, recipient notice, wallet activity. 6 tests.
- `services/market-engine`: `primate_market.transfers` (`Courier`): cards and fee move together or not at all. 4 tests.
- `contracts/CardCourier.sol`: external transfers after migration, up to 20 Legendary Cards per transaction with a
  flat $RYO fee per card; holds nothing, no owner. EVM test.
- **Bounties open** (`docs/bounties.md`): 1 scarce revealed card you don't own yet (Rare 80 / Legendary 18 / Astral 2)
  plus 10,000 to 25,000 $RYO, with the pack-opening animation. Wallet drawer notice for unopened Bounties.
  `apps/bounties`, 4 tests.
- **Quest 5 Onyx Recruiting** (`docs/quests.md`): 3 different Onyx cards bought (listings or accepted offers) give
  1 free revealed card, once per wallet. `apps/quests`, 3 tests.

### Changed
- Quests 1 and 2 are paused: no spots left. Claims made before the pause still pay.
## 0.13.0

### Added
- **$RYO swap** (`docs/ryo-swap.md`): $RYO against ETH (Ethereum mainnet) and USDC (Solana), both ways, open to
  holders of at least 2 Primate Legends warriors. $30,000 starting market cap (1,000,000,000 supply, $0.00003),
  constant-product pool, slippage and minimum received, price impact.
- `contracts/RyoSwapPool.sol`: holder-only constant-product $RYO/ETH pool. Opening price set by the seed,
  liquidity added at the current ratio and never removed (no LP tokens, no withdraw), swaps with minimum output
  and deadline, no fee, no owner. EVM tests.
- `contracts/LiquidityVault.sol`: secondary vault whose ETH deposits count as pool liquidity. Counts deposits,
  not the balance, so ETH moved on to the pool or bridged to Solana keeps counting; change returned inside its
  own forward is not a deposit. EVM tests.
- `contracts/PrimatesGate.sol`: the shared holder rule (`balanceOf` read live, `NotEnoughPrimates(held, needed)`).
- **Market Holders tab** (`docs/market-holders.md`): wallets ranked by cards held, 50 per page, X handle, wallet
  always shortened, Primates held (`None` when zero), 4-card preview, estimated value, and holder profiles behind
  an opaque id (the full wallet never reaches the page).
- `services/market-engine`: `primate_market.holders` (ranking, profile id, preview) and `primate_market.swap`
  (quotes, holder rule, deposit counting). 8 new `unittest` tests.

### Changed
- Market tabs: Vault and Players removed, Holders added after Activity.
- Market filters and the open card are kept in the address, so a refresh or a shared link opens the same view.
- A new offer shows up in the card's offers right away, without reloading the page.
- The top bar Swap button opens a menu: Swap Cards or Swap $RYO.

## 0.12.1

### Changed
- The card game is now called **Battle Card Legends** (was Battle Cards). Docs, contracts, the iOS draft and the
  card-balance package use the new name. Folder names and code identifiers stay the same so existing links keep working.

## 0.12.0

### Added
- **Battle Cards rules v1** (`docs/card-battles.md`): 20 points, KI with spare KI for tactics, warrior styles
  (Attack / Defense / Evasion / Technique), tactic speeds (Instant / Swift / Ritual), equipment, items and locations,
  a fixed keyword vocabulary, the KI stat budget, deck rules (2 clans, 6 Legendary, 1 Exclusive), Starter scrolls,
  clan accents and the half-deck stake.
- `services/card-balance`: Python package with the full card catalog (PL-001 … PL-205) and its balance checks
  (stat budget, vocabulary, clan accents, a curve for every clan). 13 `unittest` tests.
- `contracts/BattleStakes.sol`: one transaction per player per match (deck commitment); the referee-signed result
  moves half of the loser's deck to the winner. EVM tests.
- 50 new cards (PL-156 … PL-205): 18 object cards (equipment, items, tactics, locations) and 32 warriors across all
  nine clans.

### Changed
- `apps/card-battles` engine rewritten for rules v1: CHALLENGE, SHADOW / SHARPEYE, INTIMIDATE, FIRST and TWIN STRIKE,
  BREAKTHROUGH, DODGE, IRON SKIN, SPELL WARD, LIFESTEAL, REGENERATE, BLOODLUST, MIRAGE, equipment returning to hand,
  ASCEND and `settleStake`. 17 rules tests.
- Card balance pass: stats brought onto the budget and every card text rewritten with the keyword vocabulary.
- Exclusive collab cards cost 8–9 KI and keep stats above every regular card.

## 0.11.0

### Added
- `services/market-engine`: Python package with the $RYO ledger, the card offer book, the airdrop
  split with a per-wallet cap and the v1 rebalance, and the activity feed card references.
  16 `unittest` tests, no dependencies.
- `contracts/OfferBook.sol`: $RYO offers on Legendary Cards held in escrow, one-transaction accept,
  permissionless reclaim after expiry. EVM tests.
- `contracts/RyoToken.sol`: fixed-supply $RYO ERC-20 (1,000,000,000, no mint, no owner). EVM tests.
- `docs/market-offers.md`: every card visible, offers, activity feed, airdrop rebalance.
- GitHub Actions CI: Node (contracts, tests, repository checks) and Python 3.10 / 3.12.

### Changed
- Repository checks also scan Python, Solidity, TOML and Swift files.

## 0.10.0
- Card reveal rules, clan variants, loyalty reward and 400 $RYO claim codes.

## 0.9.0
- $RYO rules, $RYO-only Pre-Market, daily claim streak and WL Batch 3 claim codes.

## 0.8.0
- Whitelist batch pause, Battle Cards iOS draft and App Store prospect.

## 0.7.0
- Pre-Market rules, LegendaryCards and PreMarketSettlement drafts, EVM tests.
