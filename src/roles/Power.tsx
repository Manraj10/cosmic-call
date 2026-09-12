/** TRACK A — Xiao. Friend: do not edit. Blind station: no numbers, speech + switches. */

import { BREAKER_LAYOUT } from '@shared/content'
import type { ClientView } from '@shared/types'
import { scanPower, sendAction } from '../net'

export function Power({ view }: { view: ClientView }) {
  return (
    <div className="shell">
      <p className="track-tag">Track A · power · NO READOUTS</p>
      <p className="kicker">{view.code} · bus {view.powerHint ?? 'unknown'} · hull {view.hullBand}</p>
      <h1>Main bus</h1>
      <p>
        There is no percentage on this glass. Wait for the ship to speak it, or
        for someone to shout it.
      </p>
      <div className="grid2">
        {BREAKER_LAYOUT.map((b) => {
          const on = view.breakers?.[b.id]
          return (
            <button
              key={b.id}
              className={`btn ${on ? 'on' : ''}`}
              aria-label={b.spoken}
              onClick={() => void sendAction({ type: 'breaker', breaker: b.id, on: !on })}
            >
              {b.shape === 'round' ? '●' : b.shape === 'notch' ? '▲' : '■'}
            </button>
          )
        })}
      </div>
      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => scanPower()}>
        Scan (speaks layout + percent)
      </button>
    </div>
  )
}
