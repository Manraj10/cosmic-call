# CROSSTALK

Local-multiplayer party game. Four phones, one dying Mars hab, asymmetric senses.

| Station | Constraint |
|---|---|
| **Oxygen** | Deaf — gauge + lights + haptic, zero audio |
| **Power** | Blind — no numbers, switches by position, percent is spoken |
| **Navigation** | Mute — sees the storm, may only ping |
| **Communications** | AAC radio — 16 phrases, hard cooldown |

Unclaimed stations are auto-crewed slowly so two people can still demo.

## Run on this laptop

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43127**

## Play with a friend (same Wi‑Fi)

1. One laptop runs `npm run dev` (that laptop is the hab).
2. Find its LAN IP (`ipconfig` / `ifconfig` / `ip addr`).
3. Other laptop and phones open `http://THAT_IP:43127`
4. One person **Open a hab**, read the 4-letter code out loud, everyone else **Enter hab**.

## Split of work

Two people, two laptops, two file lists — see **[COLLAB.md](COLLAB.md)**. Do not both edit the same files.

## Optional: friend’s UI against your live ship

On the friend laptop, copy `.env.example` to `.env` and set `VITE_SOCKET_URL` to `http://YOUR_IP:43128`, then `npm run dev`.
