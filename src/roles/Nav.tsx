/** TRACK B — Friend. Mute station: storm + ping palette. No text chat. Make this cinematic. */

import { PINGS } from '@shared/content'
import type { ClientView } from '@shared/types'
import { sendAction } from '../net'

export function Nav({ view }: { view: ClientView }) {
  const lastRadio = view.radio.at(-1)
  return (
    <div className="shell">
      <p className="track-tag">Track B · navigation · MUTE — pings only</p>
      <p className="kicker">
        {view.code} · {view.timeLeft != null ? `${Math.ceil(view.timeLeft)}s` : ''} · hull {view.hullBand}
      </p>
      <h1>
        {view.stormActive
          ? 'STORM ON HAB'
          : view.stormEta != null
            ? `T−${Math.ceil(view.stormEta)}s`
            : 'Sky clear'}
      </h1>
      <p>
        Do not speak. Ping. Shields {view.shieldsUp ? 'up' : 'DOWN'}. Heading{' '}
        {view.heading != null ? Math.round(view.heading) : '—'} / target{' '}
        {view.targetHeading != null ? Math.round(view.targetHeading) : '—'}
      </p>
      {view.printer.length ? <div className="banner">{view.printer.join(' · ')}</div> : null}
      {lastRadio ? <p className="kicker">Radio overheard (you still may not talk)</p> : null}
      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(view.heading ?? 0)}
        onChange={(e) => void sendAction({ type: 'heading', deg: Number(e.target.value) })}
      />
      <div className="grid3" style={{ marginTop: 12 }}>
        {PINGS.map((p) => (
          <button
            key={p.id}
            className="btn"
            onClick={() => void sendAction({ type: 'ping', ping: p.id })}
          >
            {p.mark}
            <div className="kicker">{p.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
