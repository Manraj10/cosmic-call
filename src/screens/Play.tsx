import type { ClientView } from '@shared/types'
import { Board } from '../roles/Board'
import { Engineer } from '../roles/Engineer'
import { Pilot } from '../roles/Pilot'
import { Sparks } from '../roles/Sparks'
import { Vega } from '../roles/Vega'

export function Play({ view }: { view: ClientView }) {
  switch (view.you.role) {
    case 'vega':
      return <Vega view={view} />
    case 'engineer':
      return <Engineer view={view} />
    case 'pilot':
      return <Pilot view={view} />
    case 'sparks':
      return <Sparks view={view} />
    case 'board':
      return <Board view={view} />
    default:
      return (
        <div className="app">
          <div className="notice">No seat. Reload and pick one.</div>
        </div>
      )
  }
}
