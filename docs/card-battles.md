# Primate Legends: Card Battles

**Status: in development.** The rules below are the current design and will change as the
game is tested. The rules engine lives in [`apps/card-battles`](../apps/card-battles/).

Card Battles is a two-player strategy card game set on the Wiko archipelago. Your Legendary
Cards become your deck, your Primates lead it, and every ranked match earns Honor that is
recorded on-chain at the end of each season.

## The basics

| | |
| --- | --- |
| Goal | Bring the enemy **Shrine** from 20 health to 0 |
| Deck | 40 cards, at most 3 copies of a card, up to 2 clans |
| Opening hand | 4 cards, plus 1 draw every round |
| Board | Up to 6 warriors per side |
| Match length | Up to 40 rounds; after that the healthier Shrine wins |

## Rounds and Ki

Every round both players gain **1 max Ki** (up to 10), refill it and draw a card.
Players take turns playing cards or passing. When both pass in a row, the round ends.

Up to **3 unspent Ki** carries over as **Focus Ki**, which can only pay for techniques. Saving
Ki one round lets you answer harder the next.

## Attacking

One player holds the **attack token** each round, and it switches every round.

1. The attacker sends warriors into combat, one lane each.
2. The defender assigns blockers, one per lane.
3. Each lane resolves: warriors strike each other at the same time, unless one has Quick Blade.
4. Unblocked attackers hit the enemy Shrine.

## Card kinds

| Kind | What it does |
| --- | --- |
| **Warrior** | A Primate on the board with power and health |
| **Technique** | A one-shot move. Its speed decides when you can play it |
| **Relic** | Equips a warrior with a permanent bonus |
| **Zone** | A place on the Wiko map that stays in play and triggers every round |

### Technique speeds

| Speed | When |
| --- | --- |
| **Burst** | Anytime, resolves instantly, and you keep the turn |
| **Swift** | Anytime, including in the middle of combat |
| **Focus** | Only outside combat |

## Card types and keywords

Every card has a type (the same one shown as a hint on your sealed cards). On warriors, the
type is a keyword:

| Type | Keyword | Effect |
| --- | --- | --- |
| Attack | **Quick Blade** | Strikes first in combat |
| Defense | **Iron Skin** | Takes 1 less damage from every hit |
| Evasion | **Shadowstep** | Can only be blocked by other Shadowstep warriors |
| Healing | **Mend** | Heals your Shrine by 1 when it survives combat |

## Heroes

Some warriors carry a **Hero condition** (for example, "you have played 6 allies" or "attack
twice"). When it is met, the warrior levels up into its Hero form with higher stats.
Holders can also burn Dojo Books to turn a Primate Legend into a Hero outside of matches.

## Scoring and Honor

**Match score** (result screen):

| | Points |
| --- | --- |
| Win / draw / loss | 100 / 40 / 10 |
| Shrine damage dealt | +2 per point |
| Enemy warriors defeated | +5 each |
| Flawless win (Shrine still at 20) | +25 |

**Honor** is the ranked rating (Elo-style, starting at 1,000). It moves with every ranked match:
beating a stronger player pays more than beating a weaker one.

## On-chain Honor

Matches are played off-chain for speed. Every match is **deterministic**: it is seeded, and the
server can replay it from its list of actions to check the result before counting it.

At the end of each season:

1. The server builds a Merkle tree of every player's final Honor and publishes the full list.
2. It commits the root to the [`HonorLedger`](../contracts/HonorLedger.sol) contract.
3. Each player claims their season Honor into a permanent on-chain balance with a Merkle proof.

Nobody, including the team, can change a season once it is committed. The contract is a draft
and is not deployed yet.
