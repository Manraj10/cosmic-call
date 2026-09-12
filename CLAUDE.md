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

One design rule the UI must hold — **corrected 14:05, the earlier version of this rule was wrong:**
**destination treatment must be identical whatever the seal.** `RUN TO <module>` prints on every card,
sealed or not, and nothing else (map highlight, pulse, route line) may appear or disappear based on the
seal. Hiding it only on bad seals turns its *absence* into a tell: Vega could ignore the badge and just
check whether a destination is printed, which leaks the verdict through a second channel. The skill being
tested is reading the seal and refusing a legible instruction under pressure. Don't "fix" RUN TO.

## Submission safety

- **Verified fallback: tag `submit-fallback` (adc11ec).** Cosmic Call rename + phone-join fix, with the
  half-landed habitat types held back. tsc, oxlint, crypto, asymmetry, playtest and `vite build` all pass on
  that exact tree. Note `7e306dd` is NOT a valid fallback: it has 8 typecheck errors and `npm run build` fails.
- **Verify a commit, not a working tree.** `npm run check` in this folder tests whatever is on disk,
  including other agents' uncommitted edits — a green run there says nothing about the hash at HEAD. Check a
  commit in a clean `git worktree add --detach <dir> <sha>` with `node_modules` junctioned in. Two false
  greens already came from this tree: one from a dirty working tree, one from `npx tsc` running with no
  resolvable `node_modules` (it prints no errors because it compiled nothing).
- **Judges clone `main`.** Please don't push to `main` without `npm run check && npm run build` passing on
  the tree you are pushing, and prefer staging specific files over `git add -A`, which sweeps other
  agents' half-written files into your commit.
