# Split: you + your friend, two laptops

Stop treating this as one person building the whole game. The ship already simulates. What is left is **two stations each**, plus glass.

## Tonight: play together in 5 minutes

On **one** laptop (doesn’t matter whose):

```bash
git pull
npm install
npm run dev
```

That process binds **43127** (UI) and **43128** (Socket.io).

On the **other** laptop (and phones), same Wi‑Fi, open:

```
http://HOST_LAN_IP:43127
```

Do **not** start a second `npm run dev` if you just want to play — you would get a second empty hab. Join the code on the host’s URL.

## While coding: never touch each other’s files

Push often. Pull before you start. If you need a shared type changed, ping the other person first.

### Track A — Xiao — HAB BUS

**You own the ship and the two stations that cannot see/hear the world normally.**

| Path | What to do |
|---|---|
| `server/game.ts` | Failure cascade, physics, NPCs. Tune timings so the “TURN OFF OXYGEN” beat lands. |
| `server/index.ts` | Socket protocol. Keep acknowledgements. |
| `shared/types.ts` | **Ask first.** This is the contract. |
| `shared/content.ts` | **Ask first.** Phrase/ping copy. |
| `src/roles/Oxygen.tsx` | Real analog gauge, full-screen strobe, haptic. Still **no audio**, ever. |
| `src/roles/Power.tsx` | Unlabeled tactile breakers, no digits on screen. Scan + astronaut speech. |
| `src/audio.ts` | Browser TTS now. Wire Grok Voice if you get a key. |
| `src/haptics.ts` | Alarm buzz patterns. |

Do **not** restyle `src/index.css` or rebuild Nav/Comms.

### Track B — Friend — CREW GLASS

**She owns how the crew looks, and the two stations that cannot speak freely.**

| Path | What to do |
|---|---|
| `src/index.css` | Throw out the wireframe. Mars-hab consoles, mobile-first, big hit targets. |
| `src/screens/Home.tsx` | Title, how-to, create/join. Keep the `createHab` / `joinHab` calls. |
| `src/screens/Lobby.tsx` | Four role cards with constraints + honor rules. Keep claim/ready/start. |
| `src/roles/Nav.tsx` | Dust-storm radar + countdown. Icon ping palette. Honor line: do not speak. |
| `src/roles/Comms.tsx` | AAC grid (big phrase keys, cooldown bar, teleprinter). |
| `src/roles/Board.tsx` | Table projector for judging — timer, hull, pings, radio. **No oxygen %, no power %.** |
| `public/` | PWA manifest + icon when you get there. |

Do **not** edit `server/` or Oxygen/Power/audio.

### Shared glue (leave it unless the protocol breaks)

- `src/App.tsx`
- `src/screens/Play.tsx`
- `src/net.ts`

## Friend: run *her* work on *her* laptop

She can develop UI without Xiao’s machine:

```bash
git pull
npm install
npm run dev
```

Open `http://127.0.0.1:43127`, claim **Navigation** or **Communications**, start a solo mission. Unclaimed Oxygen/Power will be auto-crewed so the round still runs.

When she wants live two-person chaos, she closes her own server and joins Xiao’s URL instead (see above).

To point her Vite client at Xiao’s ship while she edits UI:

```bash
cp .env.example .env
# VITE_SOCKET_URL=http://XIAO_LAN_IP:43128
npm run dev
```

## What “done” looks like for a demo

3–4 phones, 2 minutes, these beats in order:

1. Oxygen needle drops, screen strobes, **silence** on that phone.
2. Power hears “fourteen percent” and finds breakers by layout, not by labels.
3. Nav sees the dust countdown and can only ping STORM / BRACE.
4. Comms spends a cooldown to put **TURN OFF OXYGEN** as text on Oxygen’s glass — because Oxygen never heard the astronaut.

## Do not do

- Native apps. This stays a mobile web PWA.
- A fifth Life Support role. Four stations only.
- A live LLM picking failures. The scripted cascade in `server/game.ts` is the MVP.
- Editing a file with the other person’s track tag at the top.
