# OpenClaw skill

**Status: experimental**

[OpenClaw](https://openclaw.ai/) is an open-source AI assistant that runs on
your own machine. Its skills are Markdown files that teach the agent a task.

The `primate-legends` skill lets the agent check a wallet's Legendary Cards
vault: sealed cards by rarity, packs to open, Bounties, clan and the daily
claim streak. It is read-only. It never signs messages or sends transactions.

## Install

Copy the `primate-legends` folder into your OpenClaw skills directory, then ask
the agent something like:

> How many cards does 0x1234…abcd have in Primate Legends, and is my free card
> ready?

See the [OpenClaw skills docs](https://docs.openclaw.ai/tools/skills) for where
the skills directory lives on your system.
