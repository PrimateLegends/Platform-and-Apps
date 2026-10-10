# Changelog

All notable changes to this repository. Versions follow the live site's milestones.

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
