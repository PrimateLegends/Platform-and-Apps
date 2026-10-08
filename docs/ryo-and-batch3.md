# $RYO, the $RYO Pre-Market and WL Batch 3

Rules in `apps/ryo` (pure modules, `npm test`).

## $RYO (off-chain until launch)
- Fixed supply: **1,000,000,000**. While off-chain, 100,000 $RYO = 0.01 ETH.
- Genesis: 60% vault (market maker), 20% team rewards, 10% one-time airdrop, 10% reserved for the launch pool.
- The airdrop went half equally to early holders and half pro rata to the cards they held.
- Balances are usable across the site and move on-chain at the launch in November.

## Pre-Market
- Listings are in **$RYO only** for now (ETH and USDC are paused). Minimum listing: 1,000 $RYO.
- Every list, price change, delist, buy and vault sale is confirmed with a free wallet signature.
- The vault buys any card at **80%** of its estimated value, up to **3 times per wallet every 7 days**, so
  every card has a floor while most trades stay between players.

## Claims
- The Early Primates claim (303 cards) is sold out.
- The **daily claim** keeps going: one new sealed card per wallet every 24 hours, random rarity and clan.
- 7 days in a row adds a **Bounty** or a **Dojo Book**.

## WL Batch 3: farm $RYO on X
- Get a claim code (20 uses), share it on X tagging @PrimateLegends and send the post link: your wallet joins
  the Batch 3 whitelist queue.
- Every use of your code pays you **400 $RYO** (raised x4 to reward the early code owners).
- A new wallet that redeems a code gets **1 sealed card + 50 $RYO**, and 50 more after the team review.
- Share links `/c/<code>` show a preview image with the code and open the Pre-Market with the code filled in.

## Rewards and pacing (v0.10.0)
- **Loyalty reward:** every registered wallet got **1,500 $RYO**, and wallets with 3+ free claims got **3,000 more**,
  each with a "Loyalty reward" notice in the wallet drawer. Paid from the team share in resumable batches that
  skip wallets already paid, so nobody is paid twice (`loyaltyBatch` in `apps/ryo/src/rewards.js`).
- **Captcha pacing:** the first 3 market actions in 5 minutes need no captcha; after that one solved captcha covers
  the next 4 actions (`captchaStep`).
- **Team listings** seeded from the vault can use a fixed price band (e.g. 3,000-8,000), rounded to 50 (`bandPrice`).
- **Escrow liquidity:** the team can mint new revealed cards straight into the swap escrow, mostly commons, so
  players who already hold cards have more to swap for.
- **Mint:** basically free for card holders. Anyone who mints a Primate while already holding cards gets a $RYO
  allocation closely pegged to what they spent at mint.
