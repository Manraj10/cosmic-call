/** TRACK B — Friend. AAC radio: preset phrases + cooldown. Make this feel like a speech board. */

import { PHRASES, phraseLabel } from '@shared/content'
import type { ClientView } from '@shared/types'
import { sendAction } from '../net'

export function Comms({ view }: { view: ClientView }) {
  const locked = (view.cooldownMs ?? 0) > 0
  return (
    <div className="shell">
      <p className="track-tag">Track B · comms · AAC / limited output</p>
      <p className="kicker">
        {view.code} · {view.timeLeft != null ? `${Math.ceil(view.timeLeft)}s` : ''} · hull {view.hullBand}
        {view.glitch ? ' · STATIC' : ''}
      </p>
      <h1>Radio</h1>
      <p>
        You may only say a phrase after you transmit it. Cooldown{' '}
        {Math.ceil((view.cooldownMs ?? 0) / 1000)}s.
      </p>
      <div className="printer">{view.printer.slice(-8).join('\n') || '— teleprinter idle —'}</div>
      <div className="grid2" style={{ marginTop: 10 }}>
        {PHRASES.map((p) => {
          const dead = view.disabledPhrases.includes(p.id)
          return (
            <button
              key={p.id}
              className="btn"
              disabled={locked || dead}
              onClick={() => void sendAction({ type: 'phrase', phrase: p.id })}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      {view.radio.at(-1) ? (
        <p className="kicker" style={{ marginTop: 8 }}>
          Last TX {phraseLabel(view.radio.at(-1)!.phrase)}
        </p>
      ) : null}
    </div>
  )
}
