# DON'T KILL THE ASTRONAUT

A 2–4 player cooperative Mars survival game. A rescue vehicle arrives in **7 minutes**. Until then, the crew has to keep a damaged habitat alive — while **no single astronaut has the whole picture**.

Talk out loud. **Tap modules to walk.** Carry the one item you can hold. Solve exact puzzles. Survive the cascade.

## Play

You need **at least two astronauts**. A computer can host the shared **Habitat Monitor** without taking a crew seat.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43221](http://127.0.0.1:43221).

1. On a TV/laptop hit **OPEN HABITAT MONITOR** (does not count as a player) and share the room code / QR.
2. Phones hit **JOIN MISSION** and board as astronauts.
3. Or **CREATE & BOARD AS ASTRONAUT** if this device is also playing.
4. Once **two astronauts** are aboard, the host starts. Monitor screens are not crew.
5. Tap a habitat module (or the chips under the map) to walk. Consoles only work if you are standing in that room.
6. Survive until Rescue ETA `00:00`.

Production (local Node):

```bash
npm run build
npm start
```

## Publish on Cloudflare

Realtime rooms run as **Durable Objects**. The UI is a static export served as Workers Assets.

```bash
npm run deploy
```

That builds the static client and runs `wrangler deploy --temporary` (no Cloudflare login required for a 60-minute preview). Open the printed `workers.dev` URL, then the **claim URL** within 60 minutes to keep the account.

If deploy returns **401**, delete `~/.config/.wrangler/wrangler-temporary-account.toml` and run `npx wrangler deploy --temporary` again (new hostname).

Permanent deploy after `wrangler login`:

```bash
npm run build:cf
npx wrangler deploy
```

Clients use **long-poll GET `/sync`** (not 220ms hammering). If Cloudflare Bot Fight returns a non-JSON **403**, hard-refresh and retry JOIN — the radio will wait and re-hello.

## How it works

The **server owns the habitat**. Clients send actions. The engine validates them, steps oxygen / power / heat / pressure / health, and broadcasts the result.

Exact numbers live on **personal boards**. The shared map only shows STABLE / WARNING / CRITICAL, astronauts walking between modules, and world reactions (dust, dim lights, frost, solar slew, comms glitch).

Puzzles are **deterministic split-information boards**. Crises spawn as **one named habitat failure with two consoles** (a hull breach is air AND heat through the same hole). Overshooting your dial **changes their number** — it is not a second unrelated minigame. The person with the dial never sees the numbers they need.

On a phone the **map stays on screen** with the console docked underneath. Walk with the module chips or the WALK TO button. No Map / Task / Crew tabs.

## Roles

| Crew | 4 players | 3 players | 2 players |
| --- | --- | --- | --- |
| A1 | Life Support | Life Support + Medical | Life Support + Medical + Comms |
| A2 | Power | Power + Thermal | Power + Thermal + Exterior |
| A3 | Thermal + Exterior | Comms + Exterior | |
| A4 | Comms + Medical | | |

Fewer players still run every major system. Timers stretch a little, movement is faster, and the director caps overlapping emergencies. A Habitat Monitor does not receive a role.

## Optional Grok

If `XAI_API_KEY` or `GROK_API_KEY` is set, Mission Control lines and the post-game recap are generated with Grok. **Grok never grades math.** The engine does. Without a key, cinematic fallback copy still runs.

## Stack

- Next.js + React (player UI)
- Authoritative HTTP radio (long-poll GET `/sync`) — Node locally, Cloudflare Durable Objects in production. WebSockets are not used; temporary `workers.dev` hosts block them.
- Web Audio + speech synthesis for alarms / Mission Control
