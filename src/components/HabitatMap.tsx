import { useEffect, useRef } from 'react'
import {
  MODULE_HOLDS,
  MODULE_LABEL,
  MODULE_SHORT,
  MODULES,
  walkSeconds,
  type ModuleId,
} from '@shared/habitat'
import type { HabView, ValveId } from '@shared/types'

type Pip = { label: string; word: string }

/**
 * Her own panel, pinned to where it is bolted. Only what her hands have set:
 * the leak lights stay off the map, because a pip saying "the plant needs you"
 * would answer the question the crew are supposed to shout.
 */
export interface HabPanel {
  valves: Record<ValveId, 'open' | 'sealed'> | null
  pumpOn: boolean | null
  shieldsOn: boolean | null
}

function pipsFor(m: ModuleId, p: HabPanel): Pip[] {
  if (m === 'plant') {
    return [
      { label: 'PORT', word: p.valves?.port ?? 'open' },
      { label: 'STBD', word: p.valves?.starboard ?? 'open' },
      { label: 'PUMP', word: p.pumpOn ? 'on' : 'off' },
    ]
  }
  if (m === 'lock') return [{ label: 'SHIELDS', word: p.shieldsOn ? 'up' : 'down' }]
  return []
}

/**
 * HAB-7 from above: a spine and three arms. Every tap here spends seconds of
 * air, so the map has to answer three things in one glance — where am I, where
 * is the key, where does the card want me.
 *
 * `target` is set for whatever card is on her glass, sealed or not. The map
 * must never be the thing that reads the seal for her.
 */
export function HabitatMap({
  hab,
  panel,
  target,
  onWalk,
}: {
  hab: HabView
  panel: HabPanel
  target: ModuleId | null
  onWalk: (to: ModuleId) => void
}) {
  const walking = hab.walkingTo
  const fill = useRef<HTMLSpanElement>(null)
  const total = walking ? walkSeconds(hab.at, walking) * 1000 : 0
  const done = total ? Math.min(1, Math.max(0, 1 - hab.arriveInMs / total)) : 0

  // Keyed on the walk, not on arriveInMs: server ticks land unevenly, and
  // restarting the bar on each one makes it stutter. One linear run per walk,
  // seeded from wherever the first tick found her.
  useEffect(() => {
    if (!walking || !fill.current) return
    const run = fill.current.animate([{ width: `${done * 100}%` }, { width: '100%' }], {
      duration: hab.arriveInMs,
      easing: 'linear',
      fill: 'forwards',
    })
    return () => run.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hab.at, walking])

  const you = (
    <span className="habmap-you">
      YOU{hab.holdingToken ? <span className="habmap-token carried">+ TOKEN</span> : null}
    </span>
  )

  return (
    <section className={`habmap${walking ? ' walking' : ''}`} aria-label="HAB-7 map">
      <div className="habmap-deck">
        {(['plant', 'lock', 'comms'] as const).map((arm) => (
          <span key={arm} className={`habmap-arm habmap-arm-${arm}`} aria-hidden="true" />
        ))}
        {MODULES.map((m) => {
          const here = m === hab.at
          const dest = m === walking
          const tokenHere = hab.tokenAt === m
          const pips = pipsFor(m, panel)
          const said = [
            `${MODULE_LABEL[m]}: ${MODULE_HOLDS[m]}`,
            ...pips.map((p) => `${p.label.toLowerCase()} ${p.word}`),
            tokenHere ? 'key token is here' : null,
            here ? (hab.holdingToken ? 'you are here, carrying the key' : 'you are here') : null,
            dest ? 'you are walking here' : null,
            m === target ? 'the card on your glass sends you here' : null,
          ]
          return (
            <button
              key={m}
              type="button"
              className={`habmap-mod habmap-${m}${here ? ' is-here' : ''}${dest ? ' is-dest' : ''}${m === target ? ' is-target' : ''}`}
              aria-current={here ? 'location' : undefined}
              aria-label={said.filter(Boolean).join(', ')}
              disabled={!!walking}
              onClick={() => {
                if (!here) onWalk(m)
              }}
            >
              <span className="habmap-name">{MODULE_SHORT[m]}</span>
              {pips.length ? (
                <span className="habmap-pips">
                  {pips.map((p) => (
                    <span key={p.label} className={`habmap-pip state-${p.word}`}>
                      <b>{p.label}</b> {p.word}
                    </span>
                  ))}
                </span>
              ) : null}
              {tokenHere ? <span className="habmap-token">TOKEN</span> : null}
              {m === target ? <span className="habmap-go">GO</span> : null}
              {here && !walking ? you : null}
            </button>
          )
        })}
      </div>

      <div className="habmap-status">
        {walking ? (
          <>
            <span className="habmap-transit" aria-live="polite">
              running to {MODULE_SHORT[walking]}
            </span>
            {you}
            <span className="habmap-eta" aria-hidden="true">
              {(hab.arriveInMs / 1000).toFixed(1)}s
            </span>
            <span className="habmap-progress" aria-hidden="true">
              <span ref={fill} className="habmap-progress-fill" style={{ width: `${done * 100}%` }} />
            </span>
          </>
        ) : (
          <span className="habmap-transit" aria-live="polite">
            in {MODULE_SHORT[hab.at]} · tap a module to run
          </span>
        )}
      </div>
    </section>
  )
}
