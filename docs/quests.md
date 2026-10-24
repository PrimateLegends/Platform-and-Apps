# $RYO quests

| # | Quest | Reward | Status |
| --- | --- | --- | --- |
| 1 | Quote a post | 10,000 $RYO a week | Paused: no spots left |
| 2 | Tag 1 friend | 10,000 $RYO a week | Paused: no spots left |
| 3 | Follow the game account | 7,000 $RYO, 100 spots | Open |
| 4 | Clan cashback: your first card of 2 new clans | 90% of the price back, up to 20,000 $RYO | Open |
| 5 | **Onyx Recruiting** | 1 free card, revealed | Open |

A paused quest stays on the board with its reason and takes no new claims; claims made before the pause still pay.

## New accounts

Quests 4 and 5 count purchases from **48 hours after a wallet's first activity** on the site: its first sign-in,
$RYO movement, market sale or listing, card transfer, claimed card or pack, whichever came first. Purchases made
inside those 48 hours never count. The quest page and the market show "New account · opens in Xh" meanwhile.

## Quest 4: Clan cashback

- After at least 2 card purchases, your first listing bought from one of your 2 quest clans pays part of the price
  back right away. Accepted offers don't count.
- The payout is 90% of the price, never more than 90% of the card's estimated value, and **never more than
  20,000 $RYO**. Once per wallet, never resets.

## Quest 5: Onyx Recruiting

- Buy **3 different Onyx cards** on the market. Bought listings and accepted offers both count.
- A card counts when Onyx is among its clans. Buying a card back never fills a second slot.
- The quest page shows the 3 slots; the market shows "1 card left to complete Quest 5 Onyx Recruiting" as you go.
- The purchase that fills the third slot drops **1 free card, already revealed**, rolled with the Recruit Pack odds.
- Once per wallet, never resets.

Rules in [`apps/quests`](../apps/quests/).

## Quest 6: Show your rarest card

- Post your rarest card on X from the account linked to your wallet, with both lines of the quest text:
  "this is my rarest @primatelegends card rn" and "Don't sleep on these, don't fade the legends" (case, curly
  quotes and spacing don't matter).
- Every claim is reviewed by a person (bots and farmers are around). Approved posts get a random **clan pack**
  (Onyx, Earth or Sakura). Once per wallet.

## Quest 7: Send a card to a friend

- Enter your friend's wallet and X handle. One **random card** of yours (any rarity, only cards free to move:
  not listed, not in escrow, past their holds) goes to them right away, with no transfer fee.
- Your **Recruit Pack** arrives after 24 hours, or **12 hours** if you post on X tagging your friend and
  @PrimateLegends. The post must still be up when the pack is paid; otherwise it waits the full 24 hours.
- Each friend can receive only once: the same wallet or the same X account never counts twice. You can't send
  to yourself, and an X handle linked to another wallet doesn't count for this friend.
- New accounts wait 48 hours, as for quests 4 and 5. Once per wallet.

Rules for both in [`apps/quests`](../apps/quests/).

## Quest 8: Reinforce your deck

- The quest names one clan for you: of the clans that have a card for sale right now, the one you hold the fewest
  cards of (your vault, your listings and cards in escrow all count). A tie goes to the clan with more cards on
  sale, so the target is always easy to buy into.
- Buy any card that carries that clan, from a listing or with an accepted offer, and **1 card of that clan, already
  revealed**, drops into your vault (Recruit Pack odds). Once per wallet; new accounts wait 48 hours.
- The market opens filtered on your clan from the quest row, and a pop-up tells you when it's done.

## Your X account

- Set the X handle shown on your profile from the quests page: `@Name`, `Name` or an x.com / twitter.com link all
  work. A handle set by hand is shown as **Not verified yet** and doesn't count for the follow quest.
- You can change it again after 72 hours. A handle already linked to another wallet stays with that wallet, and
  only the team wallet can set @PrimateLegends.

## Closed quests

Quest 3 (follow) and Quest 6 (rarest card) ran out of spots and are closed. Claims made before stay paid.

Rules in [`apps/quests/src/deck-and-handle.js`](../apps/quests/src/deck-and-handle.js).
