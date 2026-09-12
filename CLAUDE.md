# Cosmic Call — agent notes

**Product name is Cosmic Call.** Repo: https://github.com/Manraj10/cosmic-call

Cursor agent + Claude may both edit. Prefer small diffs on `main`. Branding: **Cosmic Call** / `cosmic-call`.

## Combined design (locked)

1. **Asymmetric intel** (crosstalk): Vega hears nothing; crew each see one readout; orders are signed pictures.
2. **HAB-7 as a place** (habitat): Vega must **walk** to Plant / Lock / Comms. Controls are dead in transit and wrong modules.
3. **Hardware token**: key rotation only at Comms while holding the token from the Spine. Chen sends `ROTATE ROOK` / `ROTATE IDRIS` cards — she does not press a remote revoke button.
4. **GHOST**: forge → replay → steal key. Forged cards that send her the wrong way add `wastedWalkSeconds` to the incident report.

## Don't break

- `npm run asymmetry` — Vega never gets forbidden fields; revoke is physical
- `npm run crypto` — HMAC seals
- `npm run playtest` — balance harness
- Demo path in `PITCH.md`

## In flight

If you touch walk/token/revoke, update asymmetry + PITCH in the same PR.

## In flight — Claude workflow (started 12 Sep, owns these files until this note is removed)

Six agents are editing in parallel. **Please do not edit these files while this note is here** — concurrent
writes to the same file silently drop one side's work:

- `src/components/HabitatMap.tsx`, `src/roles/Vega.tsx`, `src/roles/Engineer.tsx`, `src/roles/Pilot.tsx`,
  `src/roles/Sparks.tsx`, `src/components/IncomingSlam.tsx`, `src/components/Seal.tsx`,
  `src/components/SignalPad.tsx`
- `src/net.ts`, `src/App.tsx`, `src/screens/*.tsx`
- `src/index.css`
- `scripts/asymmetry.ts`, `scripts/playtest.ts`, `scripts/crypto.ts`
- `README.md`, `PITCH.md`, `SUBMISSION.md`, and any new deploy file (`DEPLOY.md`, `Dockerfile`, etc.)

**Cursor: `server/game.ts` is yours** — the workflow will not touch it. Codex keeps `Board.tsx`,
`mission-control.css`, `MissionHabitat.tsx`, `scripts/realtime.ts`.

One design rule the UI must hold: **never route or highlight a destination for a card whose seal is not
`sealed`.** Showing `RUN TO <module>` on a BROKEN SEAL card walks Vega on GHOST's orders by default and
deletes the mechanic. Destination hints are for sealed cards only.

### For Cursor — three gaps in `server/game.ts` other files are already building against (13:54)

1. **`covers` is always `null`** (only assignment is the base view). Seat merging is promised in the
   contract and in the docs: when fewer than three crew are seated, the unseated seats' readouts and cards
   must merge onto the seated consoles. Today a Vega + 1 crew table loses two instruments and their calls,
   and the harness will assert a short crew is winnable. Also `SIGNAL_OWNER[signal] !== role` must become
   "owner is in this console's covers", or a covering console cannot send the cards it shows.
2. **`this.bus.pickVictim(this.rng)` passes no seated list.** `pickVictim(rng, seated)` now takes one. Without
   it GHOST can steal a key from an empty chair — the victim's own signing log is the ONLY evidence of a
   theft, so that makes the round unwinnable rather than hard. Pass the seated crew.
3. **`{type:'rematch'}` is unhandled.** The debrief is getting a host-only rematch button. Host-only, from
   `phase === 'end'`: reset to `lobby`, keep players and seats, clear `ready`.

Also: `src/components/HabDeck.tsx` (yours, untracked) overlaps `src/components/HabitatMap.tsx`, which the
workflow is creating for `Vega.tsx`. Whichever lands, only one should be wired into `Vega.tsx` — the lead will
reconcile after the workflow finishes. Please don't rewrite `Vega.tsx` in the meantime.
