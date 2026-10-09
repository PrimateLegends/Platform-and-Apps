# Market engine

Python implementation of the Pre-Market rules: the $RYO ledger, card offers, the airdrop rebalance
and the card references used by the activity feed. Pure functions and plain data classes, no I/O
and no dependencies, so the same rules can be checked, simulated and audited outside the live
service.

```
services/market-engine/
├── pyproject.toml
├── src/primate_market/
│   ├── ledger.py      fixed-supply $RYO ledger, atomic batches, launch snapshot
│   ├── offers.py      OfferBook: place, cancel, reject, accept, sweep
│   ├── airdrop.py     airdrop split (optional per-wallet cap) and the v1 rebalance
│   ├── activity.py    which card(s) each activity event shows
│   └── errors.py      error codes shared with the web client
└── tests/             unittest suites (no extra packages)
```

## Run the tests

```bash
npm run test:engine
# or, from this folder:
python -m unittest discover -s tests -t . -v
```

Python 3.10 or newer.

## Offers in one paragraph

Anyone can offer $RYO for any card that isn't theirs, the vault's or in escrow: from 1,000 to
10,000,000 $RYO, open for 1, 3, 7 or 30 days. The amount moves to the `offers` account at once, so
an accepted offer always settles. The holder of the card can accept (card to the bidder, $RYO to
the holder, any listing ends) or reject; the bidder can cancel; expired offers are refunded by the
sweep. The offer belongs to the card, so a new holder can accept it, and if the bidder ends up
holding the card the offer is voided and refunded. Freshly claimed cards can receive offers but
can only be sold 48 hours after the claim. Full rules: [docs/market-offers.md](../../docs/market-offers.md).

## Invariant

Every operation is a transfer between accounts, so `Ledger.total()` is always 1,000,000,000. The
tests check it after placing, replacing, refunding, accepting, expiring and rebalancing.
