# Market holders

The Pre-Market has a **Holders** tab, like the holders view of NFT marketplaces: every wallet that holds
cards, ranked by cards held, 50 rows at a time.

| Column | Meaning |
| --- | --- |
| # | Rank by cards held; ties go to the higher estimated value |
| Holder | X handle when the wallet linked one, and the wallet **always shortened** (`0x1234…abcd`) |
| Cards | Cards held. A listed card counts for its seller, a card in escrow for whoever locked it |
| % Owned | Share of all cards held by wallets |
| Primates held | Primate Legends warriors in the wallet (ERC-721 `balanceOf`), `None` when zero |
| Items | Up to 4 of the most valuable cards, then `… +N` |
| Est. value | Estimated value of the cards plus the wallet's $RYO (balance and $RYO locked in open offers) |

Team wallets are not listed.

## Profiles

**View profile** opens the market filtered to that holder's cards, with a header showing the rank, cards,
Primates held, $RYO and estimated value. The link carries an **opaque profile id**, never the wallet:

```
id = first 12 hex characters of sha256("pl-holder:" + wallet)
```

Full wallet addresses are never sent to the page, not in the list, not in a profile.

## Shareable market links

Filters and the open card live in the address, so a refresh or a shared link opens the same view:

```
/market?who=unlisted&rarity=rare,legendary&clan=…&min=…&max=…&q=…&sort=high&card=1234
/market?holder=<profile id>
```

The ranking rules are implemented in Python in
[`services/market-engine`](../services/market-engine/) (`primate_market.holders`) with unit tests.
