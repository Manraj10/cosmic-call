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
      const res = kind === 'create' ? await createHab(name) : await joinHab(code, name)
      props.onView(res.view)
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'Could not reach the hab')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="app stage"
      style={{ '--plate': 'url(/art/hero-hab.webp)' } as React.CSSProperties}
    >
      <div className="hero">
        <div className="tag">four astronauts · one dust storm · 90 seconds</div>
        <h1>AIRGAP</h1>
        <p className="pitch">
          Four phones. Four opposite alerts. <em>Power will tell oxygen to kill the pump. Oxygen
          will say absolutely not. A picture slams the glass anyway — and something on the bus is
          forging them.</em>
        </p>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="name">your name</label>
          <input
            id="name"
            placeholder="Xiao"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn primary" disabled={busy} onClick={() => void go('create')}>
          open a hab
        </button>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="code">join your crew</label>
          <input
            id="code"
            placeholder="ABCD"
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <button
          className="btn"
          disabled={busy || code.length < 4}
          onClick={() => void go('join')}
        >
          climb aboard
        </button>
      </div>

      {props.error ? <div className="notice">{props.error}</div> : null}

      <div className="tag" style={{ textAlign: 'center', lineHeight: 1.7 }}>
        everyone in the same room · they send pictures, Vega shouts the air
      </div>
    </div>
  )
}
