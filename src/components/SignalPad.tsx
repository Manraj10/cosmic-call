import { SIGNALS, SIGNAL_COOLDOWN_MS, signalLabel } from '@shared/content'
import type { ClientView } from '@shared/types'
import { sendAction } from '../net'

/**
 * The only channel into Vega. Shared by all three crew, so a wasted press is a
 * wasted press for everybody.
 */
export function SignalPad({ view }: { view: ClientView }) {
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
          : 'one signal reaches her glass'}
      </div>
      <div className="cooldown">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="pad">
        {SIGNALS.map((s) => (
          <button
            key={s.id}
            className="sig"
            disabled={locked}
            onClick={() => void sendAction({ type: 'signal', signal: s.id })}
          >
            <span className="mark">{s.mark}</span>
            <span className="name">{s.label}</span>
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
