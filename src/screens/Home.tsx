/** TRACK B — Friend. Restyle this. Do not change the create/join calls. */

import { useState } from 'react'
import type { ClientView } from '@shared/types'
import { createHab, joinHab } from '../net'

export function Home(props: {
  error: string | null
  onReady: () => void
  onView: (view: ClientView) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function go(kind: 'create' | 'join') {
    props.onReady()
    setBusy(true)
    try {
      const res =
        kind === 'create'
          ? await createHab(name)
          : await joinHab(code, name)
      props.onView(res.view)
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <p className="track-tag">Track B · lobby glass</p>
      <p className="kicker">HAB-7 · four stations</p>
      <h1>CROSSTALK</h1>
      <p>
        Same table, four phones. Each station is missing a sense or a mouth.
        Shout across the table — unless your role says you cannot.
      </p>
      <div className="panel">
        <label className="kicker" htmlFor="callsign">
          Callsign
        </label>
        <input
          id="callsign"
          placeholder="e.g. Xiao"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy} onClick={() => void go('create')}>
            Open a hab
          </button>
        </div>
      </div>
      <div className="panel">
        <label className="kicker" htmlFor="code">
          Join with code
        </label>
        <input
          id="code"
          placeholder="ABCD"
          value={code}
          maxLength={4}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy || code.length < 4} onClick={() => void go('join')}>
            Enter hab
          </button>
        </div>
      </div>
      {props.error ? <p className="banner">{props.error}</p> : null}
      <p className="kicker">
        Two laptops: one person opens a hab, the other joins the code — or both
        open the host URL on the same Wi‑Fi. See COLLAB.md.
      </p>
    </div>
  )
}
