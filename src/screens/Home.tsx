import { useState } from 'react'
import type { ClientView } from '@shared/types'
import { createHab, joinHab } from '../net'

function habFromUrl(): string {
  try {
    const q = new URLSearchParams(location.search).get('hab')
    return (q ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
  } catch {
    return ''
  }
}

export function Home(props: {
  error: string | null
  onReady: () => void
  onView: (view: ClientView) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(habFromUrl)
  const [busy, setBusy] = useState(false)
  const fromQr = code.length === 4 && habFromUrl() === code

  async function go(kind: 'create' | 'join') {
    props.onReady()
    setBusy(true)
    try {
      const res = kind === 'create' ? await createHab(name) : await joinHab(code, name)
      props.onView(res.view)
      if (kind === 'join' && fromQr) {
        history.replaceState(null, '', location.pathname)
      }
    } catch (err) {
      // A QR from a round that has since ended would otherwise re-fill the same
      // dead code on every refresh.
      if (kind === 'join' && fromQr) {
        history.replaceState(null, '', location.pathname)
        setCode('')
      }
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
        <h1>COSMIC CALL</h1>
        <p className="pitch">
          Four phones. One astronaut has every control and <em>can't hear a word.</em> Three can
          see what's breaking, and all they can send her is a picture —{' '}
          <em>and something on the comms line is forging them.</em>
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
            autoFocus={fromQr}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {fromQr ? (
          <button
            className="btn primary"
            disabled={busy || !name.trim()}
            onClick={() => void go('join')}
          >
            climb aboard {code}
          </button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => void go('create')}>
            open a hab
          </button>
        )}
      </div>

      {!fromQr ? (
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
      ) : (
        <div className="tag" style={{ textAlign: 'center' }}>
          QR locked onto hab {code} — enter your name and board
        </div>
      )}

      {props.error ? <div className="notice">{props.error}</div> : null}

      <div className="tag" style={{ textAlign: 'center', lineHeight: 1.7 }}>
        one table · three see the problem · one has the hands · nobody can just tell her
      </div>
    </div>
  )
}
