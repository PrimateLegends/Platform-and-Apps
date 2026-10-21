# Levels, XP, Collector Boost and King of the Hill

## Levels

Every player has a level from 1 to 300. Each step costs 100 XP more than the one before:

| Step | XP for the step | Total XP |
| --- | --- | --- |
| 1 → 2 | 280 | 280 |
| 2 → 3 | 380 | 660 |
| 3 → 4 | 480 | 1,140 |
| … | 180 + 100 × level | (n − 1)(50n + 180) |
| 17 → 18 | 1,880 | 18,360 |
| 299 → 300 | 30,080 | 4,538,820 |

The first 18 levels match a League of Legends match; unlike LoL there is no stop at 18.

The wallet panel shows the level as a round badge on the player's avatar and the XP as a violet bar under it. The
public profile and the Holders list show it too.

## XP

XP is never stored: it is recomputed from everything a wallet did on the site, every time. Changing the table
re-scores every player over their full history, so the players who were there first keep the credit for it.

| Activity | XP |
| --- | --- |
| Daily free card | 30 |
| 7-day claim streak | 100 |
| Pack opened | 25 |
| Bounty opened | 50 |
| Card bought | 50 + 1 per 1,000 $RYO (max +100) |
| Card sold | 40 + 1 per 1,000 $RYO (max +100) |
| Card sold to the vault | 20 |
| Card listed | 10 (5 a day) |
| Offer placed | 10 (5 a day) |
| Escrow swap | 40 |
| Card transfer | 10 (3 a day) |
| Quest completed | 150 |
| Whitelist application | 50 |
| Referral code fully used | 150 |
| Claim code redeemed | 30 |
| Solana wallet linked | 50 (once) |

Buys and sells share one budget of 10 scoring trades per day. Days are UTC. Team wallets never rank.

## Collector Boost

Holding an NFT from a partner collection adds a share of your **earned** XP, once per collection:

| Collection | Boost |
| --- | --- |
| Normies | +50% |
| Argonauts, Nakamigos, Good Vibes Club, Invisible Friends, Non Playable Character, Mutant Ape Yacht Club, Frontonauts | +25% each |

- Nothing happens on its own: the player presses "Check my wallet" and the collections are read on-chain at that
  moment. Waiting for more XP (or more collections) means a bigger boost.
- The base is earned XP only, so claiming collections one at a time or all together gives the same total.
- A collection held with 0 XP earned records nothing: the boost stays available.
- Snapshots are taken every Friday at 12:00 AM UTC.
- On-chain draft of the claim record: [`CollectorBoost.sol`](../contracts/CollectorBoost.sol).

## King of the Hill

The market shows the 3 wallets with the most card volume of the last 24 hours. Every sale counts for both sides at
its full $RYO price (listings bought and accepted offers); listings and cancels never count. Names open the
player's profile.

Rules in [`apps/progression`](../apps/progression/) and
[`primate_market.progression`](../services/market-engine/src/primate_market/progression.py).
