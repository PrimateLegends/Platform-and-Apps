# Changelog

All notable changes to this repository. Versions follow the live site's milestones.

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
