# DON'T KILL THE ASTRONAUT

A 2–4 player cooperative Mars survival game. A rescue vehicle arrives in **7 minutes**. Until then, the crew has to keep a damaged habitat alive — while **no single astronaut has the whole picture**.

Talk out loud. Move between modules. Carry the one item you can hold. Solve exact puzzles. Survive the cascade.

## Play

You need **at least two devices or two browser tabs**. One player cannot start a mission.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43221](http://127.0.0.1:43221).

1. One player hits **CREATE MISSION** and shares the room code / QR.
2. Others hit **JOIN MISSION**.
3. Once two astronauts are aboard, the host starts.
4. Survive until Rescue ETA `00:00`.

Production:

```bash
npm run build
npm start
```

## How it works

The **server owns the habitat**. Clients send actions. The engine validates them, steps oxygen / power / heat / pressure / health, and broadcasts the result.

Exact numbers live on **personal boards**. The shared map only shows STABLE / WARNING / CRITICAL, astronauts moving, and world reactions (dust, dim lights, frost, solar slew, comms glitch).

Puzzles are **deterministic**. If a setting is bad, the simulation explains the physics — it never shrugs and says “wrong.”

## Roles

| Crew | 4 players | 3 players | 2 players |
| --- | --- | --- | --- |
| A1 | Life Support | Life Support + Medical | Life Support + Medical + Comms |
| A2 | Power | Power + Thermal | Power + Thermal + Exterior |
| A3 | Thermal + Exterior | Comms + Exterior | |
| A4 | Comms + Medical | | |

Fewer players still run every major system. Timers stretch a little, movement is faster, and the director caps overlapping emergencies.

## Optional Grok

If `XAI_API_KEY` or `GROK_API_KEY` is set, Mission Control lines and the post-game recap are generated with Grok. **Grok never grades math.** The engine does. Without a key, cinematic fallback copy still runs.

## Stack

- Next.js + React (player UI)
- Socket.IO + authoritative Node simulation
- Web Audio + speech synthesis for alarms / Mission Control
