import { useEffect, useState } from 'react'
import { CREW_META, MISSION_SECONDS, signalLabel } from '@shared/content'
import { MODULE_LABEL } from '@shared/habitat'
import { ROLE_IDS, type ClientView } from '@shared/types'
import { MissionHabitat } from '../components/MissionHabitat'
import './mission-control.css'

const SEAL_LABEL = { sealed: 'SEALED', broken: 'BROKEN SEAL', stale: 'OLD COUNTER' }

/** Public telemetry belongs only on this spectator screen. */
export function Board({ view }: { view: ClientView }) {
  const [screenError, setScreenError] = useState('')
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const s = view.spectator
  if (!s) return null
  const remaining = Math.max(0, Math.ceil(view.timeLeft ?? 0))
  const elapsed = Math.max(0, MISSION_SECONDS - remaining)
  const critical = s.air < 18 || s.air > 92
  const storm = view.stormActive === true
  const operator = s.operator
  const traffic = s.traffic.slice(-6).reverse()

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      setScreenError('')
    } catch {
      setScreenError('Fullscreen unavailable. Use your browser’s fullscreen control.')
    }
  }

  return (
    <main className={`mission-control${critical ? ' mc-critical' : ''}`}>
      <header className="mc-header">
        <div className="mc-brand"><span className="mc-orbit" aria-hidden="true">✳</span><div>COSMIC CALL<small>MISSION CONTROL / HAB-7</small></div></div>
        <div className="mc-live"><i /> LIVE SPECTATOR <span>ROOM {view.code}</span></div>
        <button className="mc-fullscreen" onClick={() => void fullscreen()} aria-label="Toggle fullscreen">⛶ <span>Fullscreen</span></button>
      </header>
      {screenError ? <p role="status">{screenError}</p> : null}
      <section className="mc-mission">
        <div><div className="mc-eyebrow">HOW IT WORKS</div><h1>Vega can’t hear the crew. Something is forging her orders.</h1><p>Every order is signed. <b className="mc-ok">SEALED</b> is real. <b className="mc-bad">BROKEN SEAL</b> is a forgery. After 0:58 a stolen key makes forgeries look SEALED too.</p></div>
        <div className={`mc-countdown${remaining <= 15 ? ' mc-danger' : ''}`}><small>RESCUE ETA</small><strong>{String(Math.floor(remaining / 60)).padStart(2, '0')}<span>:</span>{String(remaining % 60).padStart(2, '0')}</strong></div>
      </section>
      <div className="mc-timeline" aria-label={`${elapsed} seconds elapsed of ${MISSION_SECONDS}`}><i style={{ width: `${Math.min(100, elapsed / MISSION_SECONDS * 100)}%` }} /></div>
      <div className="mc-layout">
        <section className="mc-world">
          <div className="mc-panel-heading"><h2>Habitat telemetry</h2><span>{storm ? 'DUST FRONT ACTIVE' : 'SURFACE UPLINK'}</span></div>
          <MissionHabitat operator={operator} storm={storm} pumpOn={s.pumpOn} shieldsOn={s.shieldsOn} />
          <div className="mc-location"><span className="mc-location-dot" /><div><strong>VEGA {operator.walkingTo ? 'IN TRANSIT' : 'ON STATION'}</strong><span>{operator.walkingTo ? `${MODULE_LABEL[operator.at]} → ${MODULE_LABEL[operator.walkingTo]} · ${(operator.arriveInMs / 1000).toFixed(1)}s` : MODULE_LABEL[operator.at]}</span></div><div className={`mc-token${operator.holdingToken ? ' carried' : ''}`}>{operator.holdingToken ? '◆ KEY IN HAND' : `◇ KEY: ${operator.tokenAt ? MODULE_LABEL[operator.tokenAt].toUpperCase() : '—'}`}</div></div>
          <div className="mc-crew">{ROLE_IDS.map((role) => {
            const player = view.players.find((p) => p.role === role && p.connected)
            const name = role === 'vega' ? 'VEGA' : CREW_META[role].callsign
            return <div key={role} className={player ? 'aboard' : ''}><i /><strong>{name}</strong><span>{player?.name ?? 'UNSEATED'}</span></div>
          })}</div>
        </section>
        <aside className="mc-channel">
          <div className="mc-panel-heading"><h2>Command channel</h2><span>RECENT ORDERS</span></div>
          <div className={`mc-threat${s.busThreat ? ' active' : ''}`} role="status"><span>{s.busThreat ? '⚠' : '◈'}</span><div><strong>{s.busThreat ? 'GHOST ON THE BUS' : 'MONITORING THE BUS'}</strong><p>{s.busThreat ?? 'Every order carries a seal. A stolen key can make a hostile order look genuine.'}</p></div></div>
          <div className="mc-traffic">{traffic.length ? traffic.map((packet, i) => (
            <div className={`mc-packet ${packet.seal}`} key={`${s.traffic.length - i}-${packet.tag}`}>
              <div><span>{packet.from ? CREW_META[packet.from].callsign : 'UNKNOWN'} → VEGA</span><span>{i === 0 ? 'LATEST' : 'EARLIER'}</span></div>
              <strong>{signalLabel(packet.signal)}</strong><footer><b>{SEAL_LABEL[packet.seal]}</b><code>{packet.tag}</code></footer>
            </div>
          )) : <div className="mc-empty"><span>⌁</span>Listening for the first call.<small>Crew orders will appear here as they reach Vega.</small></div>}</div>
          <p className="mc-channel-note">A valid seal proves possession of a key. It does not prove the sender is still your crewmate.</p>
        </aside>
      </div>
      <section className="mc-systems" aria-label="Habitat systems">
        <div className={critical ? 'mc-danger' : 'mc-air'}><small>CABIN OXYGEN</small><strong>{Math.round(s.air)}<span>%</span></strong><meter min={0} max={100} low={18} high={92} optimum={65} value={s.air} aria-label="Cabin oxygen" /><p>{s.air > 92 ? 'OVERPRESSURE' : s.air < 18 ? 'CRITICAL AIR' : s.air < 40 ? 'AIR FALLING' : 'BREATHABLE'}</p></div>
        <div className="mc-power"><small>REACTOR POWER</small><strong>{Math.round(s.power)}<span>%</span></strong><meter min={0} max={100} value={s.power} aria-label="Reactor power" /><p>PUMP {s.pumpOn ? 'RUNNING' : 'STOPPED'}</p></div>
        <div className="mc-weather"><small>DUST FRONT</small><strong>{storm ? 'HIT' : s.stormEta == null ? '—' : Math.ceil(s.stormEta)}{s.stormEta !== null && !storm ? <span>s</span> : null}</strong><p>SHIELDS {s.shieldsOn ? 'DEPLOYED' : 'RETRACTED'}</p></div>
        <div className="mc-valves"><small>HULL INTEGRITY</small><div><span>PORT</span><b>{s.valves.port.toUpperCase()}</b></div><div><span>STARBOARD</span><b>{s.valves.starboard.toUpperCase()}</b></div><p>VALVE TELEMETRY</p></div>
      </section>
      <section className="mc-eventlog"><div className="mc-panel-heading"><h2>Flight recorder</h2><span>LATEST EVENTS</span></div><div>{s.alarms.length ? s.alarms.slice(-4).reverse().map((line, i) => <p key={`${line}-${i}`}><span>{i === 0 ? 'NOW' : 'LOG'}</span>{line}</p>) : <p><span>SYS</span>Habitat online. Waiting for the first incident.</p>}</div></section>
      <footer className="mc-footer"><span>COSMIC CALL · HACKCMU</span><span>SPECTATORS ONLY — CREW, WATCH YOUR OWN CONSOLE</span></footer>
    </main>
  )
}
