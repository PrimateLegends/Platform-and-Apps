# Card reveal

Rules that turn sealed Legendary Cards into revealed ones. Pure JavaScript, no dependencies.

- `src/fronts.js`: the card fronts (PL number, tier, type it matches, clans of the primates drawn on it, name).
- `src/reveal.js`: `pick` (best front for one card), `claimReveal` (35% of new claims), `planReveal` (a whole
  batch up to a target share, strict on hints, never re-rolls).
- `src/clans.js`: clan of a front from the fur colour of its primates (`furFamily`, `clansFromFur`).

```js
import { planReveal } from './src/reveal.js';
const { plan, stats } = planReveal(cards, { pct: 0.8, rnd: seededRandom });
```

Every function takes an optional random source, so batches can be reproduced and tested. Rules in
[docs/card-reveal.md](../../docs/card-reveal.md).
