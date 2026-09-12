import { useState } from 'react'
import {
  CREW_META,
  REVOKE_TARGET,
  SIGNAL_COOLDOWN_MS,
  signalArt,
  signalLabel,
  signalsForAll,
} from '@shared/content'
import type { ClientView, CrewId } from '@shared/types'
import { sendSignal } from '../net'

/**
 * The only channel into Vega. Each pad holds just the calls its console owns,
 * plus every seat it is covering on a short crew — the server rejects the rest.
 *
 * Rotation cards have no photograph on purpose. A rotate sent on a hunch walks
 * her the length of the hab with the key and burns a clean seat, so it should
 * never be mistaken for a routine plate by a thumb moving fast.
 */
export function SignalPad({ view, crew }: { view: ClientView; crew: CrewId }) {
  const cards = signalsForAll(view.covers ?? [crew])
  const cd = view.signalCooldownMs ?? 0
  const seal = view.seal
  const locked = cd > 0 || !seal
  const pct = Math.min(100, (cd / SIGNAL_COOLDOWN_MS) * 100)
  const sawIt = view.ackAgeMs != null && view.ackAgeMs < 4000
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className="signalpad">
      <div className="padstatus">
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
        {cards.map((s) => {
          const art = signalArt(s.id)
          const target = REVOKE_TARGET[s.id]
          return (
            <button
              key={s.id}
              className={`sig${art ? '' : ' sig-rotate'}`}
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
                <span className="thumb type" aria-hidden="true">
                  <span className="rotate-glyph">{s.mark}</span>
                  {target ? <span className="rotate-callsign">{CREW_META[target].callsign}</span> : null}
                </span>
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
