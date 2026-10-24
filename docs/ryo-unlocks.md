# $RYO unlock calendar

$RYO moves freely inside the site. For selling and sending, the token unlocks in daily tranches from
**2026-11-08 (UTC)**:

| Unlock day | Tranche per wallet |
| --- | --- |
| 1 | 2,000,000 $RYO |
| 2 | 2,800,000 $RYO |
| 3 | 3,920,000 $RYO |
| 4 | 5,488,000 $RYO |
| ... | +40% every day, compounding |

- A tranche is the **most** $RYO a wallet can sell or transfer from that date. A bar that isn't full on /swap-ryo
  doesn't mean tokens stay locked: it means the wallet holds less than the tranche allows.
- Everyone sees the same 3 upcoming tranches; passed days drop off. Whatever a balance holds above them sits in a
  **To be unlocked** row that moves up as tranches are freed.

Code: [`apps/ryo/src/unlocks.js`](../apps/ryo/src/unlocks.js) (JavaScript) and
[`primate_market.unlocks`](../services/market-engine/src/primate_market/unlocks.py) (Python), with the same integer
steps.
