# Bounties

Bounty bags come from 7-day daily-claim streaks and referral rewards. They sit in **My Collection › My bounties**,
and the wallet drawer shows "N Bounties ready to open" (plus a gold dot on the wallet button) until they're opened.

## Opening a Bounty

It opens like a pack, with one free signature. Inside:

- **1 scarce card, already revealed, with a front you don't own yet.** Tier odds: Rare 80%, Legendary 18%,
  Astral 2% (a Rare bag shows an Epic front). Cards in your vault, listed by you and locked by you in escrow count
  as owned. Only when you own every front of the tier with copies left do you get a second copy.
- **10,000 to 25,000 $RYO**, a random whole amount.

The bag is spent only when everything inside could be given: the card, the $RYO and the -1 Bounty move together.

## Code

Rules in [`apps/bounties`](../apps/bounties/): tier roll, $RYO roll, front picking and opening.
