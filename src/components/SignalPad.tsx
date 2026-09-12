import { SIGNAL_COOLDOWN_MS, signalArt, signalLabel, signalsFor } from '@shared/content'
import type { ClientView, CrewId } from '@shared/types'
import { sendAction } from '../net'

/**
 * The only channel into Vega. Each crew member's pad holds just the two calls
 * their console owns — the server rejects anyone else's, so there is nothing to
 * gain from showing them.
 */
export function SignalPad({ view, crew }: { view: ClientView; crew: CrewId }) {
  const mine = signalsFor(crew)
  const cd = view.signalCooldownMs ?? 0
  const locked = cd > 0
  const pct = Math.min(100, (cd / SIGNAL_COOLDOWN_MS) * 100)
  // Her one bit back: did she actually look at it?
  const sawIt = view.ackAgeMs != null && view.ackAgeMs < 4000

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="tag" style={{ textAlign: 'center' }}>
        {locked
          ? `pad resetting — ${(cd / 1000).toFixed(1)}s`
          : 'these two pictures slam her glass'}
      </div>
      <div className="cooldown">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="pad owned">
        {mine.map((s) => (
          <button
            key={s.id}
            className="sig"
            disabled={locked}
            onClick={() => void sendAction({ type: 'signal', signal: s.id })}
          >
            <img className="thumb" src={signalArt(s.id)} alt="" />
            <span className="name">{s.label}</span>
            <span className="why">{s.hint}</span>
          </button>
        ))}
      </div>
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
