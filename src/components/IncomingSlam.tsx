import { useEffect, useRef } from 'react'
import { signalArt, signalLabel } from '@shared/content'
import type { ClientView, SignalId } from '@shared/types'
import { buzz } from '../haptics'
import { sendAction } from '../net'

/**
 * Vega's real channel. The table will shout whether we like it or not — so the
 * official order arrives as a picture flying at the glass, not as a rule about
 * earplugs.
 */
export function IncomingSlam({ view }: { view: ClientView }) {
  const fresh = view.signals.filter((s) => s.fresh)
  const latest = fresh.at(-1)
  const lastId = useRef<string | null>(null)

  useEffect(() => {
    if (latest && lastId.current !== latest.id) {
      lastId.current = latest.id
      buzz([90, 60, 90, 60, 220])
    }
  }, [latest])

  if (!latest) return null

  const dir = side(latest.signal)

  return (
    <div
      className="slam"
      key={latest.id}
      role="dialog"
      aria-label={signalLabel(latest.signal)}
      onClick={() => void sendAction({ type: 'clear-signals' })}
    >
      <img className="slam-plate" src={signalArt(latest.signal)} alt="" />
      {dir ? <div className={`slam-dir ${dir.side}`}>{dir.mark}</div> : null}
      <div className="slam-caption">
        <div className="what">{signalLabel(latest.signal)}</div>
        {fresh.length > 1 ? <div className="tag">+{fresh.length - 1} more incoming</div> : null}
        <button
          className="ack"
          onClick={(e) => {
            e.stopPropagation()
            void sendAction({ type: 'clear-signals' })
          }}
        >
          got it
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
