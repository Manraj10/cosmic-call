# Cosmic Call — agent notes

**Product name is Cosmic Call** (not AIRGAP). Repo is `Manraj10/cosmic-call` (renamed 12 Sep).

Cursor agent + Claude may both edit this repo. Prefer small diffs on `main`. Do not fight over branding — use **Cosmic Call** / `cosmic-call` everywhere user-facing.

## What this is

Four-phone co-op: Vega has the hands and is airgapped; crew signs orders; GHOST forges/replays/steals keys. Combined from the habitat + crosstalk builds.

## Don't break

- Asymmetry harness (`npm run asymmetry`) — Vega must never receive forbidden fields
- Crypto harness (`npm run crypto`) — HMAC seals must stay byte-stable
- Demo path in `PITCH.md` — 90s round, QR join, no installs
