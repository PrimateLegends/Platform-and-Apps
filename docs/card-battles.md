# Primate Legends: Battle Cards

**Status: in development (rules v1).** The rules engine lives in [`apps/card-battles`](../apps/card-battles/),
the card catalog and its balance checks in [`services/card-balance`](../services/card-balance/), and the match
stakes contract in [`contracts/BattleStakes.sol`](../contracts/BattleStakes.sol).

Battle Cards is a two-player strategy card game set on the Wiko archipelago. Your Legendary Cards become your
deck, your Primates lead it, and the winner of a match takes half of the loser's deck.

**Design goal: no useless decks.** Cards come from random reveals and packs, so whatever someone owns, their
deck has a plan, answers and a way to win — and no deck is so strong or so stalling that the other side can't play.
Rarity never decides games: Legendary cards are more interesting, not much stronger.

## The match

| | |
| --- | --- |
| Goal | Bring the enemy from **20 points** to 0 |
| KI | 1 KI crystal on round 1, +1 per round (max 10), refilled every round |
| Spare KI | Up to 3 unspent KI is saved and can only pay for **tactics** |
| Attack token | One player may attack each round; the token alternates |
| Board | Up to 6 cards in play per side (warriors, locations and in-play items share the slots) |
| Damage | Stays on a warrior until it is healed (REGENERATE heals fully at every round end) |
| Match length | Up to 40 rounds; after that the player with more points wins |
| Stake | The winner takes **half of the loser's deck** (20 cards, picked from the match seed) |
| On-chain | **One transaction per player per match**; every card play inside the match is instant |

### Combat

1. The token holder sends warriors to attack. Warriors with **CHALLENGE** choose which enemy blocks them.
2. The defender assigns blockers, one per attacker, respecting **SHADOW** and **INTIMIDATE**.
3. Each pair strikes at the same time — **FIRST STRIKE** hits first, **TWIN STRIKE** hits first and again.
4. Unblocked attackers hit the enemy points.

## Card types

| Type on the card | What it is | Stats |
| --- | --- | --- |
| **Attack / Defense / Evasion / Technique** | Warriors. The word is the warrior's style: Attack hits harder than it lasts, Defense lasts longer than it hits, Evasion slips past blockers, Technique supports with abilities | ATK / DEF |
| **Tactic** | A one-shot action with a speed: **Instant** (no answer, you keep the action), **Swift** (can be played in combat, the rival may answer), **Ritual** (outside combat only, for the big effects) | — |
| **Equipment** | Weapons and armor. Equip to a warrior; returns to your hand if that warrior falls. Once per round | the bonus |
| **Item** | Food, charms, scrolls. Attach to a warrior, or keep in play | the bonus or — |
| **Location** | Places of the archipelago. Ongoing effects or a COUNTDOWN | — |

## Keywords

| Keyword | Meaning |
| --- | --- |
| FIRST STRIKE | While attacking, strikes before its blocker |
| TWIN STRIKE | While attacking, strikes before and together with its blocker |
| SHADOW | Can only be blocked by SHADOW or SHARPEYE warriors |
| SHARPEYE | Can block SHADOW warriors |
| INTIMIDATE | Can only be blocked by warriors with 3+ ATK |
| BREAKTHROUGH | Excess damage to its blocker hits the enemy points |
| CHALLENGE | Chooses which enemy blocks it |
| DODGE | Negates the next damage it would take this round |
| IRON SKIN | Takes 1 less damage from every source |
| SPELL WARD | Negates the next enemy tactic or skill that targets it |
| LIFESTEAL | Damage it deals heals your points |
| REGENERATE | Heals fully at the end of each round |
| BLOODLUST | When it defeats a warrior, it gets +1/+1 |
| DEATH POEM | Effect when it falls |
| MIRAGE | Falls when it strikes or when the round ends |
| SUPPORT | When it attacks, the ally to its right gets its bonus |
| RAID | Bonus if you damaged the enemy points this round |
| COUNTDOWN N | Counts down each round start; at 0 the effect happens |
| ASCEND | Legendary warriors level up when their condition is met (stats + a new effect) |
| STUN · RETREAT · CHILL · SEAL · IMPRISON | Out of combat this round · back to hand · ATK 0 this round · loses text and keywords · removed until the imprisoner falls |

## Stat budget

Total ATK + DEF a warrior should have for its KI cost:

| KI | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ATK + DEF | 3 | 4 | 5 | 6–7 | 8 | 9 | 11 | 12–13 | 14–15 |

A plain keyword is free, a strong effect costs 1–2 points, a drawback gives 1–2 back. Legendary cards may sit 1
above. Exclusive collab cards sit 3–4 above but cost 8–9 KI and a deck can hold only one. Hard removal costs 5+ KI;
cheap damage tops out at 2 for 2 KI. The catalog checks run on every card in CI.

## Decks

| Rule | |
| --- | --- |
| Size | 40 cards |
| Copies | At most 3 of a card (1 for Exclusives) |
| Clans | At most 2 clans, plus any number of shared cards (Neutral, Armory, Wiko) |
| Legendary | At most 6 (Exclusives count as Legendary) |
| Starter scrolls | Collections short of 40 cards are filled with free basic warriors, so every player can play |

## Clans

Every clan has cards of every kind, but each one stands out at its accent:

| Accent | Clans |
| --- | --- |
| **Evasion** | Phantom (Hollow Emperor) · Void (Alchemist) |
| **Attack & burst** | Prism (Grandmaster) · Golden (Sensei) · Crimson (Ronin) |
| **Defense + escapes** | Earth (Disciple) · Onyx (Recruit) |
| **Healing + attack** | Sakura (Windwalker) · Ember (Warmaster) |

## Scoring and Honor

**Match score** (result screen):

| | Points |
| --- | --- |
| Win / draw / loss | 100 / 40 / 10 |
| Damage dealt to the enemy points | +2 per point |
| Enemy warriors defeated | +5 each |
| Flawless win (still at 20 points) | +25 |

**Honor** is the ranked rating (Elo-style, starting at 1,000). Beating a stronger player pays more.

## On-chain

Matches are played off-chain for speed. Every match is **deterministic**: it is seeded, and the server replays it
from its list of actions before signing the result.

- **Stakes** ([`BattleStakes`](../contracts/BattleStakes.sol)): each player enters a match with one transaction that
  commits to their deck. When the match ends, anyone can submit the referee-signed result; the contract checks the
  stake is exactly half of the loser's committed deck and moves those cards to the winner. Draws move nothing.
- **Honor** ([`HonorLedger`](../contracts/HonorLedger.sol)): at the end of each season the server commits a Merkle root
  of every player's Honor; players claim it into a permanent on-chain balance.

Both contracts are drafts and are not deployed yet.
