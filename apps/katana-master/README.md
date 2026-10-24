# Katana Master

The public rules of Katana Master, the sword-duel game of Primate Legends: the frozen rule table, damage and Ki,
the once-per-match card ledger, the input guard, the three bot levels and the **referee** that replays a duel's
input log to the result that counts. No dependencies, ES modules, `node:test`.

![Main menu](screenshots/main-menu.png)

| File | What it holds |
| --- | --- |
| [`src/rules.js`](src/rules.js) | Every number of a duel, deep-frozen, in integer units (HP in hundredths, Ki in tenths) |
| [`src/combat.js`](src/combat.js) | Cut damage (x1.25 per combo hit up to the 5th), Ki with a banked x1.3 gain, teleport chain and rest, PERFECT blocks |
| [`src/cards.js`](src/cards.js) | Loadout checks (5 at most, no duplicates) and the match-long card ledger with Last Breath's own trigger |
| [`src/input-guard.js`](src/input-guard.js) | Drops script events and turbo repeats; flags machine rate and rhythm |
| [`src/difficulty.js`](src/difficulty.js) | Easy / Normal / Hard and the Hard bot's card plan |
| [`src/duel.js`](src/duel.js) | The deterministic referee: `replay({ log, cards, catalog })` and `logFromTimelines` |
| [`src/rng.js`](src/rng.js) | Seeded SFC32 with 32-bit state, identical in Python |

The Python referee in [`services/duel-referee`](../../services/duel-referee/) replays the same fixtures
([`test/fixtures/duels.json`](test/fixtures/duels.json)) and must reach the same hashes. After a rules change:

```bash
node apps/katana-master/scripts/make-fixtures.mjs
node --test apps/katana-master/test/katana-master.test.js
python -m unittest discover -s services/duel-referee/tests -t services/duel-referee
```

Game guide and screenshots: [docs/katana-master.md](../../docs/katana-master.md).

<p>
  <img src="screenshots/shadow-kick.png" alt="Shadow Kick" width="430">
  <img src="screenshots/final-round-storm.png" alt="The final round" width="430">
</p>
