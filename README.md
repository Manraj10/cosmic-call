# Cosmic Call

**Four seats, one table, ninety seconds. The only person who can touch the ship cannot hear you, has to run to every control, and something on the comms bus is forging the orders she gets.**

Mars habitat HAB-7, caught in a dust storm. Three emergencies land in ninety seconds. No installs, no accounts: everyone opens a URL or scans the QR code in the lobby.

You do not need four phones. One seated player is enough to launch, because the sim covers every empty seat. A judge with one phone can play it.

<img alt="Cosmic Call" src="public/art/hero-hab.webp" width="640" />

Repo: https://github.com/Manraj10/cosmic-call

## The table

| Seat | Role id | Can see | Can send |
|---|---|---|---|
| **VEGA** | `vega` | Cabin air %, and nothing else | A one-bit acknowledge. Holds every physical control |
| **ROOK** | `engineer` | Reactor power, bus draw | `PUMP OFF` · `PUMP ON` |
| **IDRIS** | `pilot` | The dust-storm clock | `SHIELDS` · `BRACE` |
| **CHEN** | `sparks` | The alarm log: what actually broke | `SEAL PORT` · `SEAL STBD` · `ROTATE ROOK` · `ROTATE IDRIS` · `ROTATE CHEN` |

Vega holds the port valve, the starboard valve, the air pump, the dust shields, the brace and the key registry. She is the only one who can move any of them. She receives no voice, no mission clock, no power reading, no storm clock and no alarm text. The server never sends her a speech event.

Her one inbound channel is an order card that slams her whole phone screen. Her one outbound channel is a single bit: an acknowledge that turns the sender's line green.

Rook, Idris and Chen can shout at each other across the table, and they have to. Nobody can see anyone else's screen. The ship never names what broke. Every order card is welded to exactly one console, so Chen is the only person who can tell Vega which valve is bleeding. All three crew share **one 4-second cooldown**, so a wasted press is wasted for everybody.

**Short crew.** On a table of two or three, one console covers several seats and carries all of their cards, so every system still has someone on it. A seat nobody claimed at all is run by the sim.

## HAB-7 is a place

The controls are bolted to different parts of the hab, and Vega has to walk to them.

```
            PLANT
              |
   LOCK --- SPINE --- COMMS
```

| Module | What is bolted there |
|---|---|
| **Spine** | The corridor. The hardware key token starts here |
| **Air Plant** | Both valves and the air pump |
| **Airlock** | The dust shields |
| **Comms Bay** | The key registry |

Everything is one hop from the spine and two hops from anything else. A hop takes 1.4 seconds. A control only works in the module it lives in, and every control is dead while she is in the corridor. `BRACE` is the exception: she can grab hold of something anywhere.

The crew do not move. They are eyes on instruments and she is the only pair of hands aboard. Letting them walk would hand them each other's readouts.

So an order is somewhere to go. A `SEAL PORT` card that finds her in the airlock is a 2.8-second run before she can touch the valve, and the air keeps moving while she runs.

### The key token

Rotating a compromised signing key takes the hardware token. Vega has to pick it up, carry it to the comms bay, and be standing there holding it. The registry refuses anything else.

That rule is the security story in one line: a signing key cannot be rotated over the bus that is compromised. If a console could revoke a key by sending an order, the attacker on the bus could send that order too. Somebody has to physically carry the token.

Chen does not rotate keys. Chen sends a rotation card, and Vega runs it.

## The seal

Every order that reaches Vega's glass is signed by the console that sent it.

The signature is HMAC-SHA256 over a canonical line, `roundId|seat|signal|seq`, using a per-seat key issued at launch. The crew phone computes the tag before the order leaves. The server verifies the full 256-bit tag with a constant-time compare. Vega sees the first four hex characters as a badge on the card.

In plain terms: each console has a private stamp, and only that console can produce a stamp the ship accepts. If the stamp on a card is wrong, the card is not from the person it claims to be from. The counter inside the stamp only goes up, so the same stamp arriving twice means someone recorded it and played it back.

| Badge | What happened | Should Vega obey it? |
|---|---|---|
| `SEALED` | Signature verified, counter moved forward | Yes |
| `BROKEN SEAL` | Signature did not verify. Somebody without the key wrote this | No |
| `OLD COUNTER` | Signature verified, but the counter was already used. A replay | No |

Every card prints `RUN TO <module>` and lights that module on her map, whatever its seal. Hiding the route on forged cards would let her skip the badge and just check whether a route is printed, and it would remove the thing the round tests: a clear, urgent instruction she has to refuse.

## GHOST

There is an adversary on the comms bus. It attacks in the order a real incident goes.

**1. Forgery, from t=26 to 29s.** GHOST writes order cards it is not entitled to write. The signature does not verify, so they land reading `BROKEN SEAL`. GHOST does not queue behind the crew's shared cooldown, so the real order has to be dug out from under the forgeries. It picks the card that hurts most right now, by rules over the live state: `PUMP ON` while air is already high and the pump is off; `PUMP OFF` while air is low; a `SEAL` on the valve that is *not* leaking, which sends her to the plant to starve the intake. It never sends the order that happens to be correct. The first forgery lands during the pump runaway, with her air somewhere around 50 to 57. It wants her to seal the valve that isn't leaking.

**2. Replay, t=44 to 48s.** GHOST sends a real order from one of us, played back, at a moment when it is the wrong call. The signature verifies, because it is a real signature. The used counter is the only tell, so the card reads `OLD COUNTER`.

**3. Key theft, t=58s.** GHOST steals one crew seat's signing key, always from a seat someone is sitting in. From then on its forgeries from that seat verify, and Vega's glass calls them `SEALED`. Nothing on her screen can tell her otherwise.

The only evidence anywhere in the game is one line in the victim's own signing log: an order signed under their key, marked `NOT YOU`. They cannot send that to Vega, because she cannot receive. They have to say it out loud, to whoever is at comms. Chen sends the rotation card. Vega grabs the token from the spine and runs it to the comms bay while the hab keeps failing around her.

Rotating a clean seat voids that console's in-flight tag and costs the table a call. Rotation is a call you make on somebody's word, and then a run somebody makes on yours.

## The incident report

The round ends in an incident report instead of a score.

| Field | Meaning |
|---|---|
| `delivered` | Orders that reached Vega's glass |
| `forged` | How many GHOST wrote |
| `replays` | How many real orders it played back |
| `stolenFrom` | Whose key GHOST took |
| `timeToRevoke` | Seconds from the theft to the rotation, or never |
| `falseRevokes` | Clean keys rotated on a wrong call |

It closes on a grade line.

### Why a report

Two reasons, and neither is oversold.

Vega's constraint models a real one. Playing her is the closest most people get to being the person in the room who everyone assumes just heard that. That is why the seats rotate.

And the report measures what a security team drills: time to detect a compromised credential and what a false revocation cost. Cosmic Call is not a training product and there is no research behind it. It is a drill people will play willingly, and the report is the thing they argue about afterwards.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43127**. The UI is on 43127; the ship server is on 43128 behind the Vite proxy.

**With one device:** open a hab, take a seat, mark ready, launch. The sim runs the other three. Each browser tab is its own player, so two tabs on one laptop make a two-seat crew.

To host it somewhere other than your own laptop, see [DEPLOY.md](DEPLOY.md).

## Play with real people on phones

Exactly **one** machine runs the server. Everyone else joins it.

**The plan: a public Cloudflare tunnel.** The laptop runs a production build and a Cloudflare quick tunnel in front of it, and every phone opens the tunnel's public `https://` URL or scans the QR code in the lobby. No shared network needed. The runbook is in [LEADER.md](LEADER.md) under "Demo topology". The URL changes whenever the tunnel restarts, so reprint the QR if it does. The one-page rules live at `/how.html` on the same URL.

1. Everyone opens the tunnel URL on their phone, or scans the QR code in the lobby.
2. One person opens a hab and reads the four-letter code aloud. Everyone else climbs aboard.
3. Claim seats, tap **i am ready**, and the hab lead launches. After a rematch every seat taps **i am ready** again.

**Fallback only: LAN or hotspot.** If the tunnel is down, run the server on one laptop, find its LAN IP (Windows `ipconfig`, macOS `ipconfig getifaddr en0`, Linux `ip addr`), and have everyone open `http://THAT_IP:43127` under `npm run dev`. Allow the firewall prompt on first launch. Campus and hotel Wi-Fi usually block device-to-device traffic, so put every phone and the laptop on one phone's hotspot. Two `npm run dev` processes means two separate habs that cannot see each other. Run one.

The **hab monitor** seat is a spectator screen with every number on it, including where Vega is standing. Put it on a projector for an audience, facing away from the players.

## Three house rules

The software enforces the channel. Vega's client is never sent the fields she must not know, and the crew have no text input to her. These three are on you:

- **Watch the glass, not the table.** The official order is the card, even when you can hear people shouting the answer.
- **Nobody hands Vega their phone.**
- **Everyone gets a turn as Vega.** The design depends on it.

## Harnesses

```bash
npm run check
```

Typecheck, lint, then the three harnesses below. Run it before you present.

```bash
npm run asymmetry
```

The rule the whole game rests on, as assertions. The ship never sends audio to Vega, the spectator board or an unseated player. Vega's view carries the air, her controls and her position, and no clock, power, draw, storm, alarm text, cooldown or signing key. Each crew seat sees its own instrument and nobody else's. The ship's spoken lines never name the valve, the pump, the shields or a countdown. An order correctly signed by the wrong console is refused, and so is an unsigned one. Rotation is physical: no crew console can rotate a key, Vega cannot rotate without the token in the comms bay, and the valves refuse her outside the air plant.

This is a correctness check, not a tuning one. A leaked field turns the game into solitaire without anything looking broken, and that has already happened once.

```bash
npm run crypto
```

The signing layer. The hand-written HMAC matches RFC 4231 test case 2 and agrees with WebCrypto byte for byte on 40 random keys. A forged tag reads `broken` and a replayed counter reads `stale`: two different refusals, because Vega is shown which one it was. A tag signed as one seat does not verify as another. A rotation invalidates older tags, and rotating a clean seat counts as a false revocation. After a theft GHOST's forgeries verify, the only tell is in the victim's own log, and rotating the stolen key puts GHOST back to broken seals. The badge is four uppercase hex characters, and the comparison uses the full tag.

```bash
npm run playtest
```

Headless balance harness, no sockets or browser. The simulated operator acts only on her glass and her own gauge, walks module to module, and carries the token to rotate. It asserts that a crew running the right sequence survives, that silencing any one seated player loses the round, and that skipping any one individual call loses it too. No seat is spare and no call is decoration.

Two more run by hand and are not part of `check`:

```bash
npx tsx scripts/realtime.ts http://127.0.0.1:43128
```

Needs `npm run dev` running. Five real Socket.io clients (four seats and the board) create a hab over the wire. Only the host can launch. Vega's view carries no clock, power, key, alarms or spectator data, and she starts in the spine. Then: a crew console cannot walk, a bad tag is refused and a good one lands sealed, the board never receives a signing key, controls lock in transit, and a reconnecting player keeps their seat and position.

```bash
npx tsx --tsconfig tsconfig.app.json scripts/telemetry.ts
```

The board's drawing of Vega's position follows the spine on a two-hop walk and does not overshoot or run backwards when a network packet arrives late or early.

## Voice and the radio

Mission Control speaks, and both paths end in something that needs no key. The game plays the same with nothing configured.

**Voice** (the ship's spoken lines): ElevenLabs, proxied through the server, when `ELEVENLABS_API_KEY` is set. Otherwise the browser's own speech engine.

**Radio copy** (the after-action line on the debrief) is a fallback chain: K2 Horizon → Gemini → Grok → a line written into the game. Each provider is tried only if the one before it has no key or fails.

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...     # optional
IFM_API_KEY=...             # K2 Horizon, radio copy
GEMINI_API_KEY=...          # radio copy
XAI_API_KEY=...             # Grok, radio copy
```

Keys live on the host machine and are never shipped to a phone. Every radio-copy call runs on a time budget: 9 seconds for K2 Horizon, which is a reasoning model, and 2.5 seconds for the others. Check which path is live, and which provider wrote the last line (`directorLast`):

```bash
curl <url>/api/health
```

The model is handed the incident report after the engine has already graded the round. It describes a result and never decides one.

Vega is never sent a speech event at all, so the voice path is not what protects her. `hearsSpeech()` in `shared/types.ts` is.

## How this is built

Vite + React 19 + TypeScript on the phones. Node + Express + Socket.io on the host. One authoritative server owns one hab state, and each phone is sent a different slice of it. Mobile web with a PWA manifest, no installs.

```
shared/types.ts        what each seat is sent, and what it is allowed to do
shared/content.ts      the seats, the cards, which console owns each card and where it sends her
shared/habitat.ts      the four modules, the hops, where each control is bolted, the token
shared/seal.ts         the signing primitive and both HMAC paths
server/game.ts         the simulation: air, power, storm, walking, the token, the emergencies
server/ghost.ts        the key registry, the replay window, GHOST and the incident report
server/director.ts     the radio copy chain
server/index.ts        sockets, the voice proxy, /api/health
src/roles/             one file per console, plus the Mission Control board
src/components/        the order card, the seal badge and signing log, Vega's hab map
scripts/               the three harnesses
```

**Two HMAC implementations, on purpose.** `crypto.subtle` only exists in a secure context. A phone that joins over the tunnel's `https://` URL has it. A phone that joins a LAN address like `http://192.168.x.x:43127` does not, and serving HTTPS on the LAN would put a certificate warning between a judge and the game. So the code uses the platform primitive where it exists, which on the server is always, and falls back to a hand-written FIPS 180-4 SHA-256 plus RFC 2104 HMAC where it does not. `npm run crypto` pins the two together, because a phone signing differently from the server would not fail loudly. It would look exactly like GHOST.

**The asymmetry is server-side.** Vega's client is never *sent* the fields she must not know. Nothing is hidden in CSS, and `scripts/asymmetry.ts` asserts it.

**So is the walk.** The server refuses a control action from the wrong module or from the corridor. The map on her phone only draws that state.

### What the seal is, honestly

The signing key is a symmetric, server-issued secret, the same shape as an HS256 token. Nothing here is confidential from the server, and none of it is end-to-end encryption. The property it buys is **integrity**: the hab can tell an order a crew member actually pressed from one GHOST wrote on the bus. That is the property the game is about.

The token rule is a server rule too: the registry refuses a rotation unless Vega is in the comms bay holding the token. The reason behind it holds outside the game. Recovery from a compromised channel has to happen outside that channel.

## Lineage

Cosmic Call is two builds from this hackathon welded together. Both are preserved in git.

**The crosstalk build** is the early history of `main`. From it: the deaf operator and three crew who can talk; one instrument per crew seat; orders as pictures that slam her glass; the one-bit acknowledge; cards welded to one console behind a shared cooldown; the server-side asymmetry and its harness; the balance harness. The seal, GHOST and the incident report were added on that same line.

**The habitat build** is on the `lineage/habitat-local` branch. From it: the habitat as a map of modules you walk between; consoles that only work in the room you stand in; carrying a single object; the spectator habitat monitor; merged roles so a short crew still runs every system; and a model writing Mission Control's radio lines after the engine has graded, with a written fallback.

Welding them changed both. In the habitat build everyone walked. Here only Vega does, because a crew member who can walk can read someone else's instrument. The object you carry became the key token, which is what gives the security layer a body.
