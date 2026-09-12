import { useState } from 'react'
import { SIGNAL_COOLDOWN_MS, signalArt, signalLabel, signalsFor } from '@shared/content'
import type { ClientView, CrewId } from '@shared/types'
import { sendSignal } from '../net'

/**
 * The only channel into Vega. Each crew member's pad holds just the calls their
 * console owns — the server rejects anyone else's.
 */
export function SignalPad({ view, crew }: { view: ClientView; crew: CrewId }) {
  const mine = signalsFor(crew)
  const cd = view.signalCooldownMs ?? 0
  const seal = view.seal
  const locked = cd > 0 || !seal
  const pct = Math.min(100, (cd / SIGNAL_COOLDOWN_MS) * 100)
  const sawIt = view.ackAgeMs != null && view.ackAgeMs < 4000
  const [note, setNote] = useState<string | null>(null)

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="tag" style={{ textAlign: 'center' }}>
        {locked
          ? cd > 0
            ? `pad resetting — ${(cd / 1000).toFixed(1)}s`
            : 'no key yet'
          : 'signed with your key, then it slams her glass'}
      </div>
      <div className="cooldown">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="pad owned">
        {mine.map((s) => {
          const art = signalArt(s.id)
          return (
            <button
              key={s.id}
              className="sig"
              disabled={locked}
              onClick={() => {
                if (!seal) return
                setNote(null)
                void sendSignal(seal, crew, s.id).catch((e: Error) => setNote(e.message))
              }}
            >
              {art ? (
                <img className="thumb" src={art} alt="" />
              ) : (
                <span className="thumb type">{s.mark}</span>
              )}
              <span className="name">{s.label}</span>
              <span className="why">{s.hint}</span>
            </button>
          )
        })}
      </div>
      {note ? <div className="padnote">{note}</div> : null}
      {view.lastSignal ? (
        <div className={`ackline${sawIt ? ' lit' : ''}`}>
          {sawIt ? (
            <>she read {signalLabel(view.lastSignal)}</>
          ) : (
            <>sent {signalLabel(view.lastSignal)} — no confirmation yet</>
          )}
        </div>
      ) : null}
    </div>
  )
}
