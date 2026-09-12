/** SHARED GLUE — routes a station. Do not restyle here; restyle the role files. */

import type { ClientView } from '@shared/types'
import { Board } from '../roles/Board'
import { Comms } from '../roles/Comms'
import { Nav } from '../roles/Nav'
import { Oxygen } from '../roles/Oxygen'
import { Power } from '../roles/Power'

export function Play({ view }: { view: ClientView }) {
  if (view.phase === 'end') {
    return (
      <div className="shell">
        <p className="kicker">Mission {view.outcome}</p>
        <h1>{view.outcome === 'won' ? 'Storm passed. HAB-7 still has air.' : 'Hab lost.'}</h1>
        {view.loseReason ? <p>{view.loseReason}</p> : null}
        <button className="btn" onClick={() => location.reload()}>
          Back to pad
        </button>
      </div>
    )
  }

  const role = view.you.role
  return (
    <div className={view.alarm && role === 'oxygen' ? 'strobe' : undefined}>
      {role === 'oxygen' ? <Oxygen view={view} /> : null}
      {role === 'power' ? <Power view={view} /> : null}
      {role === 'nav' ? <Nav view={view} /> : null}
      {role === 'comms' ? <Comms view={view} /> : null}
      {role === 'board' ? <Board view={view} /> : null}
      {!role ? (
        <div className="shell">
          <p>No station. Reload and claim one in the lobby.</p>
        </div>
      ) : null}
    </div>
  )
}
