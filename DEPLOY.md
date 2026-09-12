# Deploy

The ship is one long-lived Node process. Express serves the built client, Socket.io holds every hab in memory and ticks it at 10 Hz, and each phone keeps a WebSocket open to it. Static and serverless hosts (Vercel, Netlify, GitHub Pages, Cloudflare Workers) can't run that without a rewrite. It needs a host that keeps one process up and passes WebSockets through.

## What we run at the venue: one laptop + a Cloudflare quick tunnel

This is the live setup. The exact commands the lead runs are in `LEADER.md` → *Demo topology*; this is the shape of it.

A production build of a verified commit runs on the laptop, and a Cloudflare quick tunnel gives it a public `https://<random>.trycloudflare.com` address. Phones join over any network, so venue Wi-Fi blocking device-to-device traffic stops mattering, and HTTPS gives phones a secure context (`crypto.subtle` is live there). No account, no login.

```powershell
# a clean detached worktree of the green commit, never the working tree other agents are editing
git worktree add --detach ..\cosmic-call-live <green sha>
cd ..\cosmic-call-live
npm run build
$env:NODE_ENV = 'production'; $env:PORT = '43200'
node --env-file-if-exists=..irgap\.env --import tsx server/index.ts
# second terminal
cloudflared tunnel --no-autoupdate --url http://localhost:43200
```

Then check it from outside: open `<url>/api/health` and run `npx tsx scripts/realtime.ts <url>`.

- **The URL changes whenever the tunnel restarts.** The lobby QR encodes whatever origin served the page, so a fresh lobby is always right, but anything you printed or pasted is not.
- **The laptop is the server.** Plugged in, lid open, sleep off, through the end of judging.
- **Tunnel the production build, not the dev server.** Vite dev serves every source file as its own request, which is slow over a tunnel.
- **Redeploy** = check out a newer green sha in that worktree, `npm run build`, restart the server. The tunnel stays up and the URL survives.
- `npm start` does not read `.env`. The command above does, through `--env-file-if-exists`.

## Alternative: Render (not used; untested)

Kept for after the hackathon. Not used at the venue: it needs an account, the free tier sleeps and runs on 0.1 CPU, and neither `docker build` nor the `render.yaml` blueprint has been exercised. `Dockerfile` and `render.yaml` at the repo root are the whole setup.

1. Commit and push `Dockerfile`, `.dockerignore` and `render.yaml` to `main`.
2. Open <https://render.com/deploy?repo=https://github.com/Manraj10/cosmic-call>
3. Sign in to Render with GitHub, review the one `cosmic-call` web service, apply.
4. Wait for the first build. Render shows the service's `onrender.com` URL on its page.
5. Open `<that URL>/api/health`. It should answer `{"ok":true,...}`.

Share the root URL. The lobby QR encodes whatever origin served the page, so on Render it already points at the public address, over HTTPS.

**Cost.** The free instance: 0.1 CPU, 512 MB, 750 instance hours a month per workspace. It sleeps after 15 minutes with no HTTP request and no WebSocket message, and the next visitor waits about a minute while it wakes. Open the link yourself a couple of minutes before a judge does. To stop the sleeping, change the service's instance type to `0.5c-512mb` (Render's old Starter); see <https://render.com/pricing> for its price.

**Deploys are manual.** `autoDeployTrigger: "off"`, because every deploy restarts the process and drops every live round. Pushing to `main` changes nothing. To ship: service page → Manual Deploy → Deploy latest commit. Never during judging.

**One instance, always.** Habs live in one process's memory. A second instance holds a different set, and a room code made on one stops resolving for a phone routed to the other.

**Don't set `SHIP_PORT` on a host.** The server reads it before `PORT`, and Render routes traffic to `PORT`.

### API keys

All optional. With none set the game is identical: phones speak with their own speech engine and the debrief uses written lines.

On Render: service page → Environment → add each variable → **Save and deploy**. That restarts the process, so set keys before anyone plays. **Save only** waits for the next deploy.

| Variable | Used for |
| --- | --- |
| `ELEVENLABS_API_KEY` | radio voice, tried first |
| `ELEVENLABS_VOICE_ID` | which ElevenLabs voice |
| `XAI_API_KEY` | radio voice if ElevenLabs is absent, and the last model for the debrief |
| `IFM_API_KEY` | debrief line, tried first |
| `IFM_BASE_URL`, `IFM_MODEL` | IFM endpoint and model |
| `GEMINI_API_KEY` | debrief line if IFM is absent |

`/api/health` reports what is live: `voice` is `elevenlabs`, `grok` or `browser`; `director` is `ifm-k2`, `gemini`, `grok` or `hab`. Keys stay on the server and never reach a phone.

## Anywhere else that runs a container

```sh
docker build -t cosmic-call .
docker run -p 43128:43128 -e ELEVENLABS_API_KEY=... cosmic-call
```

Then open `http://localhost:43128`. Fly, Railway, Koyeb or a VPS take the same Dockerfile. Three rules carry over: one instance (Fly starts two by default, so `fly launch --ha=false`), WebSockets on, and let the platform inject `PORT`.

## Fallback: LAN or hotspot (works today)

1. One laptop runs `npm run dev`.
2. Find its address: `ipconfig` on Windows (IPv4 Address), `ipconfig getifaddr en0` on a Mac.
3. Everyone opens `http://THAT_IP:43127`.
4. The first time, Windows asks whether Node may use the network. Allow it, and tick public networks too if Windows filed the venue Wi-Fi as public, or no phone gets in.
5. If phones still can't reach it, the venue network is blocking device-to-device traffic. Turn on a phone hotspot, join the laptop and every phone to it, and go back to step 2: the address changes.

Keys on a laptop go in the shell that runs the ship, since `npm run dev` doesn't read `.env`:

```powershell
$env:ELEVENLABS_API_KEY = '...'; npm run dev
```
