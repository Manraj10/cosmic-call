import { useEffect, useRef } from 'react'
import {
  CREW_META,
  REVOKE_TARGET,
  signalArt,
  signalLabel,
  signalMark,
  signalSendsTo,
} from '@shared/content'
import { MODULE_SHORT, moduleFor } from '@shared/habitat'
import type { ClientView, SignalId } from '@shared/types'
import { buzz } from '../haptics'
import { sendAction } from '../net'
import { SealBadge } from './Seal'

/**
 * Vega's real channel. The table will shout whether we like it or not — so the
 * official order arrives as a picture flying at the glass, not as a rule about
 * earplugs.
 *
 * Since GHOST got on the bus, the picture is no longer enough. The seal is the
 * part she has to read, so an unsigned card gets a different colour, a
 * different buzz, and "bin it" where her thumb expects "got it".
 *
 * RUN TO prints on every card, forged or not. Hiding it under a bad seal would
 * let her skip the badge and just check whether a destination is printed — the
 * verdict leaking through a second channel — and it would take away the thing
 * the round is testing: a legible, urgent instruction she has to refuse.
 */
export function IncomingSlam({ view }: { view: ClientView }) {
  const fresh = view.signals.filter((s) => s.fresh)
  const latest = fresh.at(-1)
  const lastId = useRef<string | null>(null)

  useEffect(() => {
    if (latest && lastId.current !== latest.id) {
      lastId.current = latest.id
      buzz(latest.seal === 'sealed' ? [90, 60, 90, 60, 220] : [40, 40, 40, 40, 40, 40, 40])
    }
  }, [latest])

  if (!latest) return null

  const dir = side(latest.signal)
  const bad = latest.seal !== 'sealed'
  const art = signalArt(latest.signal)
  const dest = moduleFor(signalSendsTo(latest.signal))
  const target = REVOKE_TARGET[latest.signal]

  return (
    <div
      className={`slam seal-slam-${latest.seal}`}
      key={latest.id}
      role="dialog"
      aria-label={`${signalLabel(latest.signal)} — ${latest.seal}`}
      onClick={() => void sendAction({ type: 'clear-signals' })}
    >
      {art ? (
        <img className="slam-plate" src={art} alt="" />
      ) : (
        <div className="slam-type" aria-hidden="true">
          <span className="rotate-glyph">{signalMark(latest.signal)}</span>
          {target ? <span className="rotate-callsign">{CREW_META[target].callsign}</span> : null}
        </div>
      )}
      {dir ? <div className={`slam-dir ${dir.side}`}>{dir.mark}</div> : null}
      <div className="slam-caption">
        <div className="what">{signalLabel(latest.signal)}</div>
        {dest ? <div className="slam-go">RUN TO {MODULE_SHORT[dest]}</div> : null}
        <SealBadge seal={latest.seal} tag={latest.tag} seq={latest.seq} />
        {fresh.length > 1 ? <div className="tag">+{fresh.length - 1} more incoming</div> : null}
        <button
          className={`ack${bad ? ' refuse' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            void sendAction({ type: 'clear-signals' })
          }}
        >
          {bad ? 'bin it' : 'got it'}
        </button>
      </div>
    </div>
  )
}

function side(id: SignalId): { side: 'left' | 'right'; mark: string } | null {
  if (id === 'seal-port') return { side: 'left', mark: '◀' }
  if (id === 'seal-starboard') return { side: 'right', mark: '▶' }
  return null
}
