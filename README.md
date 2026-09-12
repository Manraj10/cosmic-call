# CROSSTALK

**Three of you can see what's going wrong. One of you has the only hands on the ship — and she can't hear a word you say.**

A 90-second, same-table party game for 4 phones. Like *Keep Talking and Nobody Explodes*, except the person holding the bomb is deaf.

<img alt="Crosstalk" src="public/art/hero-hab.webp" width="640" />

## The idea

Each of the four astronauts can perceive exactly one thing, and nobody else can see it:

| Astronaut | Sees | Can send |
|---|---|---|
| **Vega** | Cabin air % | Nothing. She has **every control on the ship** and hears nothing, ever |
| **Rook** | Reactor power % | `PUMP OFF` · `PUMP ON` |
| **Idris** | Dust-storm countdown | `SHIELDS` · `BRACE` |
| **Chen** | Alarm log (what just broke) | `SEAL PORT` · `SEAL STBD` |

Rook, Idris and Chen can shout across the table all they like. **Vega cannot hear any of it.** The only thing that reaches her is the **signal pad** — and every icon on it is welded to exactly one console. Chen is the only person alive who can tell Vega which valve is bleeding. Rook is the only one who can call the pump. Idris is the only one who can call the storm. All three share one 4-second cooldown, so a wasted press is wasted for everybody.

So the game is: diagnose out loud, work out whose call it is, then compress it into one icon before the air runs out.

Three emergencies hit in 90 seconds — a valve leak, a pump runaway, and a dust storm — and Vega can't perceive any of them on her own. **There is one order that survives all three.** Any seat that goes quiet kills the hab: the harness in `scripts/playtest.ts` asserts it.

Vega's only way back is one bit — an **acknowledge** button that turns the sender's line green, so she can say "I saw it" and nothing more. Everything else she wants to say, she says out loud. The block on her is one-directional.

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
server/game.ts       the whole simulation — air, power, storm, the 3 emergencies
server/index.ts      socket plumbing + the voice proxy
shared/              types and copy, imported by both sides
src/roles/           one file per console
src/components/      SVG instruments: air gauge, storm scope, power cells
scripts/asymmetry.ts asserts Vega is cut off and each seat sees only its own thing
scripts/playtest.ts  headless balance harness
```

## Check it still works

```bash
npm run check
```

Typecheck, lint, then the two harnesses below. Worth running before you present.

### Is the asymmetry intact?

```bash
npm run asymmetry
```

Asserts the rule the whole game rests on: the ship's voice never routes to Vega, her view contains the air and nothing else, each crew member sees only their own readout, and a signal sent from the wrong console is refused. This is a correctness check, not a tuning one — if a field leaks into her view the game quietly becomes solitaire, and that has already happened once.

### Is the balance still right?

```bash
npm run playtest
```

Simulates crews at different reaction speeds, then silences each player in turn, then silences each individual call. It asserts the things the design depends on: relaying in the right order survives, no seat can be left empty, and no call is decoration.

```
=== the one path ===
all three, sharp (1.2s)        won 8/8   air floor  24
all three, normal (2.2s)       won 8/8   air floor  20
all three, slow (3.6s)         won 8/8   air floor  14
all three, sloppy (5.0s)       won 0/8   air floor   0
all three + Vega on her gauge  won 8/8   air floor  20

=== every seat is load-bearing ===
Rook silent (no pump calls)    won 0/8   air floor   0
Idris silent (no storm calls)  won 0/8   air floor  48
Chen silent (no valve calls)   won 0/8   air floor   0
nobody signals at all          won 0/8   air floor   0
Vega alone, playing her gauge  won 0/8   air floor   0

=== and so is every single call ===
brace never called             won 0/8   air floor   0
shields never called           won 0/8   air floor   0
pump-off never called          won 0/8   air floor   0
```

Two of those rows are the interesting ones. **Vega alone** is a Vega who ignores the pad and plays her air gauge as well as anyone could — she still dies every time, because two of the three emergencies are invisible to her. And **sloppy (5.0s)** is where the cliff is: a crew that dawdles by another second and a half over the slow crew goes from 8/8 to 0/8.

If you want to soften it for a demo, the dials that matter are `MISSION_SECONDS` in `shared/content.ts` and the starting air in `server/game.ts`. Lower starting air is *not* a difficulty knob — it drops the cabin below the overpressure ceiling and turns the pump runaway into free air, which inverts the whole design.
