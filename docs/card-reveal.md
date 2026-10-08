# Card reveal

Legendary Cards start sealed: each one shows a rarity, a hinted card type (Attack, Defense, Evasion, Healing)
and a list of possible clans. Reveals give a sealed card one of the card fronts. Rules in `apps/reveal`
(pure modules, `npm test`).

## Rules
- **The hint never lies.** A card only gets a front of its hinted type. If no front of that type has room,
  the card stays sealed until the next batch of art.
- **Tiers.** Common and uncommon cards show Common or Rare fronts (each prefers its own tier), rare cards show
  Epic fronts, legendary and phantom cards show Legendary fronts.
- **Copies.** Each Common or Rare front can appear up to 12 times, each Epic or Legendary front up to 2 times.
  The picker spreads copies, so new fronts are used first.
- **Clans.** The clan of a revealed card is the colour of the primates drawn on it, not the clan printed in
  its text: brown and dark brown are Earth, skyblue is Crimson, light is Sakura or Ember, zombies can be any
  clan but Prism or Phantom. A card with primates of two clans counts for both; items, tactics and places
  count for none. The picker prefers fronts of the card's top hinted clan.
- **Batches never re-roll.** A revealed card keeps its front forever; a new batch only reveals sealed cards.
- **Claims.** A newly claimed card comes already revealed 35% of the time.

## Batches so far
| Batch | Revealed | Notes |
| --- | --- | --- |
| 1 | 80% of all cards | 118 fronts (PL-001..118) |
| 2 | 83.8% | +30 clan variants (PL-119..148): every common Attack/Defense card in up to 4 clans |

Batch 2 aimed at 87% but stayed strict: the cards still sealed mostly hint Evasion or Healing, so the next
art batches focus on those types and on Epic fronts.

## On the site
Revealed cards show their front everywhere (Market, My Collection, Cards, Swap, wallet drawer). Opening a
card spins it twice in one second with the back on the other face; there is no hover animation, to keep
grids light. The Market clan filter and search (card number, `PL-049`, or card name) use the revealed front.
