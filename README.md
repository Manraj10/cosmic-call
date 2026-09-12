# Cosmic Call

**Four phones, one table, ninety seconds. The only person who can touch the ship cannot hear you, and something on the comms bus is writing orders in her name.**

Mars habitat HAB-7, caught in a dust storm. Three emergencies land in ninety seconds. No installs, no accounts: everyone opens a URL or scans the QR code in the lobby.

<img alt="Cosmic Call" src="public/art/hero-hab.webp" width="640" />

## The table

| Seat | Station | Can see | Can send |
|---|---|---|---|
| **VEGA** | Oxygen | Cabin air %, and nothing else | Nothing. Holds every physical control |
| **ROOK** | Power | Reactor power, bus draw | `PUMP OFF` · `PUMP ON` |
| **IDRIS** | Navigation | The dust-storm clock | `SHIELDS` · `BRACE` |
| **CHEN** | Communications | The alarm log — what actually broke | `SEAL PORT` · `SEAL STBD` · the key registry |

Vega holds the port valve, the starboard valve, the air pump, the dust shields and the brace. She is the only one who can move any of them. She receives no voice, no mission clock, no power reading, no storm clock and no alarm text. The server never sends her a speech event.

Her one inbound channel is an order card that slams her whole phone screen. Her one outbound channel is a single bit: an acknowledge that turns the sender's line green.

Rook, Idris and Chen can shout at each other across the table, and they have to. Nobody can see anyone else's screen. The ship never names what broke. Every order card is welded to exactly one console, so Chen is the only human alive who can tell Vega which valve is bleeding. All three crew share **one 4-second cooldown**, so a wasted press is wasted for everybody.

Three emergencies — a valve leak, a pump runaway, a dust storm — and the person with the hands can perceive none of them. Empty seats are covered by the sim, so the game runs with two players or one.

## The seal

Every order that reaches Vega's glass is signed by the console that sent it.

The signature is HMAC-SHA256 over a canonical line, `roundId|seat|signal|seq`, using a per-seat key issued at launch. The crew phone computes the tag before the order leaves. The server verifies it against the full 256-bit tag with a constant-time compare. Vega sees the first four hex characters as a badge on the card.

In plain terms: each console has a private stamp, and only that console can produce a stamp the ship will accept. If the stamp on a card is wrong, the card is not from the person it claims to be from.

Three badges:

| Badge | What happened | Should Vega obey it? |
|---|---|---|
| `SEALED` | Signature verified, counter moved forward | Yes |
| `BROKEN SEAL` | Signature did not verify. Somebody without the key wrote this | No |
| `OLD COUNTER` | Signature verified, but the counter was already used. A replay | No |

Doing what an unsealed card asked, while that card is still on the glass, costs air and is recorded. Nothing else in the round blames Vega for anything.

## GHOST

There is an adversary on the comms bus. It attacks in the order a real incident goes.

**1. Forgery, around t=26s.** GHOST writes order cards it is not entitled to write. The signature does not verify, so the card lands on Vega's glass reading `BROKEN SEAL`. GHOST does not queue behind the crew's shared cooldown, so it can flood her — the real order has to be dug out of the forgeries under time pressure. It does not pick at random either. It picks the order that hurts most right now: `PUMP ON` while the cabin is already over-pressure, which blows a seam; `PUMP OFF` while air is low; a `SEAL` on the valve that is *not* leaking, which starves the intake instead of the leak.

**2. Replay, around t=44s.** GHOST re-sends a real, genuinely signed order at a moment when it is the wrong call. The signature verifies, because it is a real signature. The monotonic counter is the only tell, so the card reads `OLD COUNTER`.

**3. Key theft, t=58s.** GHOST steals one crew seat's signing key. Never Chen's — somebody has to be able to fix this. From that point its forgeries from that seat verify, and Vega's glass calls them `SEALED`. She cannot tell. Nothing on her screen can tell her.

The only evidence anywhere in the game is one line in the victim's own signing log: an order signed under their key that they did not press. They cannot send that fact to Vega, because she cannot receive. They have to say it out loud, to whoever is sitting at comms. Chen then rotates that seat's key from the key registry, which throws GHOST off the bus.

Rotating a seat that was actually clean voids that console's in-flight tag and costs the table a call. So revocation is not a button you mash. It is a call you make on somebody's word.

## The incident report

The round does not end in a score. It ends in a report: orders delivered, how many GHOST forged, how many replays, how many unsealed orders were obeyed, which seat's key was stolen, time-to-revoke in seconds, false revocations, and a grade line.

```
CLEAN — nothing GHOST wrote ever moved the ship
HELD — every order you executed was a real one
BREACHED 2 TIMES — the glass was being driven by GHOST
```

That report is the thing people argue about afterwards.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43127**

## Play with real people on phones

Exactly **one** machine runs the server. Everyone else joins it over the same Wi-Fi.

1. One laptop runs `npm run dev`.
2. Find that laptop's LAN IP. Windows `ipconfig`, macOS `ipconfig getifaddr en0`, Linux `ip addr`.
3. Everyone opens `http://THAT_IP:43127` on their phone, or scans the QR code in the lobby.
4. One person opens a hab and reads the four-letter code aloud. Everyone else climbs aboard.
5. Claim seats, mark ready, hab lead launches.

Two `npm run dev` processes means two separate habs that cannot see each other. Run one.

Allow the firewall prompt on first launch. If device-to-device traffic is blocked, which is normal on campus and hotel Wi-Fi, tether every phone to one phone hotspot.

## Three house rules

The software enforces the channel. Vega's client is never sent the fields she must not know, and the crew have no text input to her. These three are on you:

- **Watch the glass, not the table.** The official order is the card, even when you can hear people shouting the answer.
- **Nobody hands Vega their phone.**
- **Everyone gets a turn as Vega.** This is the point of the design, not a courtesy.

## Harnesses

```bash
npm run check
```

Typecheck, lint, then the three harnesses below. Run it before you present.

```bash
npm run asymmetry
```

Asserts the rule the whole game rests on: Vega is cut off, each seat sees only its own readout, and an order sent from the wrong console is refused. This is a correctness check, not a tuning one. If a field leaks into her view, the game quietly becomes solitaire, and that has already happened once.

```bash
npm run crypto
```

Asserts forged tags are rejected, replayed counters are rejected, a rotated key invalidates old tags, and the two HMAC paths produce byte-identical output.

```bash
npm run playtest
```

Headless balance harness. It silences each player in turn, then each individual call in turn, and asserts that no seat can be left empty and no call is decoration.

## Voice

Mission Control speaks. The server proxies ElevenLabs text-to-speech, falls back to xAI/Grok, and falls back again to the browser's own speech engine — so the game works with zero keys and no setup.

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
XAI_API_KEY=...
```

Keys live on the host machine and are never shipped to a phone. Check which path is live:

```bash
curl localhost:43128/api/health
```

Vega is never sent a speech event at all, so the voice path is not what protects her. `hearsSpeech()` is.

## How this is built

Vite + React 19 + TypeScript on the phones. Node + Express + Socket.io on the host. One authoritative server owns one hab state, and each phone renders a different slice of it. Mobile web with a PWA manifest, no installs.

```
server/game.ts        the simulation — air, power, storm, the three emergencies
server/ghost.ts       the key registry, the replay window, and GHOST
shared/seal.ts        the signing primitive and both HMAC paths
shared/               types and copy, imported by both sides
src/roles/            one file per console
src/components/Seal.tsx  the seal badge, signing log and key registry UI
scripts/              the three harnesses
```

**Two HMAC implementations, on purpose.** `crypto.subtle` only exists in a secure context. Phones join this game by pointing a camera at `http://192.168.x.x:43127` on venue Wi-Fi, which is not a secure context, so `crypto.subtle` is `undefined` on every real player device. Serving HTTPS would put a certificate warning between a judge and the game. So the code uses the platform primitive where it exists — the server always has it — and falls back to a hand-written FIPS 180-4 SHA-256 plus RFC 2104 HMAC where it does not. `npm run crypto` pins the two together, because a phone signing differently from the server would not fail loudly. It would look exactly like GHOST.

**The asymmetry is server-side.** Vega's client is never *sent* the fields she must not know. It is not hidden in CSS. `scripts/asymmetry.ts` asserts it.

### What the seal is, honestly

The signing key is a symmetric, server-issued secret — the same shape as an HS256 token. This is not end-to-end secrecy, and nothing here is confidential from the server. The property it buys is **integrity**: the hab can tell an order a crew member actually pressed from one GHOST wrote on the bus. That is the property the game is about.

## Lineage

Cosmic Call is two earlier builds from this window combined into one. `lineage/habitat` preserves the Mars-habitat build as it stood, with `lineage/habitat-local` as its local snapshot. `main` is the combined game.
