/** TRACK B — Friend. Optional table projector for judging. No secret percents. */

import { phraseLabel, pingLabel } from '@shared/content'
import type { ClientView } from '@shared/types'

export function Board({ view }: { view: ClientView }) {
  return (
    <div className="shell">
      <p className="track-tag">Track B · table display</p>
      <p className="kicker">Public bus · {view.code}</p>
      <h1>
        {view.timeLeft != null ? `${Math.ceil(view.timeLeft)}s` : '—'} · hull {view.hull ?? view.hullBand}
      </h1>
      <p>
        Storm {view.stormActive ? 'ON HAB' : view.stormEta != null ? `T−${Math.ceil(view.stormEta)}s` : 'quiet'} ·
        shields {view.shieldsUp ? 'up' : 'down'} · braced {view.braced ? 'yes' : 'no'}
      </p>
      <div className="printer">{view.printer.slice(-10).join('\n')}</div>
      <h2>Pings</h2>
      <p>{view.pings.slice(-5).map((p) => pingLabel(p.ping)).join(' · ') || '—'}</p>
      <h2>Radio</h2>
      <p>{view.radio.slice(-5).map((r) => phraseLabel(r.phrase)).join(' · ') || '—'}</p>
    </div>
  )
}
