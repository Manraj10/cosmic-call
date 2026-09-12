# CROSSTALK

**Three of you can see what's going wrong. One of you has the only hands on the ship — and she can't hear a word you say.**

A 90-second, same-table party game for 4 phones. Like *Keep Talking and Nobody Explodes*, except the person holding the bomb is deaf.

<img alt="Crosstalk" src="public/art/hero-hab.webp" width="640" />

## The idea

Each of the four astronauts can perceive exactly one thing, and nobody else can see it:

| Astronaut | Sees | Can do |
|---|---|---|
| **Vega** | Cabin air % | **Every control on the ship** — but hears nothing, ever |
| **Rook** | Reactor power % | Talk, and press the signal pad |
| **Idris** | Dust-storm countdown | Talk, and press the signal pad |
| **Chen** | Alarm log (what just broke) | Talk, and press the signal pad |

Rook, Idris and Chen can shout across the table all they like. **Vega cannot hear any of it.** The only thing that reaches her is the shared **signal pad** — six icons, one 4-second cooldown between all three of them.

So the game is: diagnose out loud, then compress the answer into one icon before the air runs out.

Three emergencies hit in 90 seconds — a valve leak, a pump runaway, and a dust storm — and Vega can't perceive any of the three on her own. She can't even tell *which* valve is leaking. That's Chen's to know and Chen's to send.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43127**

## Play with real people

Only **one** machine runs the server. Everyone else joins it over the same Wi‑Fi.

1. One laptop: `npm run dev`
2. Find its LAN IP — macOS `ipconfig getifaddr en0`, Windows `ipconfig`, Linux `ip addr`
3. Everyone opens `http://THAT_IP:43127` on their phone
4. One person taps **open a hab**, reads the 4-letter code aloud, everyone else **climbs aboard**
5. Take seats, everyone marks ready, hab lead launches

Two `npm run dev` processes means two separate habs that can't see each other. Just one.

Allow the firewall prompt on first run. If device-to-device traffic is blocked (common on campus and hotel Wi‑Fi), tether everything to a phone hotspot.

Empty seats are covered by the sim, so you can test alone or with two.

### Three house rules

The software enforces most of the asymmetry — Vega's client is never sent audio, and the crew have no text input to her. These three are on you:

- **Vega silences her phone.** Earplugs or noise-cancelling headphones are better. Half-hearing the table ruins the round.
- Nobody hands Vega their phone.
- Everyone gets a turn as Vega.

## Voice

The ship talks. This works with no setup — it uses the browser's built-in speech engine, and Vega's phone is never sent a speech event in the first place.

For better audio (and the xAI sponsor angle), set a key **on the host machine only**:

```bash
XAI_API_KEY=xai-... npm run dev
```

The key stays server-side and is proxied through `/api/voice`, so it never ships to a phone. Check which path is live with `curl localhost:43128/api/health`. When Grok audio is used it gets a band-pass filter so it sounds like a suit radio.

## Layout

```
server/game.ts      the whole simulation — air, power, storm, the 3 emergencies
server/index.ts     socket plumbing + the voice proxy
shared/             types and copy, imported by both sides
src/roles/          one file per console
src/components/      SVG instruments: air gauge, storm scope, power cells
scripts/playtest.ts headless balance harness
```

## Playtest the balance

```bash
npx tsx scripts/playtest.ts
```

Simulates crews at different reaction speeds. It asserts the thing the design depends on: crews who relay survive, and crews who leave Vega alone always die.

```
sharp crew (1.0s lag)    won 8/8  air floor  58
normal crew (2.0s lag)   won 8/8  air floor  53
slow crew (3.5s lag)     won 8/8  air floor  27
nobody signals Vega      won 0/8  air floor   0
```
