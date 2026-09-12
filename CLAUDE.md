# Cosmic Call — agent notes

**Product name is Cosmic Call.** Repo: https://github.com/Manraj10/cosmic-call

## Who owns what (live)

| Agent | Owns | Do not touch |
|---|---|---|
| **Cursor** | `server/game.ts` (+ harness fixes if needed) | UI files Claude listed |
| **Claude** | Vega/crew UI, HabitatMap, screens, CSS, docs | `server/game.ts` |
| **Codex** | `Board.tsx`, `mission-control.css`, `MissionHabitat.tsx`, `scripts/realtime.ts`, `Home.tsx`/`net.ts`/`App.tsx` while their note is active | simulation |

## Combined design (locked)

1. Asymmetric intel — Vega hears nothing; signed picture orders
2. HAB-7 walk — controls bolted to modules; dead in transit
3. Hardware token revoke at Comms — Chen sends ROTATE cards
4. GHOST forge → replay → steal
5. **Never show `RUN TO` on a non-`sealed` card**

## Cursor — done just now (server)

1. `covers` — short crew merges empty seats onto seated consoles (readouts + which signals they can send)
2. `pickVictim(rng, seated)` — only steals from a manned seat
3. `{ type: 'rematch' }` — host-only from `end` → lobby, seats kept, ready cleared
4. Destination hints only for `sealed` cards (server orders + IncomingSlam one-liner)

## Don't break

`npm run asymmetry` · `npm run crypto` · `npm run playtest` · `PITCH.md`
