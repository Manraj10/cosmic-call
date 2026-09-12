# DON'T KILL THE ASTRONAUT

A 2–4 player cooperative Mars survival game. A rescue vehicle arrives in **7 minutes**. Until then, the crew has to keep a damaged habitat alive — while **no single astronaut has the whole picture**.

Talk out loud. **Tap modules to walk.** Carry the one item you can hold. Solve exact puzzles. Survive the cascade.

## Upload to GitHub

This folder is the full project. It does **not** include `node_modules` — run `npm install` after you clone or unzip.

With the game running locally, open **[http://127.0.0.1:43221/get](http://127.0.0.1:43221/get)** and hit **DOWNLOAD ZIP**. Direct file: [http://127.0.0.1:43221/dont-kill-the-astronaut.zip](http://127.0.0.1:43221/dont-kill-the-astronaut.zip).

If you already have the zip, unzip it, then push to your empty repo (this project was aimed at [`shainag03/oberon.mp`](https://github.com/shainag03/oberon.mp)):

```bash
unzip dont-kill-the-astronaut.zip
cd dont-kill-the-astronaut
git init
git add .
git commit -m "Don't Kill the Astronaut — first upload"
git branch -M main
git remote add origin https://github.com/shainag03/oberon.mp.git
git push -u origin main
```

GitHub Desktop: unzip → **File → Add Local Repository** → **Publish repository** (or push to `oberon.mp` if it already exists).

If GitHub already has a commit (README/license) and rejects the push:

```bash
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
```

Prefer the full git history? Clone the **`.bundle`** instead of the zip:

```bash
git clone dont-kill-the-astronaut.bundle dont-kill-the-astronaut
cd dont-kill-the-astronaut
git remote set-url origin https://github.com/shainag03/oberon.mp.git
git push -u origin main
```

You must be logged into GitHub on **your** machine (`gh auth login`, GitHub Desktop, or HTTPS). This cloud session cannot push to GitHub for you.

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

On a phone the **map stays on screen** with the console docked underneath. Walk with the module chips or the WALK TO button. Stand in the same module to **hand or swap kits**. The Habitat Monitor keeps the full system wall (comms, medical, tanks). Astronaut screens only show the numbers that score.

## Roles

| Crew | 4 players | 3 players | 2 players |
| --- | --- | --- | --- |
| A1 | Life Support | Life Support + Medical | Life Support + Medical + Comms |
| A2 | Power | Power + Thermal | Power + Thermal + Exterior |
| A3 | Thermal + Exterior | Comms + Exterior | |
| A4 | Comms + Medical | | |

Fewer players still run every major system. Timers stretch a little, movement is faster, and the director caps overlapping emergencies. A Habitat Monitor does not receive a role.

## MLH sponsor stack

This is a real in-game integration, not logo-only. The habitat still plays with **zero keys**.

| Track | What the game uses |
| --- | --- |
| **Cloudflare** — Best AI Application Built with Cloudflare | Workers Assets + Durable Object `GameRoomDO` for rooms. **Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) writes Mission Control radio copy. Binding `AI` in `wrangler.jsonc`. |
| **ElevenLabs** — Best Use of ElevenLabs | Mission Control TTS via `GET /radio/voice?t=...` (also `GET /sync/:CODE/voice`). Audio is `audio/mpeg`. No `/api` path (workers.dev 403s those). |
| **MLH** | Official 2026 trust badge (top-right) plus footer credits linking [mlh.io](https://mlh.io), [mlh.link/cloudflare](https://mlh.link/cloudflare), [mlh.link/elevenlabs](https://mlh.link/elevenlabs). |

AI copy is **radio flavor only**. The engine grades puzzles. Models never judge math.

### Env vars (all optional)

```bash
# Cloudflare Workers AI (local Node REST fallback; on Workers the AI binding is used)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Fallback gen-AI if Workers AI is unset
XAI_API_KEY=          # or GROK_API_KEY — Grok
GEMINI_API_KEY=       # or GOOGLE_API_KEY — Gemini

# ElevenLabs Mission Control voice
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=  # optional; defaults to a stock voice
```

On Cloudflare, set the same names as Worker secrets (`wrangler secret put ELEVENLABS_API_KEY`, etc.). The `AI` binding does not need a key.

**Fallback order for Mission Control copy:** Workers AI binding → Cloudflare Workers AI REST → Grok → Gemini → hardcoded NASA-flavored lines already in the game.

**Voice fallback:** ElevenLabs MPEG → browser `speechSynthesis`. If `GET /radio/voice` returns 404 (no key), the client speaks locally.

## Stack

- Next.js + React (player UI)
- Authoritative HTTP radio (long-poll GET `/sync`) — Node locally, Cloudflare Durable Objects in production. WebSockets are not used; temporary `workers.dev` hosts block them.
- Cloudflare Workers AI for Mission Control copy, with Grok / Gemini / hardcoded fallbacks
- ElevenLabs TTS for Mission Control, with Web Speech fallback
- Web Audio for habitat alarms
