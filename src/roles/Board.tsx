import type { ClientView } from '@shared/types'
import { AirGauge } from '../components/AirGauge'
import { Frame } from '../components/Frame'
import { PowerCells } from '../components/PowerCells'
import { StormScope } from '../components/StormScope'

/** Spectator view for a laptop on the table. Point the camera at this. */
export function Board({ view }: { view: ClientView }) {
  const s = view.spectator
  if (!s) return null
  const band = s.air > 92 ? 'over' : s.air < 18 ? 'critical' : s.air < 40 ? 'low' : 'ok'

  return (
    <div className="board">
      <Frame who="HAB-7" tag="spectator — everything at once" timeLeft={view.timeLeft}>
        <div className="strip">
          <div className="readout">
            <div className="label">air</div>
            <AirGauge air={s.air} band={band} />
            <div className={`value ${band === 'ok' ? 'v-air' : 'v-danger'}`}>{s.air}</div>
          </div>
          <div className="readout">
            <div className="label">power</div>
            <div className="value v-power">{s.power}</div>
            <PowerCells power={s.power} />
          </div>
          <div className="readout">
            <div className="label">dust front</div>
            <div className="value v-storm">
              {view.stormActive ? 'HIT' : s.stormEta == null ? '—' : Math.ceil(s.stormEta)}
            </div>
            <StormScope eta={s.stormEta} active={!!view.stormActive} lead={24} />
          </div>
        </div>
        <div className="strip">
          <div className="readout">
            <div className="label">pump</div>
            <div className={`value ${s.pumpOn ? 'v-ok' : 'v-danger'}`} style={{ fontSize: 30 }}>
              {s.pumpOn ? 'ON' : 'OFF'}
            </div>
          </div>
          <div className="readout">
            <div className="label">shields</div>
            <div className={`value ${s.shieldsOn ? 'v-ok' : 'v-danger'}`} style={{ fontSize: 30 }}>
              {s.shieldsOn ? 'UP' : 'DOWN'}
            </div>
          </div>
          <div className="readout">
            <div className="label">port valve</div>
            <div className="value" style={{ fontSize: 30 }}>
              {s.valves.port === 'sealed' ? 'SEALED' : 'OPEN'}
            </div>
          </div>
          <div className="readout">
            <div className="label">stbd valve</div>
            <div className="value" style={{ fontSize: 30 }}>
              {s.valves.starboard === 'sealed' ? 'SEALED' : 'OPEN'}
            </div>
          </div>
        </div>
        <div className="log">
          {s.alarms.map((line, i) => (
            <div key={`${line}-${i}`} className={i === s.alarms.length - 1 ? 'fresh' : ''}>
              {line}
            </div>
          ))}
        </div>
      </Frame>
    </div>
  )
}
