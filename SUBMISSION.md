# HackCMU 2026 — submission form answers

Paste-ready. Each block below is one form field. Form closes **4:00 PM, Saturday 12 September 2026**.

Track: **Multiplayer**.

---

## Project name

```
AIRGAP
```

## Tagline

```
A 90-second co-op game for four phones where the only person who can touch the ship can't hear you, and an attacker is forging her orders.
```

## Repo

```
https://github.com/Manraj10/airgap
```

---

## Track: Multiplayer (~50 words)

```
Four phones at one table. Three players see what is breaking. The fourth holds every
control and hears nothing they say. Her only channel is an order card, and an attacker
is forging cards on it. The multiplayer is a channel between humans, and the round is
spent defending it.
```

---

## Project description

```
AIRGAP is a ninety-second co-op game for four phones at one table. You are the crew of
Mars habitat HAB-7 in a dust storm. Three emergencies land in ninety seconds: a valve
leak, a pump runaway, and the storm front itself.

Vega holds every physical control on the ship and can see one number, cabin air. She
gets no voice, no clock, no alarm text. Her only inbound channel is an order card that
slams her phone; her only reply is a single bit.

Rook sees the reactor. Idris sees the storm clock. Chen sees the alarm log. Nobody can
see anyone else's screen and the ship never names what broke, so they have to diagnose
out loud and work out whose card it is.

Every order is signed by the console that sent it: HMAC-SHA256, per-seat keys, a
monotonic counter. An adversary called GHOST forges cards, replays real ones, and at
t=58s steals a crew key so its forgeries start verifying. From then on the only
evidence anywhere is a line in the victim's own signing log, and they have to shout it
across the table. The round ends in an incident report, not a score.
```

---

## How we built it

```
Vite, React 19 and TypeScript on the phones; Node, Express and Socket.io on the host.
One authoritative server owns one habitat state and sends each phone a different slice
of it, so the operator's client is never sent the fields she is not allowed to know —
it is not hidden in CSS, and scripts/asymmetry.ts asserts it. Mobile web with a PWA
manifest, so players join by scanning a QR code with no install and no account.

Every order is signed on the sending phone with HMAC-SHA256 over roundId|seat|signal|seq
and verified server-side against the full 256-bit tag with a constant-time compare. That
needed two HMAC implementations: crypto.subtle only exists in a secure context, and
phones join over plain http on venue Wi-Fi, so the code uses the platform primitive where
it exists and a hand-written FIPS 180-4 SHA-256 plus RFC 2104 HMAC where it does not. A
harness pins the two to byte-identical output, because a phone signing differently from
the server would not fail loudly — it would look exactly like the attacker.

Three harnesses gate the build: npm run asymmetry, npm run crypto, npm run playtest.
Mission Control's voice is ElevenLabs, proxied server-side, falling back to xAI/Grok and
then to the browser's own speech engine, so it talks with zero keys configured.
```

---

## What we're proud of

```
The layer nobody expects in a party game: the cryptography is the mechanic, not a theme.
Forgery is a failed verification. Replay is a used counter. Key theft is a leaked secret.
Revocation is a rotation, and rotating a clean seat costs the table a call, so it has to
be made on somebody's word.

The hardest thing to get right was the one attack you cannot see. After the key theft,
a forged order reads SEALED on the operator's glass and there is nothing on her phone
that could tell her otherwise. The only evidence in the entire game is one line in the
victim's own signing log, and the game will not let them send it to her. They have to
open their mouth. Building a channel and then making its failure the point of the round
is the part we would show first.

We are also proud that it needs no installs, no accounts and no keys to run, and that it
plays with one person as well as four.
```

---

## Prize categories we are entering

```
Multiplayer track — four phones at one table, and the multiplayer is the channel between
the players rather than a lobby: three can perceive, one can act, and the round is spent
defending the link between them.

Grand Prize — a party game that runs real HMAC-SHA256 signing, replay detection and key
rotation as its core mechanic, playable by four strangers in ninety seconds with no
install.

Sandia Prize (Cybersecurity) — forgery, replay, credential theft and revocation are
implemented rather than themed, and the round ends in an incident report measuring
time-to-revoke, whether anyone acted on an unauthenticated instruction, and the cost of
a false revocation.

Best Design — four consoles that each show one instrument and nothing else, plus an order
card that takes over the operator's whole screen, so the information asymmetry is legible
at arm's length in a loud room.

People's Favorite — ninety seconds, scan a QR code, and the round ends with an argument
about who obeyed the forged order.

MLH Best Use of ElevenLabs — Mission Control's voice is ElevenLabs proxied server-side
with graceful fallback to xAI and the browser engine, and the operator is never sent a
speech event at all, which makes the voice part of the asymmetry rather than decoration.
```

---

## What each member contributed

Fill these in before you submit. The form asks for code, design and ideation per person.

```
[NAME] — code: [ ] · design: [ ] · ideation: [ ]

[NAME] — code: [ ] · design: [ ] · ideation: [ ]

[NAME] — code: [ ] · design: [ ] · ideation: [ ]

[NAME] — code: [ ] · design: [ ] · ideation: [ ]
```

Suggested areas to divide between you, so nothing goes unclaimed:

- simulation and balance (`server/game.ts`, `scripts/playtest.ts`)
- the seal, the key registry and GHOST (`shared/seal.ts`, `server/ghost.ts`, `scripts/crypto.ts`)
- the four consoles and the order card (`src/roles/`, `src/components/`)
- the information-asymmetry guarantee (`scripts/asymmetry.ts`)
- art, plates and the PWA shell (`public/`, `index.html`)
- voice pipeline and sponsor integration (`server/index.ts`, `/api/voice`)
- the pitch, the demo run and the incident-report copy
