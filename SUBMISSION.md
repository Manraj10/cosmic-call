# HackCMU 2026 — submission form answers

Paste-ready. Each block below is one form field. Form closes **4:00 PM, Saturday 12 September 2026**.

Track: **Multiplayer**.

---

## Project name

```
Cosmic Call
```

## Tagline

```
A 90-second co-op game where the only crew member who can touch the ship can't hear you, and an attacker is forging the orders that send her running.
```

## Repo

```
https://github.com/Manraj10/cosmic-call
```

---

## Track: Multiplayer (exactly 50 words)

```
Four players, one table. Three see what is breaking. The fourth holds every control, hears
nothing, and runs between rooms to use them. Her only channel is a signed order card,
and an attacker forges cards on it. The multiplayer is the channel between people, and
the round defends it.
```

---

## Project description

```
Cosmic Call is a ninety-second co-op game for up to four phones at one table. You are the
crew of Mars habitat HAB-7 in a dust storm, and three emergencies land before the clock
runs out.

Vega holds every control on the ship and sees one number, cabin air. She hears nothing.
Her controls are bolted to different modules, so she has to run to each one. Rook sees
the reactor, Idris the storm clock, Chen the alarm log. They diagnose out loud and send
her order cards.

Every card is signed with HMAC-SHA256. An adversary called GHOST forges cards, replays
real ones, then steals a crew key so its forgeries verify. The only evidence is a line
in the victim's own signing log, and they have to shout it. Chen sends a rotation card,
and Vega carries a hardware key token to the comms bay to rotate the key, because a key
cannot be rotated over the bus that is compromised.

The round ends in an incident report instead of a score. One seated player is enough to
start; the sim covers the empty seats.
```

---

## How we built it

```
Vite, React 19 and TypeScript on the phones; Node, Express and Socket.io on the host. One
authoritative server owns the habitat and sends each phone a different slice of it, so
the operator's client is never sent the fields she is not allowed to know. That is
enforced server-side, and scripts/asymmetry.ts asserts it. Mobile web with a PWA
manifest: players scan a QR code, with no install and no account.

HAB-7 is modelled as four modules on a spine. The server tracks where the operator is
standing, refuses any control used from the wrong module or from the corridor, and only
accepts a key rotation from the comms bay while she holds the token.

Every order is signed on the sending phone with HMAC-SHA256 over roundId|seat|signal|seq
and verified server-side against the full 256-bit tag with a constant-time compare.
crypto.subtle only exists in a secure context, and a phone on a plain-http LAN has none,
so we also wrote FIPS 180-4 SHA-256 and RFC 2104 HMAC by hand. A harness pins the two to
byte-identical output, because a phone signing differently from the server would look
exactly like the attacker.

Three harnesses gate the build: npm run asymmetry, npm run crypto, npm run playtest.
Mission Control's voice is ElevenLabs proxied server-side when a key is set, otherwise the
browser's own speech engine. The after-action radio line is written only after the engine
has graded the round, through a fallback chain: K2 Horizon, then Gemini, then Grok, then a
line written into the game.

The live build runs on the laptop behind a Cloudflare tunnel, because the server needs
long-lived WebSockets. A one-page how-to-play sits at /how.html.

Cosmic Call welds two earlier builds from this hackathon, both preserved in git: a
crosstalk game with a deaf operator and signed order cards, and a Mars habitat you walk
through room by room.
```

---

## What we're proud of

```
The cryptography is the mechanic. Forgery is a failed verification. Replay is a used
counter. Key theft is a leaked secret. Revocation is a rotation, and the game makes it
physical: somebody has to carry a hardware token across the habitat, because a key cannot
be rotated over the bus that is compromised.

The hardest thing to get right was the attack nobody can see. After the key theft a
forged order reads SEALED on the operator's glass, and nothing on her phone can tell her
otherwise. The only evidence in the game is one line in the victim's own signing log, and
the game will not let them send it to her. They have to open their mouth.

GHOST's first forgery is quiet on purpose. It wants her to seal the valve that isn't
leaking, which starves the air intake and runs her to the plant for nothing.

It needs no installs, no accounts and no API keys, and one person can start a round.
```

---

## Prize categories we are entering

```
Multiplayer track — the multiplayer is the channel between the players rather than a
lobby: three can perceive, one can act and has to run to do it, and the round is spent
defending the link between them.

Grand Prize — a party game whose core mechanic is real HMAC-SHA256 signing, replay
detection and physical key rotation, playable by strangers in ninety seconds with no
install.

Sandia Prize (Cybersecurity) — forgery, replay, credential theft and out-of-band
revocation are implemented rather than themed, and the round ends in an incident report
listing what GHOST forged and replayed, whose key it stole, time-to-revoke and false
revocations.

Best Design — consoles that each show one instrument, an order card that takes over the
operator's whole screen, and a seal badge that outweighs the order it sits on, so the
information asymmetry reads at arm's length in a loud room.

People's Favorite — ninety seconds, scan a QR code, and the round ends with an argument
about whose key was stolen and who should have read the seal.

Cursor Prize — a Cursor agent owns server/game.ts, the authoritative simulation server,
and wrote and iterated it alongside the rest of the team. Its early commits are authored
"Cursor Agent" in the history.

SpaceXAI: Make it Legendary — built with Cursor: a Cursor agent owns the authoritative
game server, server/game.ts.
```

### Conditional entries — check first, paste only what is live

Open `<live url>/api/health` right before submitting. A key existing is not proof: `directorLast`
names the model that actually wrote the most recent debrief line, so finish one round first.
Do not paste an entry whose check fails.

**IFM Prize (sponsor track)** — paste only if `directorLast` is `"K2 Horizon"`. The organizers
said IFM is a sponsor track we can enter alongside Multiplayer only if K2 Horizon is genuinely
used, so if the check fails, enter Multiplayer alone.

```
IFM Prize — after a round is graded, IFM's K2 Horizon reads the incident report and writes
Mission Control's after-action line. It runs after scoring, on a time budget, so a model
never decides a result and a slow reply costs a sentence rather than a round.
```

**MLH Best Use of Gemini API** — paste only if `directorLast` is `"Gemini"`.

```
MLH Best Use of Gemini API — Gemini writes Mission Control's after-action line from the
engine's incident report, after the round is graded, so the model narrates a result and
never decides one.
```

**MLH Best Use of ElevenLabs** — paste only if `voice` is `"elevenlabs"`.

```
MLH Best Use of ElevenLabs — Mission Control's voice is ElevenLabs proxied server-side, so
no key reaches a phone, and the operator is never sent a speech event at all: the voice is
part of the information asymmetry.
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

Areas to divide between you, so nothing goes unclaimed:

- simulation, walking and balance (`server/game.ts`, `shared/habitat.ts`, `scripts/playtest.ts`)
- the seal, the key registry and GHOST (`shared/seal.ts`, `server/ghost.ts`, `scripts/crypto.ts`)
- the consoles, the order card and Vega's hab map (`src/roles/`, `src/components/`)
- the Mission Control board (`src/roles/Board.tsx`, `src/components/MissionHabitat.tsx`)
- the information-asymmetry guarantee (`scripts/asymmetry.ts`)
- art, plates and the PWA shell (`public/`, `index.html`)
- voice, radio copy and sponsor integration (`server/index.ts`, `server/director.ts`)
- the two lineage builds that were welded together
- the pitch, the demo run and the incident-report copy
