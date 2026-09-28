---
name: primate-legends
description: Check a Primate Legends wallet - sealed Legendary Cards, unopened packs, Bounties and the daily free claim (streak and when the next card is ready). Use when the user asks about their Primate Legends cards, streak or daily claim.
---

# Primate Legends vault (read-only)

Primate Legends is a pixel-art NFT project on Ethereum. Holders collect sealed
Legendary Cards on https://primatelegends.world before the mint. This skill
reads a wallet's vault. It never signs anything and never sends transactions.

## Inputs

- `address`: an Ethereum address (`0x` + 40 hex characters). Ask the user for
  it if you don't have it. Never ask for a seed phrase or private key.

## Endpoints

Public, read-only, GET only:

1. `GET https://primatelegends.world/api/wallet?address=<address>`
   - `cards`: `{ sealed, packs, recent }`
   - `claim`: `{ open, opensAt, streak, lost, lastAt, nextAt, streakDays }`
   - `bounties`, `ryo`, `dojoBooks`
2. `GET https://primatelegends.world/api/vault?address=<address>` (full list)
   - `cards`: `{ no, rarity, back, source, at, hints: { type, clans } }`
   - `packs`: unopened packs `{ id, pack, source }`

## How to answer

- Cards are sealed: don't reveal or guess rarities. You can share the hints
  (card type and the possible clans with their odds).
- Daily claim:
  - `claim.open` is false: claims open at `claim.opensAt` (show it in UTC).
  - `nextAt` is in the past or empty: "Your free card is ready" and link to
    https://primatelegends.world/LegendaryCards#claim
  - otherwise: time left until `nextAt`, and the current `streak`.
  - A streak only counts if `lastAt` is less than 48 hours ago. Every 7th day
    in a row also gives a Bounty.
- Unopened packs: remind the user they can open them on the Cards page.
- Link to the full collection: https://primatelegends.world/my-collection

## Example

> **User:** how's my primate legends vault? 0xabc…
>
> **Agent:** You have 12 sealed cards and 1 Recruit Pack to open, plus 1 Bounty.
> You're on a 6-day streak and your next free card is ready now. Claim it today
> to get your Bounty for day 7.
