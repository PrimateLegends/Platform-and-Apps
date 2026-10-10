# Card Battles · rules engine

**Status: in development (rules v1).**

The rules of [Primate Legends: Card Battles](../../docs/card-battles.md) as a pure,
deterministic state machine. The same engine runs in the client to preview moves and on the
server, which replays every ranked match before its result counts.

```js
import { createMatch, apply } from './src/engine.js';

let match = createMatch({ seed: 42, decks: [deckA, deckB] });
match = apply(match, { type: 'play', player: 0, handIndex: 0 });
match = apply(match, { type: 'attack', player: 0, attackers: [1] });
match = apply(match, { type: 'block', player: 1, blocks: { 0: 4 } });
const stake = settleStake(match);   // when it ends: the 20 cards the winner takes
```

| File | |
| --- | --- |
| `src/cards.js` | Card kinds, keywords, speeds, clan accents, stat budget, deck rules, Starter scrolls and a starter set from the real catalog |
| `src/engine.js` | Rounds, KI and spare KI, the attack token, CHALLENGE, combat keywords, equipment, ASCEND, win conditions and the half-deck stake |
| `src/scoring.js` | Match score and Honor (ranked rating) |
| `src/rng.js` | Seeded RNG so matches can be replayed |
| `test/` | Rules tests (`npm test`) |
