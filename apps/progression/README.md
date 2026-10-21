# Progression

Player levels, XP, the Collector Boost and King of the Hill. Pure ES modules, no dependencies.

| File | What it holds |
| --- | --- |
| [`src/levels.js`](src/levels.js) | Level curve (180 + 100 × level per step, up to 300), `standing(xp)`, labels |
| [`src/xp.js`](src/xp.js) | XP table, daily caps, `scoreWallet`, `leaderboard` |
| [`src/boost.js`](src/boost.js) | Partner collections, display order, `checkWallet`, Friday snapshot reminder |
| [`src/kings.js`](src/kings.js) | King of the Hill: top wallets by 24h card volume |

```bash
node --test apps/progression/test/progression.test.js
```

Rules explained in [docs/progression.md](../../docs/progression.md).
