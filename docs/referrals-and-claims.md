# Referral quest and free-claim supply

This page describes the rules behind two features of primatelegends.world. The preview app
implements them as small, pure modules with tests:

- `apps/legendary-cards-preview/src/lib/referral-quest.js`
- `apps/legendary-cards-preview/src/lib/claim-supply.js`
- tests: `apps/legendary-cards-preview/test/quest-and-supply.test.js`

The live site runs the same rules on its own backend, with signed wallet sessions and bot checks.

## Whitelist by referral

Public whitelist applications are closed. Every application needs a referral code (`PL-XXXXXX`).

| Rule | Value |
| --- | --- |
| Who can open a code | any connected wallet |
| Uses per code | 3 (the owner may use one on itself) |
| Owner reward when all uses are spent | 1 Bounty and double whitelist chances |
| Max Bounties from the quest | 2 per wallet (a new code opens after one completes) |
| Applicant reward | 1 Bounty and 1 sealed card, once the team approves the wallet |
| Same network as the code's creator | blocked for other people's applications |
| Applications per network | 1 per day |

Everyone stays pending until the team approves wallets. Approval never pays twice, and using your
own code gives no applicant reward.

Codes are shared with a post template on X and a banner with the code stamped in a corner. On phones
the share sheet attaches the image automatically; the whitelist link also carries a large preview card.

## Free claim supply

The free daily claim hands out a limited stock of cards (303 at launch).

1. **Hold**: claiming rolls a card and holds it for the wallet. Asking again returns the same card,
   so leaving the reveal never re-rolls it.
2. **Keep**: accepting saves the card and spends the day's claim.

Held cards count against the stock, so the total never goes over the cap, even with many players
claiming at the same moment. A hold nobody accepts within 24 hours goes back to the pool.
