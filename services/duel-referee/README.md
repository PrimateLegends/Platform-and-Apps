# Duel referee (Python)

Server-side referee for [Katana Master](../../docs/katana-master.md). It replays both players' input logs tick by
tick and returns the result that counts: winner, rounds and a 32-bit replay hash. Clients send inputs, never
results.

It is a separate implementation of [`apps/katana-master/src/duel.js`](../../apps/katana-master/src/duel.js), with
integer arithmetic only, so both land on the same hash for the same log. The tests replay the shared fixtures in
`apps/katana-master/test/fixtures/duels.json`.

```python
from duel_referee import replay

result = replay(log, cards=(["prism-spark"], []), catalog={"prism-spark": {"ki": 6, "atk": 8, "df": 2}})
result["winner"], result["rounds"], result["hash"]
```

```bash
python -m unittest discover -s services/duel-referee/tests -t services/duel-referee
```

Python 3.10 or newer, no dependencies.
