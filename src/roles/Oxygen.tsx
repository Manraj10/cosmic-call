/** TRACK A — Xiao. Friend: do not edit. Deaf station: lights + haptics, no audio. */

import { useEffect } from 'react'
import type { ClientView, ValveId } from '@shared/types'
import { phraseLabel, pingLabel } from '@shared/content'
import { buzz } from '../haptics'
import { sendAction } from '../net'

export function Oxygen({ view }: { view: ClientView }) {
  useEffect(() => {
    if (view.alarm) buzz([200, 60, 200, 60, 200])
  }, [view.alarm])

  const lastPing = view.pings.at(-1)
  const lastRadio = view.radio.at(-1)

  return (
    <div className="shell">
      <p className="track-tag">Track A · oxygen · NO AUDIO</p>
      <p className="kicker">
        {view.code} · {view.timeLeft != null ? `${Math.ceil(view.timeLeft)}s` : ''} · hull {view.hullBand}
      </p>
      <h1>{view.oxygen != null ? `${Math.round(view.oxygen)}%` : '—'}</h1>
      <p>Pressure only. If someone is screaming, you will not hear it.</p>
      {lastRadio ? <div className="banner">{phraseLabel(lastRadio.phrase)}</div> : null}
      {lastPing ? <div className="banner">PING {pingLabel(lastPing.ping)}</div> : null}
      <div className="row">
        {(['port', 'starboard'] as ValveId[]).map((valve) => {
          const sealed = view.valves?.[valve] === 'sealed'
          return (
            <button
              key={valve}
              className={`btn ${sealed ? 'on' : 'alert'}`}
              onClick={() => void sendAction({ type: 'valve', valve, sealed: !sealed })}
            >
              {valve} {sealed ? 'sealed' : 'open'}
            </button>
          )
        })}
      </div>
      <button
        className={`btn ${view.pumpOn ? 'alert' : 'on'}`}
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => void sendAction({ type: 'pump', on: !view.pumpOn })}
      >
        Pump {view.pumpOn ? 'ON' : 'OFF'}
      </button>
      <p className="kicker" style={{ marginTop: 12 }}>
        Mix
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((view.mix ?? 0) * 100)}
        onChange={(e) =>
          void sendAction({ type: 'mix', value: Number(e.target.value) / 100 })
        }
      />
    </div>
  )
}
