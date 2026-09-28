# Security

If you find a security issue in the website or the card vault, please report it
privately with a direct message to [@primatelegends](https://x.com/primatelegends)
instead of opening a public issue.

Include the page, the steps to reproduce it, and what an attacker could do with
it. We reply to every report.

## How the site handles wallets

- The site never asks for a seed phrase or a private key.
- Connecting a wallet only reads your address.
- Signing in to the card vault, pledging a clan and claiming cards use free
  `personal_sign` messages. No transaction is sent and no gas is spent.
- Every signed message states what it is for, the wallet and the time it was
  issued. The backend recovers the signer and rejects old or replayed signatures.
